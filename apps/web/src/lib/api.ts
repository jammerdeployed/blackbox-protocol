export async function finalizeSession(apiUrl: string, token: string, sessionId: string): Promise<void> {
  const res = await fetch(`${apiUrl}/api/session/${sessionId}/finalize`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to finalize session');
}

export function getPlaybackUrl(apiUrl: string, sessionId: string): string {
  return `${apiUrl}/playback/${sessionId}`;
}
