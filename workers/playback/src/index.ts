export interface Env {
  WITNESS_BUCKET: R2Bucket;
  WITNESS_DB: D1Database;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'GET') {
      return errorResponse('Method Not Allowed', 405);
    }

    try {
      // 1. Session Telemetry & Metadata
      const infoMatch = url.pathname.match(/^\/play\/([^/]+)\/info$/);
      if (infoMatch) {
        return await handleInfo(request, env, infoMatch[1]);
      }

      // 2. MSE Manifest for real-time live playback and player inspection
      const manifestMatch = url.pathname.match(/^\/play\/([^/]+)\/manifest$/);
      if (manifestMatch) {
        return await handleManifest(request, env, manifestMatch[1]);
      }

      // 3. Direct Zero-RAM Byte-Range Streamer
      const playMatch = url.pathname.match(/^\/play\/([^/]+)$/);
      if (playMatch) {
        return await handlePlayStream(request, env, playMatch[1]);
      }

      return errorResponse('Not Found', 404);
    } catch (error: any) {
      console.error('Playback worker error:', error);
      return errorResponse(error.message || 'Internal Server Error', 500);
    }
  },
};

/**
 * Returns session details with Lazy Evaluation of dead-man's switch status.
 */
async function handleInfo(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await env.WITNESS_DB.prepare(
    `SELECT * FROM sessions WHERE id = ?`
  ).bind(sessionId).first<Record<string, unknown>>();

  if (!session) {
    return errorResponse('Session not found', 404);
  }

  let effectiveStatus = session.status as string;
  const lastHeartbeat = typeof session.last_heartbeat_at === 'number' ? session.last_heartbeat_at : 0;
  if (effectiveStatus === 'ACTIVE' && Date.now() - lastHeartbeat > 15_000) {
    effectiveStatus = 'INTERRUPTED';
  }

  return jsonResponse({
    ...session,
    effectiveStatus,
    isStale: effectiveStatus === 'INTERRUPTED' && session.status === 'ACTIVE',
  });
}

/**
 * Returns manifest of all chunks for live MSE (MediaSource Extensions) playback.
 */
async function handleManifest(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await env.WITNESS_DB.prepare(
    `SELECT * FROM sessions WHERE id = ?`
  ).bind(sessionId).first<Record<string, unknown>>();

  if (!session) {
    return errorResponse('Session not found', 404);
  }

  const chunksRes = await env.WITNESS_DB.prepare(
    `SELECT sequence_num, r2_key, byte_length, byte_offset, sha256, recorded_at, lat, lng 
     FROM chunks 
     WHERE session_id = ? 
     ORDER BY sequence_num ASC`
  ).bind(sessionId).all<Record<string, unknown>>();

  return jsonResponse({
    session,
    chunkCount: chunksRes.results.length,
    chunks: chunksRes.results,
  });
}

/**
 * Production Zero-RAM Byte-Range Streamer with:
 * 1. Strict 206 Partial Content support for iOS Safari (AVPlayer bytes=0-1 probe)
 * 2. R2 partial get (range: { offset, length }) — probes download only 2 bytes!
 * 3. Max window chunking (15 MB) to protect against Cloudflare subrequest limits
 * 4. Client disconnect cleanup via request.signal
 */
async function handlePlayStream(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await env.WITNESS_DB.prepare(
    `SELECT id, mime_type, status, last_heartbeat_at FROM sessions WHERE id = ?`
  ).bind(sessionId).first<{ id: string; mime_type: string; status: string; last_heartbeat_at: number }>();

  if (!session) return errorResponse('Session not found', 404);

  const { results: chunkRecords } = await env.WITNESS_DB.prepare(
    `SELECT r2_key, sequence_num, byte_length, byte_offset 
     FROM chunks 
     WHERE session_id = ? 
     ORDER BY sequence_num ASC`
  ).bind(sessionId).all<{
    r2_key: string;
    sequence_num: number;
    byte_length: number;
    byte_offset: number;
  }>();

  if (!chunkRecords || chunkRecords.length === 0) {
    return errorResponse('No recorded video chunks available', 404);
  }
  if (chunkRecords[0].sequence_num !== 0) {
    return errorResponse('Session missing initialization segment (chunk 0)', 422);
  }

  // Calculate cumulative byte offsets for slicing
  let runningOffset = 0;
  const indexedChunks = chunkRecords.map((c) => {
    const start = runningOffset;
    const end = start + c.byte_length - 1; // inclusive
    runningOffset += c.byte_length;
    return { ...c, start, end };
  });

  const totalSize = runningOffset;
  const rawMime = session.mime_type || 'video/mp4';
  const cleanMime = rawMime.includes('webm') ? 'video/webm' : 'video/mp4';

  // 1. Parse HTTP Range header (Mandatory for iOS Safari bytes=0-1 and scrubbing)
  const rangeHeader = request.headers.get('Range');
  let rangeStart = 0;
  let rangeEnd = totalSize - 1;
  let isPartial = false;

  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    isPartial = true;
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    rangeStart = parseInt(parts[0], 10);

    // Limit unbounded range window to 15 MB to protect Cloudflare subrequest limit
    const MAX_CHUNK_WINDOW = 15 * 1024 * 1024;
    rangeEnd = parts[1]
      ? Math.min(parseInt(parts[1], 10), totalSize - 1)
      : Math.min(rangeStart + MAX_CHUNK_WINDOW - 1, totalSize - 1);

    if (isNaN(rangeStart) || rangeStart >= totalSize || rangeStart > rangeEnd) {
      return new Response(null, {
        status: 416,
        headers: {
          ...corsHeaders,
          'Content-Range': `bytes */${totalSize}`,
        },
      });
    }
  }

  const contentLength = rangeEnd - rangeStart + 1;

  // Filter only chunks that intersect with the requested [rangeStart, rangeEnd]
  const targetChunks = indexedChunks.filter(
    (c) => c.end >= rangeStart && c.start <= rangeEnd
  );

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const abortSignal = request.signal;

  // 2. Asynchronous streaming pump bound to request.signal with R2 partial range gets
  (async () => {
    let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
      for (const chunk of targetChunks) {
        if (abortSignal.aborted) break;

        const sliceStart = Math.max(0, rangeStart - chunk.start);
        const sliceEnd = Math.min(chunk.byte_length - 1, rangeEnd - chunk.start);
        const sliceLength = sliceEnd - sliceStart + 1;

        // Native R2 partial get: for bytes=0-1 probe, R2 transfers exactly 2 bytes!
        const obj = await env.WITNESS_BUCKET.get(chunk.r2_key, {
          range: { offset: sliceStart, length: sliceLength },
        });

        if (!obj || !obj.body) {
          console.warn(`Missing chunk in R2: ${chunk.r2_key}`);
          continue;
        }

        currentReader = obj.body.getReader();
        while (true) {
          if (abortSignal.aborted) {
            await currentReader.cancel('Client disconnected');
            break;
          }
          const { done, value } = await currentReader.read();
          if (done) break;
          await writer.write(value);
        }
        currentReader = null;
      }
      if (!abortSignal.aborted) {
        await writer.close();
      }
    } catch (err) {
      if (currentReader) {
        await currentReader.cancel().catch(() => {});
      }
      await writer.abort(err).catch(() => {});
    }
  })();

  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': cleanMime,
    'Content-Length': contentLength.toString(),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Content-Disposition': 'inline',
  };

  if (isPartial) {
    headers['Content-Range'] = `bytes ${rangeStart}-${rangeEnd}/${totalSize}`;
  }

  return new Response(readable, {
    status: isPartial ? 206 : 200,
    headers,
  });
}
