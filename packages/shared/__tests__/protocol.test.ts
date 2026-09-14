import { describe, it, expect } from 'vitest';
import {
  MIME_TYPE_PREFERENCE,
  DEFAULT_RECORDER_CONFIG,
  UPLOAD_TIMEOUT_MS,
  HEARTBEAT_TIMEOUT_MS,
  IDB_NAME,
  IDB_STORE,
} from '../src/constants';

describe('Shared Protocol Specification', () => {
  it('prioritizes cross-platform fMP4 container format over WebM', () => {
    expect(MIME_TYPE_PREFERENCE[0]).toContain('video/mp4');
    expect(MIME_TYPE_PREFERENCE[0]).toContain('avc1.42E01E');
    // Ensure WebM is kept as a fallback for older Android devices
    const webmIndex = MIME_TYPE_PREFERENCE.findIndex((m) => m.includes('webm'));
    expect(webmIndex).toBeGreaterThan(0);
  });

  it('defines 1-second timeslice fragmentation default', () => {
    expect(DEFAULT_RECORDER_CONFIG.timesliceMs).toBe(1000);
    expect(DEFAULT_RECORDER_CONFIG.videoBitsPerSecond).toBeGreaterThanOrEqual(2_000_000);
  });

  it('defines resilient timeouts for mobile edge networking', () => {
    expect(UPLOAD_TIMEOUT_MS).toBe(6000); // 6s timeout to abort Lie-Fi
    expect(HEARTBEAT_TIMEOUT_MS).toBe(15000); // 15s dead-man switch
  });

  it('specifies database identifiers', () => {
    expect(IDB_NAME).toBe('blackbox-protocol-db');
    expect(IDB_STORE).toBe('chunk_queue');
  });
});
