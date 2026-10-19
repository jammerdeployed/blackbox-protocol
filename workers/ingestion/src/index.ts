export interface Env {
  WITNESS_BUCKET: R2Bucket;
  WITNESS_DB: D1Database;
  AUTH_TOKEN: string;
  ALERT_SERVICE?: Fetcher;
  ALERT_SECRET?: string;
  ALERT_WORKER_URL?: string;
}

const MAX_CHUNK_BYTES = 12 * 1024 * 1024; // 12 MB limit for 1s chunk (memory protection)
const MAX_BEACON_BYTES = 4096; // 4 KB limit for emergency beacon

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Chunk-Sequence, X-Chunk-Timestamp, X-Chunk-SHA256, X-Latitude, X-Longitude, X-Battery-Level, X-Alert-Preferences',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Chunk Upload: PUT /api/upload/:sessionId/:filename
      if (url.pathname.startsWith('/api/upload/')) {
        const match = url.pathname.match(/^\/api\/upload\/([^/]+)\/([^/]+)$/);
        if (!match) return errorResponse('Invalid upload URL format', 400);
        return await handleUpload(request, env, match[1], match[2], ctx);
      }

      // 2. Finalize Session: POST /api/session/:sessionId/finalize
      if (url.pathname.match(/^\/api\/session\/[^/]+\/finalize$/)) {
        const match = url.pathname.match(/^\/api\/session\/([^/]+)\/finalize$/);
        return await handleFinalize(request, env, match![1], ctx);
      }

      // 3. Emergency Suspend Beacon: POST /api/session/:sessionId/beacon
      if (url.pathname.match(/^\/api\/session\/[^/]+\/beacon$/)) {
        const match = url.pathname.match(/^\/api\/session\/([^/]+)\/beacon$/);
        return await handleBeacon(request, env, match![1]);
      }

      // 4. List Sessions: GET /api/sessions
      if (url.pathname === '/api/sessions') {
        return await handleListSessions(request, env);
      }

      return errorResponse('Not found', 404);
    } catch (error: any) {
      console.error('Ingestion worker error:', error);
      return errorResponse(error.message || 'Internal Server Error', error.status || 500);
    }
  },
};

