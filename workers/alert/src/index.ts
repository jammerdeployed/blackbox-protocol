export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  DISCORD_WEBHOOK_URL: string;
  ALERT_SECRET: string;
  PLAYBACK_BASE_URL: string;
  RESEND_API_KEY?: string;
  ALERT_EMAIL_TO?: string;
  ALERT_EMAIL_FROM?: string;
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
    chatId?: string;
    emailAddress?: string;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const authHeader = request.headers.get('Authorization');
    const isInternal = request.headers.get('X-Internal-Service') === 'witness-ingestion';
    if (!isInternal && (!authHeader || authHeader !== `Bearer ${env.ALERT_SECRET}`)) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const payload: AlertPayload = await request.json();
      
      const promises: Promise<any>[] = [];

      const targetTelegramChatId = payload.alerts?.chatId || env.TELEGRAM_CHAT_ID;
      if (env.TELEGRAM_BOT_TOKEN && targetTelegramChatId && payload.alerts?.telegram !== false) {
        promises.push(sendTelegramAlert(payload, env, targetTelegramChatId));
      }
      if (env.DISCORD_WEBHOOK_URL && payload.alerts?.discord !== false) {
        promises.push(sendDiscordAlert(payload, env));
      }
      if (env.RESEND_API_KEY && payload.alerts?.email) {
        promises.push(sendEmailAlert(payload, env));
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

async function sendTelegramAlert(payload: AlertPayload, env: Env, chatId: string) {
  const { type, sessionId, latitude, longitude, timestamp } = payload;
  const base = (env.PLAYBACK_BASE_URL || 'https://witness-playback.jammer.workers.dev')
    .replace('witness-ingestion', 'witness-playback')
    .replace(/\/+$/, '');
  const playbackLink = `${base}/play/${sessionId}`;
  
  if (type === 'session_started') {
    if (latitude && longitude) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendLocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
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
        chat_id: chatId,
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
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  }
}

async function sendDiscordAlert(payload: AlertPayload, env: Env) {
  const { type, sessionId, latitude, longitude, timestamp } = payload;
  const base = (env.PLAYBACK_BASE_URL || 'https://witness-playback.jammer.workers.dev')
    .replace('witness-ingestion', 'witness-playback')
    .replace(/\/+$/, '');
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

async function sendEmailAlert(payload: AlertPayload, env: Env) {
  if (!env.RESEND_API_KEY) return;
  const toEmail = payload.alerts?.emailAddress || env.ALERT_EMAIL_TO;
  if (!toEmail) return;

  const { type, sessionId, latitude, longitude, timestamp } = payload;
  const base = (env.PLAYBACK_BASE_URL || 'https://witness-playback.jammer.workers.dev')
    .replace('witness-ingestion', 'witness-playback')
    .replace(/\/+$/, '');
  const playbackLink = `${base}/play/${sessionId}`;

  const isStart = type === 'session_started';
  const subject = isStart
    ? `🚨 WITNESS ACTIVATED: Incident Session ${sessionId.slice(0, 8)}`
    : `✅ WITNESS SESSION COMPLETED: ${sessionId.slice(0, 8)}`;

  const mapsLink = latitude && longitude
    ? `<a href="https://maps.google.com/?q=${latitude},${longitude}">Google Maps (${latitude.toFixed(5)}, ${longitude.toFixed(5)})</a>`
    : 'No GPS data attached';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #1e293b;">
      <h2 style="color: ${isStart ? '#ef4444' : '#10b981'}; margin-top: 0;">${subject}</h2>
      <p style="color: #94a3b8; font-size: 14px;"><strong>Timestamp:</strong> ${new Date(timestamp).toLocaleString()}</p>
      <p style="color: #94a3b8; font-size: 14px;"><strong>Session ID:</strong> <code style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f1f5f9;">${sessionId}</code></p>
      <p style="color: #94a3b8; font-size: 14px;"><strong>Location:</strong> ${mapsLink}</p>
      <div style="margin-top: 24px;">
        <a href="${playbackLink}" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px;">
          View Live Stream & Evidence
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
      <p style="color: #64748b; font-size: 11px;">Witness Protocol · Autonomous Sovereign Edge Evidence</p>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.ALERT_EMAIL_FROM || 'Witness Protocol <onboarding@resend.dev>',
        to: [toEmail],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error('Failed to send Resend email:', err);
  }
}
