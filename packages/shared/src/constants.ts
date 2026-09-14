// ─────────────────────────────────────────────────
// Blackbox Protocol — Shared Constants
// ─────────────────────────────────────────────────

import type { RecorderConfig } from './types.js';

/** Default recorder configuration */
export const DEFAULT_RECORDER_CONFIG: RecorderConfig = {
  timesliceMs: 1000,            // 1 chunk per second
  videoBitsPerSecond: 500_000,   // 500 kbps → ~3.75 MB/min
  audioBitsPerSecond: 64_000,    // 64 kbps
};

/** MIME types in order of preference */
export const MIME_TYPE_PREFERENCE = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',   // fMP4 H.264 + AAC (Safari/iOS)
  'video/webm;codecs=vp9,opus',                 // WebM VP9 + Opus (Chrome)
  'video/webm;codecs=vp8,opus',                 // WebM VP8 + Opus (fallback)
  'video/webm',                                  // Generic WebM
] as const;

/** Maximum chunk size for keepalive fetch (64 KB) */
export const KEEPALIVE_MAX_BYTES = 65_536;

/** Maximum retries for failed chunk uploads */
export const MAX_UPLOAD_RETRIES = 5;

/** Retry delay base (ms) — exponential backoff: base * 2^retries */
export const RETRY_BASE_DELAY_MS = 1_000;

/** Geolocation timeout (ms) */
export const GEO_TIMEOUT_MS = 10_000;

/** IndexedDB database name */
export const IDB_NAME = 'witness-queue';

/** IndexedDB store name */
export const IDB_STORE = 'chunks';

/** localStorage key for app config */
export const CONFIG_STORAGE_KEY = 'witness-config';

/** localStorage key for session cache */
export const SESSIONS_STORAGE_KEY = 'witness-sessions';

/** R2 key prefix for session chunks */
export const R2_SESSION_PREFIX = 'sessions';

/** File extension mapping */
export const MIME_TO_EXTENSION: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/webm': '.webm',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2': '.mp4',
  'video/webm;codecs=vp9,opus': '.webm',
  'video/webm;codecs=vp8,opus': '.webm',
};

/** Version string */
export const VERSION = '0.1.0-mvp';
