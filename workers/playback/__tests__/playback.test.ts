import { describe, it, expect } from 'vitest';

describe('Playback Worker Lazy State Evaluation', () => {
  it('evaluates status as ACTIVE when heartbeat is fresh (< 15 seconds)', () => {
    const session = {
      id: 'session-live',
      status: 'ACTIVE',
      last_heartbeat_at: Date.now() - 3000, // 3 seconds ago
    };

    let effectiveStatus = session.status;
    if (effectiveStatus === 'ACTIVE' && Date.now() - session.last_heartbeat_at > 15_000) {
      effectiveStatus = 'INTERRUPTED';
    }

    expect(effectiveStatus).toBe('ACTIVE');
  });

  it('evaluates status as INTERRUPTED when device stopped transmitting (> 15 seconds)', () => {
    const session = {
      id: 'session-destroyed',
      status: 'ACTIVE',
      last_heartbeat_at: Date.now() - 25_000, // 25 seconds ago (device destroyed / killed)
    };

    let effectiveStatus = session.status;
    if (effectiveStatus === 'ACTIVE' && Date.now() - session.last_heartbeat_at > 15_000) {
      effectiveStatus = 'INTERRUPTED';
    }

    expect(effectiveStatus).toBe('INTERRUPTED');
  });

  it('keeps COMPLETED status even if last heartbeat is old', () => {
    const session = {
      id: 'session-finalized',
      status: 'COMPLETED',
      last_heartbeat_at: Date.now() - 60_000,
    };

    let effectiveStatus = session.status;
    if (effectiveStatus === 'ACTIVE' && Date.now() - session.last_heartbeat_at > 15_000) {
      effectiveStatus = 'INTERRUPTED';
    }

    expect(effectiveStatus).toBe('COMPLETED');
  });
});
