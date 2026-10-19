export interface RemoteSession {
  id: string;
  status: string;
  mime_type: string;
  created_at: number;
  last_heartbeat_at: number;
  finalized_at: number | null;
  total_chunks: number;
  total_bytes: number;
  contiguous_seq: number;
  last_lat: number | null;
  last_lng: number | null;
}

export async function finalizeSession(apiUrl: string, token: string, sessionId: string): Promise<void> {
  const res = await fetch(`${apiUrl}/api/session/${sessionId}/finalize`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to finalize session');
}

export async function fetchSessions(apiUrl: string, token: string): Promise<RemoteSession[]> {
  const res = await fetch(`${apiUrl}/api/sessions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export function getPlaybackUrl(apiUrl: string, sessionId: string): string {
  const base = apiUrl.replace(/\/+$/, '').replace('witness-ingestion', 'witness-playback');
  return `${base}/play/${sessionId}`;
}
