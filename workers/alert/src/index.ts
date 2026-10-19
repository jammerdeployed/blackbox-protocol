export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  DISCORD_WEBHOOK_URL: string;
  ALERT_SECRET: string;
  PLAYBACK_BASE_URL: string;
}

interface AlertPayload {
  type: 'session_started' | 'session_completed';
  sessionId: string;
  latitude?: number;
  longitude?: number;
  timestamp: string;
  alerts?: {
    telegram?: boolean;
    discord?: boolean;
    email?: boolean;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.ALERT_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const payload: AlertPayload = await request.json();
      
      const promises: Promise<any>[] = [];

      if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID && payload.alerts?.telegram !== false) {
        promises.push(sendTelegramAlert(payload, env));
      }
      if (env.DISCORD_WEBHOOK_URL && payload.alerts?.discord !== false) {
        promises.push(sendDiscordAlert(payload, env));
      }

      await Promise.allSettled(promises);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
  },
};

async function sendTelegramAlert(payload: AlertPayload, env: Env) {
  const { type, sessionId, latitude, longitude, timestamp } = payload;
  const base = (env.PLAYBACK_BASE_URL || 'https://witness-playback.jammer.workers.dev').replace(/\/+$/, '');
  const playbackLink = `${base}/play/${sessionId}`;
  
  if (type === 'session_started') {
    if (latitude && longitude) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendLocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          latitude,
          longitude,
        }),
      });
    }

    const mapsLink = latitude && longitude ? `[Google Maps](https://maps.google.com/?q=${latitude},${longitude})` : 'No GPS data';
    const text = `🔴 *WITNESS ACTIVATED*\n\n*Time:* ${new Date(timestamp).toLocaleString()}\n*GPS:* ${mapsLink}\n*Session ID:* \`${sessionId}\`\n*Playback:* [View Stream](${playbackLink})`;

    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } else if (type === 'session_completed') {
    const text = `✅ *WITNESS SESSION ENDED*\n\n*Session ID:* \`${sessionId}\`\n*Playback:* [View Stream](${playbackLink})`;
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });
  }
}

async function sendDiscordAlert(payload: AlertPayload, env: Env) {
  const { type, sessionId, latitude, longitude, timestamp } = payload;
  const base = (env.PLAYBACK_BASE_URL || 'https://witness-playback.jammer.workers.dev').replace(/\/+$/, '');
  const playbackLink = `${base}/play/${sessionId}`;

  const isStart = type === 'session_started';
  const color = isStart ? 0xff0000 : 0x00ff00;
  const title = isStart ? '🔴 WITNESS ACTIVATED' : '✅ WITNESS SESSION ENDED';
  
  const embed: any = {
    title,
    color,
    timestamp: new Date(timestamp).toISOString(),
    fields: [
      { name: 'Session ID', value: `\`${sessionId}\``, inline: true },
      { name: 'Playback', value: `[View Stream](${playbackLink})`, inline: false },
    ],
  };

  if (isStart && latitude && longitude) {
    embed.fields.push({
      name: 'Location',
      value: `[Google Maps](https://maps.google.com/?q=${latitude},${longitude})\nLat: ${latitude}\nLng: ${longitude}`,
      inline: false,
    });
  }

  await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [embed],
    }),
  });
}
