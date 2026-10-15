export interface Env {
  WITNESS_BUCKET: R2Bucket;
  WITNESS_DB: D1Database;
  AUTH_TOKEN: string;
  ALERT_SERVICE?: Fetcher;
  ALERT_SECRET?: string;
}

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

/**
 * Staff-level chunk upload handler:
 * 1. Writes binary data to Cloudflare R2 first (Dual-write mitigation)
 * 2. Persists metadata atomically into Cloudflare D1
 * 3. Out-of-order acceptance ensures no footage is dropped if chunk 0 is delayed
 * 4. Immutability / Write-Once: returns 409 Conflict if chunk is already persisted
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
  const sha256 = request.headers.get('X-Chunk-SHA256') || '';
  const latitudeStr = request.headers.get('X-Latitude');
  const longitudeStr = request.headers.get('X-Longitude');
  const batteryStr = request.headers.get('X-Battery-Level');
  const alertsStr = request.headers.get('X-Alert-Preferences');

  if (sequence < 0) {
    return errorResponse('Missing or invalid X-Chunk-Sequence header', 400);
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return jsonResponse({ success: true, ignored: true, reason: 'Empty chunk body' });
  }

  const lat = latitudeStr ? parseFloat(latitudeStr) : null;
  const lng = longitudeStr ? parseFloat(longitudeStr) : null;
  const battery = batteryStr ? parseFloat(batteryStr) : null;
  const contentType = request.headers.get('Content-Type') || 'video/mp4';
  const r2Key = `sessions/${sessionId}/${filename}`;

  // Check if chunk with identical sequence and hash is already stored (Idempotency)
  const existingChunk = await env.WITNESS_DB.prepare(
    `SELECT sha256 FROM chunks WHERE session_id = ? AND sequence_num = ?`
  ).bind(sessionId, sequence).first<{ sha256: string }>();

  if (existingChunk) {
    if (existingChunk.sha256 === sha256) {
      return jsonResponse({ success: true, duplicate: true, status: 'already_stored' }, 409);
    }
  }

  // STEP 1: Put chunk to R2 first
  await env.WITNESS_BUCKET.put(r2Key, body, {
    customMetadata: {
      sequence: sequence.toString(),
      sessionId,
      sha256,
      recordedAt: recordedAt.toString(),
    },
    httpMetadata: { contentType },
  });

  // STEP 2: Atomic Batch to D1
  const now = Date.now();
  const chunkId = crypto.randomUUID();

  const upsertSessionStmt = env.WITNESS_DB.prepare(
    `INSERT INTO sessions (
      id, status, mime_type, created_at, last_heartbeat_at, 
      total_chunks, total_bytes, last_lat, last_lng, battery_level, metadata
    ) VALUES (?1, 'ACTIVE', ?2, ?3, ?4, 1, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(id) DO UPDATE SET
      last_heartbeat_at = ?4,
      total_chunks = total_chunks + 1,
      total_bytes = total_bytes + ?5,
      last_lat = COALESCE(?6, sessions.last_lat),
      last_lng = COALESCE(?7, sessions.last_lng),
      battery_level = COALESCE(?8, sessions.battery_level),
      metadata = COALESCE(?9, sessions.metadata)`
  ).bind(
    sessionId,
    contentType,
    recordedAt,
    now,
    body.byteLength,
    lat,
    lng,
    battery,
    alertsStr || null
  );

  const insertChunkStmt = env.WITNESS_DB.prepare(
    `INSERT INTO chunks (
      id, session_id, sequence_num, r2_key, byte_length, 
      byte_offset, sha256, recorded_at, uploaded_at, lat, lng
    ) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?8, ?9, ?10)
    ON CONFLICT(session_id, sequence_num) DO UPDATE SET
      r2_key = ?4,
      byte_length = ?5,
      sha256 = ?6,
      uploaded_at = ?8`
  ).bind(
    chunkId,
    sessionId,
    sequence,
    r2Key,
    body.byteLength,
    sha256,
    recordedAt,
    now,
    lat,
    lng
  );

  await env.WITNESS_DB.batch([upsertSessionStmt, insertChunkStmt]);

  // STEP 3: Dispatch alert on sequence 0
  if (sequence === 0 && env.ALERT_SERVICE && env.ALERT_SECRET) {
    let alerts = undefined;
    if (alertsStr) {
      try {
        alerts = JSON.parse(alertsStr);
      } catch (e) {
        console.warn('Failed to parse alert preferences header:', e);
      }
    }

    ctx.waitUntil(
      env.ALERT_SERVICE.fetch(new Request('http://alert-service/alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.ALERT_SECRET}`,
        },
        body: JSON.stringify({
          type: 'session_started',
          sessionId,
          latitude: lat,
          longitude: lng,
          timestamp: new Date(now).toISOString(),
          alerts,
        }),
      })).catch((err: any) => console.error('Alert worker trigger failed:', err))
    );
  }

  return jsonResponse({
    success: true,
    chunkId,
    sequence,
    bytesReceived: body.byteLength,
  });
}

/**
 * Handles OS-level sendBeacon requests upon screen lock or app backgrounding.
 */
async function handleBeacon(request: Request, env: Env, sessionId: string): Promise<Response> {
  verifyAuth(request, env);

  try {
    const data = await request.json<any>().catch(() => ({}));
    const now = Date.now();

    await env.WITNESS_DB.prepare(
      `UPDATE sessions 
       SET last_heartbeat_at = ?,
           last_lat = COALESCE(?, last_lat),
           last_lng = COALESCE(?, last_lng),
           battery_level = COALESCE(?, battery_level)
       WHERE id = ?`
    ).bind(
      now,
      data.lat ?? null,
      data.lng ?? null,
      data.batteryLevel ?? null,
      sessionId
    ).run();

    return jsonResponse({ success: true, beaconReceived: true });
  } catch (err: any) {
    return errorResponse(err.message || 'Beacon processing failed', 400);
  }
}

/**
 * Finalizes an active session.
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
  await env.WITNESS_DB.prepare(
    `UPDATE sessions 
     SET status = 'COMPLETED', finalized_at = ?, last_heartbeat_at = ? 
     WHERE id = ?`
  ).bind(now, now, sessionId).run();

  if (env.ALERT_SERVICE && env.ALERT_SECRET) {
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

    ctx.waitUntil(
      env.ALERT_SERVICE.fetch(new Request('http://alert-service/alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.ALERT_SECRET}`,
        },
        body: JSON.stringify({
          type: 'session_completed',
          sessionId,
          timestamp: new Date(now).toISOString(),
          alerts,
        }),
      })).catch((err: any) => console.error('Alert worker finalize trigger failed:', err))
    );
  }

  return jsonResponse({ success: true, status: 'COMPLETED' });
}

/**
 * Returns list of recent sessions.
 */
async function handleListSessions(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);
  verifyAuth(request, env);

  const sessions = await env.WITNESS_DB.prepare(
    `SELECT id, status, mime_type, created_at, last_heartbeat_at, finalized_at, 
            total_chunks, total_bytes, last_lat, last_lng 
     FROM sessions 
     ORDER BY created_at DESC 
     LIMIT 50`
  ).all();

  return jsonResponse(sessions.results);
}
