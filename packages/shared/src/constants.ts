// ─────────────────────────────────────────────────
// Blackbox Protocol — Shared Constants
// ─────────────────────────────────────────────────

import type { RecorderConfig } from './types.js';

/** Default recorder configuration */
export const DEFAULT_RECORDER_CONFIG: RecorderConfig = {
  timesliceMs: 1000,            // 1 chunk per second
  videoBitsPerSecond: 2_500_000, // 2.5 Mbps crisp 1080p
  audioBitsPerSecond: 128_000,   // 128 kbps
};

/**
 * MIME types in order of preference.
 * Modern Chromium 126+ and Safari both support MP4 container output with H.264.
 */
export const MIME_TYPE_PREFERENCE = [
  'video/mp4;codecs="avc1.42E01E, mp4a.40.2"',
  'video/mp4;codecs="avc1.42E01E, opus"',
  'video/mp4',
  'video/webm;codecs="vp8, opus"',
  'video/webm',
] as const;

/** Maximum retries for failed chunk uploads */
export const MAX_UPLOAD_RETRIES = 5;

/** Retry delay base (ms) — exponential backoff: base * 1.5^retries */
export const RETRY_BASE_DELAY_MS = 1_000;

/** Geolocation timeout (ms) */
export const GEO_TIMEOUT_MS = 10_000;

/** IndexedDB database name */
export const IDB_NAME = 'blackbox-protocol-db';

/** IndexedDB store name */
export const IDB_STORE = 'chunk_queue';

/** Web Lock name for upload engine concurrency control */
export const UPLOAD_LOCK_NAME = 'blackbox_upload_lock';

/** Upload request timeout (ms) — prevents hangs in Lie-Fi environments */
export const UPLOAD_TIMEOUT_MS = 6_000;

/** Dead-man's switch / heartbeat timeout (ms) */
export const HEARTBEAT_TIMEOUT_MS = 15_000;

/** localStorage key for app config */
export const CONFIG_STORAGE_KEY = 'witness-config';

/** localStorage key for session cache */
export const SESSIONS_STORAGE_KEY = 'witness-sessions';

/** R2 key prefix for session chunks */
export const R2_SESSION_PREFIX = 'sessions';

/** Version string */
export const VERSION = '1.0.0';
