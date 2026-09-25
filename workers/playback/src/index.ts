export interface Env {
  WITNESS_BUCKET: R2Bucket;
  WITNESS_DB: D1Database;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

    if (request.method !== 'GET') {
      return errorResponse('Method Not Allowed', 405);
    }

    try {
      const infoMatch = url.pathname.match(/^\/play\/([^/]+)\/info$/);
      if (infoMatch) {
        return await handleInfo(request, env, infoMatch[1]);
      }

      const playMatch = url.pathname.match(/^\/play\/([^/]+)$/);
      if (playMatch) {
        return await handlePlay(request, env, playMatch[1]);
      }

      return errorResponse('Not Found', 404);
    } catch (error: any) {
      return errorResponse(error.message || 'Internal Server Error', 500);
    }
  },
};

async function handleInfo(request: Request, env: Env, sessionId: string): Promise<Response> {
  const sessionRes = await env.WITNESS_DB.prepare(`SELECT * FROM sessions WHERE id = ?`).bind(sessionId).first();
  
  if (!sessionRes) {
    return errorResponse('Session not found', 404);
  }

  return jsonResponse(sessionRes);
}

async function handlePlay(request: Request, env: Env, sessionId: string): Promise<Response> {
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
