// ─────────────────────────────────────────────────
// Blackbox Protocol — Shared Types
// ─────────────────────────────────────────────────

/** Status of a recording session (Finite State Machine) */
export type SessionStatus = 'ACTIVE' | 'INTERRUPTED' | 'COMPLETED' | 'CORRUPTED';

/** Alert routing preferences */
export interface AlertPreferences {
  telegram: boolean;
  discord: boolean;
  email: boolean;
  emailAddress?: string;
}

/** A recording session */
export interface Session {
  id: string;
  status: SessionStatus;
  mimeType: string;
  createdAt: number;
  lastHeartbeatAt: number;
  finalizedAt: number | null;
  contiguousSeq: number;
  totalChunks: number;
  totalBytes: number;
  lastLat: number | null;
  lastLng: number | null;
  lastAccuracy: number | null;
  batteryLevel: number | null;
  metadata?: AlertPreferences | Record<string, unknown> | null;
}

/** A single recorded chunk */
export interface Chunk {
  id: string;
  sessionId: string;
  sequenceNum: number;
  r2Key: string;
  byteLength: number;
  byteOffset: number;
  sha256: string;
  recordedAt: number;
  uploadedAt: number;
  lat: number | null;
  lng: number | null;
}

/** Geolocation coordinates */
export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/** Alert payload sent between workers */
export interface AlertPayload {
  type: 'session_started' | 'session_completed' | 'session_interrupted';
  sessionId: string;
  latitude?: number | null;
  longitude?: number | null;
  timestamp: string | number;
  chunkCount?: number;
  totalBytes?: number;
  alerts?: AlertPreferences;
}

/** Client-side recorder configuration */
export interface RecorderConfig {
  /** Interval between chunk emissions (ms) */
  timesliceMs: number;
  /** Video bitrate (bps) */
  videoBitsPerSecond: number;
  /** Audio bitrate (bps) */
  audioBitsPerSecond: number;
}

/**
 * Upload queue item stored in IndexedDB.
 * Uses ArrayBuffer instead of Blob to prevent iOS Safari detachment errors.
 */
export interface QueuedChunk {
  id: string;
  sessionId: string;
  sequenceNum: number;
  data: ArrayBuffer;
  sha256: string;
  recordedAt: number;
  lat: number | null;
  lng: number | null;
  retryCount: number;
}

/** App configuration stored in localStorage */
export interface WitnessConfig {
  apiUrl: string;
  authToken: string;
  alerts: AlertPreferences;
}

/** Upload statistics */
export interface UploadStats {
  uploadedChunks: number;
  failedChunks: number;
  pendingChunks: number;
  totalBytes: number;
}

/** Notification channel types */
export type NotificationChannel = 'telegram' | 'discord' | 'email' | 'sms';

/** Trusted contact for emergency alerts */
export interface TrustedContact {
  id: string;
  userId: string;
  contactType: NotificationChannel;
  contactValue: string;
  label: string;
  isActive: boolean;
}