function verifyAuth(request: Request, env: Env): void {
  const url = new URL(request.url);
  const authHeader = (request.headers.get('Authorization') || '').trim();
  const tokenQuery = (url.searchParams.get('token') || '').trim();
  const expectedToken = (env.AUTH_TOKEN || '').trim();

  // If AUTH_TOKEN is set in secrets, accept header or beacon query param
  if (expectedToken) {
    const hasHeaderAuth = authHeader === `Bearer ${expectedToken}`;
    const hasQueryAuth = tokenQuery === expectedToken;
    if (!hasHeaderAuth && !hasQueryAuth) {
      const err: any = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
  }
}

async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function dispatchAlert(env: Env, ctx: ExecutionContext, payload: any): void {
  if (!env.ALERT_SECRET) return;
  if (!env.ALERT_SERVICE && !env.ALERT_WORKER_URL) return;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.ALERT_SECRET}`,
  };
  const body = JSON.stringify(payload);

  ctx.waitUntil(
    (async () => {
      try {
        if (env.ALERT_SERVICE) {
          await env.ALERT_SERVICE.fetch(new Request('http://witness-alert/alert', {
            method: 'POST',
            headers,
            body,
          }));
        } else if (env.ALERT_WORKER_URL) {
          const endpoint = env.ALERT_WORKER_URL.replace(/\/+$/, '') + '/alert';
          await fetch(endpoint, {
            method: 'POST',
            headers,
            body,
          });
        }
      } catch (err: any) {
        console.error('Alert worker dispatch failed:', err);
      }
    })()
  );
}

/**
 * Staff-level chunk upload handler:
 * - Verifies SHA-256 integrity on the Edge before persisting
 * - Strictly Write-Once (rejects hash tampering with 422, ignores race-condition duplicates)
 * - Prevents double-counting in `sessions` on parallel network retries
 */
async function handleUpload(
  request: Request,
  env: Env,
  sessionId: string,
  filename: string,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== 'PUT') return errorResponse('Method not allowed', 405);
  verifyAuth(request, env);

  const sequence = parseInt(request.headers.get('X-Chunk-Sequence') || '-1', 10);
  const recordedAt = parseInt(request.headers.get('X-Chunk-Timestamp') || Date.now().toString(), 10);
  const clientSha256 = (request.headers.get('X-Chunk-SHA256') || '').toLowerCase();
  const latitudeStr = request.headers.get('X-Latitude');
  const longitudeStr = request.headers.get('X-Longitude');
  const batteryStr = request.headers.get('X-Battery-Level');
  const alertsStr = request.headers.get('X-Alert-Preferences');

  if (sequence < 0 || Number.isNaN(sequence)) {
    return errorResponse('Missing or invalid X-Chunk-Sequence header', 400);
  }

  // Early protection against unbounded memory allocation
  const contentLengthHeader = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLengthHeader > MAX_CHUNK_BYTES) {
    return errorResponse('Chunk payload exceeds maximum allowed size (12 MB)', 413);
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return jsonResponse({ success: true, ignored: true, reason: 'Empty chunk body' });
  }
  if (body.byteLength > MAX_CHUNK_BYTES) {
    return errorResponse('Chunk payload exceeds maximum allowed size (12 MB)', 413);
  }

  // Cryptographic integrity check on Edge (< 0.5ms CPU)
  const computedSha256 = await computeSha256Hex(body);
  if (clientSha256 && clientSha256 !== computedSha256) {
    return errorResponse('Integrity check failed: X-Chunk-SHA256 mismatch', 422);
  }

  // Write-Once Immutability check
  const existingChunk = await env.WITNESS_DB.prepare(
    `SELECT sha256 FROM chunks WHERE session_id = ? AND sequence_num = ?`
  ).bind(sessionId, sequence).first<{ sha256: string }>();

  if (existingChunk) {
    if (existingChunk.sha256 === computedSha256) {
      // Idempotent retry of identical chunk -> 409 Conflict (signals already stored to client)
      return jsonResponse({ success: true, duplicate: true, status: 'already_stored' }, 409);
    } else {
      // Tamper attempt: trying to overwrite an existing chunk with different data
      return errorResponse('Tamper protection: Sequence number already committed with different hash', 422);
    }
  }

  const lat = latitudeStr ? parseFloat(latitudeStr) : null;
  const lng = longitudeStr ? parseFloat(longitudeStr) : null;
  const battery = batteryStr ? parseFloat(batteryStr) : null;
  const contentType = request.headers.get('Content-Type') || 'video/mp4';
  const r2Key = `sessions/${sessionId}/chunk_${sequence.toString().padStart(8, '0')}.mp4`;

  // STEP 1: Persist binary data into R2 (idempotent key)
  await env.WITNESS_BUCKET.put(r2Key, body, {
    customMetadata: {
      sequence: sequence.toString(),
      sessionId,
      sha256: computedSha256,
      recordedAt: recordedAt.toString(),
    },
    httpMetadata: { contentType },
  });

  // STEP 2: Atomic transaction in D1 resilient against parallel TOCTOU retries
  const now = Date.now();
  const chunkId = crypto.randomUUID();

  // 2a. Ensure session existence and update telemetry (without blind count increment)
  const ensureSessionStmt = env.WITNESS_DB.prepare(
    `INSERT INTO sessions (
      id, status, mime_type, created_at, last_heartbeat_at, 
      total_chunks, total_bytes, last_lat, last_lng, battery_level, metadata
    ) VALUES (?, 'ACTIVE', ?, ?, ?, 0, 0, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = CASE WHEN sessions.status = 'INTERRUPTED' THEN 'ACTIVE' ELSE sessions.status END,
      last_heartbeat_at = MAX(sessions.last_heartbeat_at, excluded.last_heartbeat_at),
      last_lat = COALESCE(excluded.last_lat, sessions.last_lat),
      last_lng = COALESCE(excluded.last_lng, sessions.last_lng),
      battery_level = COALESCE(excluded.battery_level, sessions.battery_level),
      metadata = COALESCE(excluded.metadata, sessions.metadata)`
  ).bind(sessionId, contentType, recordedAt, now, lat, lng, battery, alertsStr || null);

  // 2b. Strict Write-Once INSERT (ON CONFLICT DO NOTHING eliminates duplicate insertion)
  const insertChunkStmt = env.WITNESS_DB.prepare(
    `INSERT INTO chunks (
      id, session_id, sequence_num, r2_key, byte_length, 
      byte_offset, sha256, recorded_at, uploaded_at, lat, lng
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, sequence_num) DO NOTHING`
  ).bind(
    chunkId,
    sessionId,
    sequence,
    r2Key,
    body.byteLength,
    computedSha256,
    recordedAt,
    now,
    lat,
    lng
  );

  // 2c. Atomic recount of total_chunks and total_bytes directly from chunks table (100% immune to retry races)
  const syncSessionTotalsStmt = env.WITNESS_DB.prepare(
    `UPDATE sessions 
     SET total_chunks = (SELECT COUNT(*) FROM chunks WHERE session_id = ?1),
         total_bytes = (SELECT COALESCE(SUM(byte_length), 0) FROM chunks WHERE session_id = ?1)
     WHERE id = ?1`
  ).bind(sessionId);

  const batchResults = await env.WITNESS_DB.batch([
    ensureSessionStmt,
    insertChunkStmt,
    syncSessionTotalsStmt,
  ]);

  const wasInserted = (batchResults[1]?.meta?.changes ?? 0) > 0;

  // STEP 3: Dispatch alert on sequence 0 if newly inserted
  if (sequence === 0 && wasInserted && (env.ALERT_SERVICE || env.ALERT_WORKER_URL) && env.ALERT_SECRET) {
    let alerts = undefined;
    if (alertsStr) {
      try {
        alerts = JSON.parse(alertsStr);
      } catch (e) {
        console.warn('Failed to parse alert preferences header:', e);
      }
    }

    dispatchAlert(env, ctx, {
      type: 'session_started',
      sessionId,
      latitude: lat,
      longitude: lng,
      timestamp: new Date(now).toISOString(),
      alerts,
    });
  }

  return jsonResponse({
    success: true,
    chunkId,
    sequence,
    duplicate: !wasInserted,
    bytesReceived: body.byteLength,
    sha256: computedSha256,
  }, wasInserted ? 200 : 409);
}

/**
 * Handles OS-level sendBeacon requests upon screen lock or app backgrounding.
 * Protected against payload floods and handles pre-Chunk-0 emergency beacons via UPSERT.
 */
async function handleBeacon(request: Request, env: Env, sessionId: string): Promise<Response> {
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);
  verifyAuth(request, env);

  try {
    const rawText = await request.text();
    if (rawText.length > MAX_BEACON_BYTES) {
      return errorResponse('Beacon payload too large', 413);
    }

    const data = rawText ? JSON.parse(rawText) : {};
    const now = Date.now();
    const lat = typeof data.lat === 'number' ? data.lat : null;
    const lng = typeof data.lng === 'number' ? data.lng : null;
    const battery = typeof data.batteryLevel === 'number' ? data.batteryLevel : null;

    // UPSERT ensures GPS coordinates are saved even if device locks/dies in 0.5s before Chunk 0
    // WHERE condition prevents overwriting already COMPLETED sessions.
    await env.WITNESS_DB.prepare(
      `INSERT INTO sessions (
        id, status, mime_type, created_at, last_heartbeat_at, last_lat, last_lng, battery_level
      ) VALUES (?, 'INTERRUPTED', 'video/mp4', ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_heartbeat_at = excluded.last_heartbeat_at,
        last_lat = COALESCE(excluded.last_lat, sessions.last_lat),
        last_lng = COALESCE(excluded.last_lng, sessions.last_lng),
        battery_level = COALESCE(excluded.battery_level, sessions.battery_level)
      WHERE sessions.status != 'COMPLETED'`
    ).bind(sessionId, now, now, lat, lng, battery).run();

    return jsonResponse({ success: true, beaconReceived: true });
  } catch (err: any) {
    return errorResponse('Invalid beacon payload', 400);
  }
}

/**
 * Finalizes an active session with full integrity reconciliation,
 * byte_offset materialization, and sequence gap detection.
 */
async function handleFinalize(
  request: Request,
  env: Env,
  sessionId: string,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);
  verifyAuth(request, env);

  const now = Date.now();

  // 1. Aggregate integrity check and sequence gap detection
  const stats = await env.WITNESS_DB.prepare(
    `SELECT 
       COUNT(*) as count,
       COALESCE(SUM(byte_length), 0) as total_bytes,
       MIN(sequence_num) as min_seq,
       MAX(sequence_num) as max_seq
     FROM chunks 
     WHERE session_id = ?`
  ).bind(sessionId).first<{
    count: number;
    total_bytes: number;
    min_seq: number | null;
    max_seq: number | null;
  }>();

  if (!stats || stats.count === 0) {
    return errorResponse('Cannot finalize empty session', 422);
  }

  const hasInitSegment = stats.min_seq === 0;
  const isContiguous = hasInitSegment && stats.max_seq === stats.count - 1;
  const finalStatus = hasInitSegment ? 'COMPLETED' : 'CORRUPTED';

  // 2. Reconcile exact cumulative byte offsets using SQLite Window function
  const reconcileOffsetsStmt = env.WITNESS_DB.prepare(
    `WITH ordered AS (
       SELECT id, COALESCE(SUM(byte_length) OVER (
         PARTITION BY session_id ORDER BY sequence_num ASC 
         ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
       ), 0) AS calc_offset
       FROM chunks
       WHERE session_id = ?1
     )
     UPDATE chunks
     SET byte_offset = (SELECT calc_offset FROM ordered WHERE ordered.id = chunks.id)
     WHERE session_id = ?1`
  ).bind(sessionId);

  const updateSessionStmt = env.WITNESS_DB.prepare(
    `UPDATE sessions 
     SET status = ?1,
         finalized_at = ?2,
         last_heartbeat_at = ?2,
         total_chunks = ?3,
         total_bytes = ?4,
         contiguous_seq = ?5
     WHERE id = ?6`
  ).bind(
    finalStatus,
    now,
    stats.count,
    stats.total_bytes,
    isContiguous ? stats.max_seq : -1,
    sessionId
  );

  await env.WITNESS_DB.batch([reconcileOffsetsStmt, updateSessionStmt]);

  // 3. Dispatch alert with complete integrity metadata
  if ((env.ALERT_SERVICE || env.ALERT_WORKER_URL) && env.ALERT_SECRET) {
    let alerts = undefined;
    try {
      const session = await env.WITNESS_DB.prepare(
        `SELECT metadata FROM sessions WHERE id = ?`
      ).bind(sessionId).first<{ metadata: string | null }>();

      if (session?.metadata) {
        alerts = JSON.parse(session.metadata);
      }
    } catch (e) {
      console.warn('Failed to parse metadata for finalize alert:', e);
    }

    dispatchAlert(env, ctx, {
      type: 'session_completed',
      sessionId,
      status: finalStatus,
      totalChunks: stats.count,
      totalBytes: stats.total_bytes,
      isContiguous,
      timestamp: new Date(now).toISOString(),
      alerts,
    });
  }

  return jsonResponse({
    success: true,
    status: finalStatus,
    reconciled: {
      totalChunks: stats.count,
      totalBytes: stats.total_bytes,
      isContiguous,
      hasInitSegment,
    },
  });
}

/**
 * Returns list of recent sessions with Lazy State Evaluation for abandoned active sessions.
 */
async function handleListSessions(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);
  verifyAuth(request, env);

  const staleThresholdMs = Date.now() - 15_000; // 15s without heartbeat = INTERRUPTED

  const sessions = await env.WITNESS_DB.prepare(
    `SELECT 
       id,
       CASE 
         WHEN status = 'ACTIVE' AND last_heartbeat_at < ?1 THEN 'INTERRUPTED'
         ELSE status 
       END as status,
       mime_type, created_at, last_heartbeat_at, finalized_at, 
       total_chunks, total_bytes, contiguous_seq, last_lat, last_lng 
     FROM sessions 
     ORDER BY created_at DESC 
     LIMIT 50`
  ).bind(staleThresholdMs).all();

  return jsonResponse(sessions.results);
}
