// ─────────────────────────────────────────────────
// Blackbox Protocol — Shared Types
// ─────────────────────────────────────────────────

/** Status of a recording session */
export type SessionStatus = 'recording' | 'finalizing' | 'complete' | 'failed';

/** A recording session */
export interface Session {
  id: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  chunkCount: number;
  totalBytes: number;
  latitude: number | null;
  longitude: number | null;
  mimeType: string;
  metadata: Record<string, unknown>;
}

/** A single recorded chunk */
export interface Chunk {
  id: string;
  sessionId: string;
  sequenceNum: number;
  r2Key: string;
  sizeBytes: number;
  uploadedAt: string;
}

/** Geolocation coordinates */
export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/** Alert payload sent between workers */
export interface AlertPayload {
  type: 'session_started' | 'session_completed';
  sessionId: string;
  latitude?: number | null;
  longitude?: number | null;
  timestamp: string;
  chunkCount?: number;
  totalBytes?: number;
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

/** Upload queue item stored in IndexedDB */
export interface QueuedChunk {
  id: string;
  sessionId: string;
  sequence: number;
  blob: Blob;
  timestamp: number;
  retries: number;
  latitude?: number;
  longitude?: number;
}

/** App configuration stored in localStorage */
export interface WitnessConfig {
  apiUrl: string;
  authToken: string;
  telegramChatId?: string;
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
