export interface Env {
  WITNESS_BUCKET: R2Bucket;
  WITNESS_DB: D1Database;
  AUTH_TOKEN: string;
  ALERT_WORKER_URL: string;
  ALERT_SECRET: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Chunk-Sequence, X-Chunk-Timestamp, X-Latitude, X-Longitude',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400) {
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
      if (url.pathname.startsWith('/api/upload/')) {
        const match = url.pathname.match(/^\/api\/upload\/([^/]+)\/([^/]+)$/);
        if (!match) return errorResponse('Invalid URL format for upload', 400);
        return await handleUpload(request, env, match[1], match[2], ctx);
      }

      if (url.pathname.match(/^\/api\/session\/[^/]+\/finalize$/)) {
        const match = url.pathname.match(/^\/api\/session\/([^/]+)\/finalize$/);
        return await handleFinalize(request, env, match![1], ctx);
      }

      if (url.pathname.startsWith('/api/playback/')) {
        const match = url.pathname.match(/^\/api\/playback\/([^/]+)$/);
        if (!match) return errorResponse('Invalid URL format for playback', 400);
        return await handlePlayback(request, env, match[1]);
      }

      if (url.pathname === '/api/sessions') {
        return await handleListSessions(request, env);
      }

      return errorResponse('Not found', 404);
    } catch (error: any) {
      return errorResponse(error.message || 'Internal Server Error', 500);
    }
  },
};

async function verifyAuth(request: Request, env: Env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
    throw new Error('Unauthorized');
  }
}

async function handleUpload(request: Request, env: Env, sessionId: string, filename: string, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'PUT') return errorResponse('Method not allowed', 405);
  await verifyAuth(request, env).catch(() => { throw new Error('Unauthorized'); });

  const sequence = parseInt(request.headers.get('X-Chunk-Sequence') || '-1', 10);
  const timestamp = request.headers.get('X-Chunk-Timestamp') || new Date().toISOString();
  const latitudeStr = request.headers.get('X-Latitude');
  const longitudeStr = request.headers.get('X-Longitude');
  
  if (sequence < 0) return errorResponse('Missing or invalid X-Chunk-Sequence header');
  
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return errorResponse('Empty body');

  const r2Key = `sessions/${sessionId}/${filename}`;
  await env.WITNESS_BUCKET.put(r2Key, body, {
    customMetadata: {
      sequence: sequence.toString(),
      timestamp,
      sessionId,
    },
    httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' },
  });

  const chunkId = crypto.randomUUID();
  await env.WITNESS_DB.prepare(
    `INSERT INTO chunks (id, session_id, sequence_num, r2_key, size_bytes, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(chunkId, sessionId, sequence, r2Key, body.byteLength, timestamp).run();

  if (sequence === 0) {
    const lat = latitudeStr ? parseFloat(latitudeStr) : null;
    const lng = longitudeStr ? parseFloat(longitudeStr) : null;
    const mimeType = request.headers.get('Content-Type') || 'video/webm';
    
    await env.WITNESS_DB.prepare(
      `INSERT INTO sessions (id, status, started_at, latitude, longitude, mime_type, chunk_count, total_bytes) VALUES (?, 'recording', ?, ?, ?, ?, 1, ?)`
    ).bind(sessionId, timestamp, lat, lng, mimeType, body.byteLength).run();

    if (env.ALERT_WORKER_URL) {
      ctx.waitUntil(
        fetch(env.ALERT_WORKER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.ALERT_SECRET}`,
          },
          body: JSON.stringify({
            type: 'session_started',
            sessionId,
            latitude: lat,
            longitude: lng,
            timestamp,
          }),
        }).catch(err => console.error('Failed to notify alert worker:', err))
      );
    }
  } else {
    await env.WITNESS_DB.prepare(
      `UPDATE sessions SET chunk_count = chunk_count + 1, total_bytes = total_bytes + ? WHERE id = ?`
    ).bind(body.byteLength, sessionId).run();
  }

  return jsonResponse({ success: true, chunkId });
}

async function handleFinalize(request: Request, env: Env, sessionId: string, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);
  await verifyAuth(request, env).catch(() => { throw new Error('Unauthorized'); });

  const now = new Date().toISOString();
  await env.WITNESS_DB.prepare(
    `UPDATE sessions SET status = 'complete', ended_at = ? WHERE id = ?`
  ).bind(now, sessionId).run();

  if (env.ALERT_WORKER_URL) {
    ctx.waitUntil(
      fetch(env.ALERT_WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.ALERT_SECRET}`,
        },
        body: JSON.stringify({
          type: 'session_completed',
          sessionId,
          timestamp: now,
        }),
      }).catch(err => console.error('Failed to notify alert worker:', err))
    );
  }

  return jsonResponse({ success: true });
}

async function handlePlayback(request: Request, env: Env, sessionId: string): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const sessionRes = await env.WITNESS_DB.prepare(`SELECT * FROM sessions WHERE id = ?`).bind(sessionId).first();
  if (!sessionRes) return errorResponse('Session not found', 404);

  const chunksRes = await env.WITNESS_DB.prepare(
    `SELECT r2_key FROM chunks WHERE session_id = ? ORDER BY sequence_num ASC`
  ).bind(sessionId).all<{ r2_key: string }>();

  if (!chunksRes.results || chunksRes.results.length === 0) {
    return errorResponse('No chunks found for session', 404);
  }

  const { readable, writable } = new TransformStream();

  const streamChunks = async () => {
    const writer = writable.getWriter();
    for (const chunk of chunksRes.results) {
      const obj = await env.WITNESS_BUCKET.get(chunk.r2_key);
      if (obj && obj.body) {
        const reader = obj.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) await writer.write(value);
        }
      }
    }
    await writer.close();
  };

  streamChunks().catch(console.error);

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': (sessionRes.mime_type as string) || 'video/webm',
      'Content-Disposition': 'inline',
    },
  });
}

async function handleListSessions(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);
  await verifyAuth(request, env).catch(() => { throw new Error('Unauthorized'); });

  const sessions = await env.WITNESS_DB.prepare(
    `SELECT * FROM sessions ORDER BY started_at DESC LIMIT 100`
  ).all();

  return jsonResponse(sessions.results);
}
