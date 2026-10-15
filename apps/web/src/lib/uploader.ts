import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { IDB_NAME, UPLOAD_LOCK_NAME, UPLOAD_TIMEOUT_MS } from '@blackbox-protocol/shared';
import type { AlertPreferences, UploadStats } from '@blackbox-protocol/shared';

export interface StoredChunkRecord {
  id: string; // ${sessionId}_${sequence.padStart(8, '0')}
  sessionId: string;
  sequenceNum: number;
  data: ArrayBuffer; // Stored as ArrayBuffer to prevent iOS WebKit Blob detachment bugs
  sha256: string;
  mimeType: string;
  recordedAt: number;
  lat: number | null;
  lng: number | null;
  batteryLevel: number | null;
  alerts?: AlertPreferences;
  retryCount: number;
}

interface BlackboxDB extends DBSchema {
  chunk_queue: {
    key: string;
    value: StoredChunkRecord;
    indexes: { 'by-session': string };
  };
}

export class ChunkUploader {
  private dbPromise: Promise<IDBPDatabase<BlackboxDB>>;
  private isProcessing = false;
  private hasPendingWork = false; // Prevents Lost Wakeup race conditions in Web Locks
  private activeSessionId: string | null = null;
  private lastKnownMeta: any = null;

  public onError?: (err: string) => void;
  public onStatsChange?: (stats: UploadStats) => void;

  private stats: UploadStats = {
    uploadedChunks: 0,
    failedChunks: 0,
    pendingChunks: 0,
    totalBytes: 0,
  };

  constructor(
    private apiBaseUrl: string,
    private token: string
  ) {
    this.apiBaseUrl = this.apiBaseUrl.replace(/\/+$/, '');
    this.token = this.token.trim();

    this.dbPromise = openDB<BlackboxDB>(IDB_NAME, 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('chunk_queue')) {
          const store = db.createObjectStore('chunk_queue', { keyPath: 'id' });
          store.createIndex('by-session', 'sessionId');
        }
      },
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.triggerFlush());

      // CRITICAL FOR iOS WEBKIT: Screen lock & backgrounding detection
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.handleEmergencySuspend('VISIBILITY_HIDDEN');
        } else if (document.visibilityState === 'visible') {
          this.triggerFlush();
        }
      });

      // Browser tab closed / PWA process termination
      window.addEventListener('pagehide', () => {
        this.handleEmergencySuspend('PAGE_HIDE');
      });

      // Periodic background heartbeat sync
      setInterval(() => {
        if (!this.isProcessing) {
          this.triggerFlush();
        }
      }, 10_000);
    }
  }

  public setCredentials(apiUrl: string, token: string) {
    this.apiBaseUrl = apiUrl.replace(/\/+$/, '');
    this.token = token.trim();
  }

  /**
   * OS-level beacon for urgent state persistence before WebKit process freezing.
   * sendBeacon survives screen lock and app switching.
   */
  private handleEmergencySuspend(reason: string): void {
    if (!this.activeSessionId || typeof navigator === 'undefined' || !navigator.sendBeacon) return;

    const payload = JSON.stringify({
      reason,
      timestamp: Date.now(),
      lat: this.lastKnownMeta?.latitude ?? null,
      lng: this.lastKnownMeta?.longitude ?? null,
      batteryLevel: this.lastKnownMeta?.batteryLevel ?? null,
    });

    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(
      `${this.apiBaseUrl}/api/session/${this.activeSessionId}/beacon?token=${encodeURIComponent(this.token)}`,
      blob
    );

    // Flush any remaining memory chunks during the remaining ~500ms CPU execution window
    this.triggerFlush();
  }

  private formatKey(sessionId: string, seq: number): string {
    return `${sessionId}_${seq.toString().padStart(8, '0')}`;
  }

  /**
   * Enqueues a chunk immediately to disk (IndexedDB) as ArrayBuffer,
   * then triggers an asynchronous flush.
   */
  async upload(
    sessionId: string,
    sequence: number,
    chunk: Blob,
    metadata?: {
      latitude?: number;
      longitude?: number;
      batteryLevel?: number;
      alerts?: AlertPreferences;
      mimeType?: string;
    }
  ): Promise<void> {
    if (!chunk || chunk.size === 0) return;

    this.activeSessionId = sessionId;
    if (metadata) this.lastKnownMeta = metadata;

    try {
      // 1. Convert to ArrayBuffer in memory (avoids WebKit Blob detachment bug)
      const arrayBuffer = await chunk.arrayBuffer();
      if (arrayBuffer.byteLength === 0) return;

      // 2. Compute cryptographic SHA-256 hash for tamper evidence and write-once idempotency
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const sha256 = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const rawType = metadata?.mimeType || chunk.type || 'video/mp4';
      const cleanType = rawType.includes('webm') ? 'video/webm' : 'video/mp4';

      const record: StoredChunkRecord = {
        id: this.formatKey(sessionId, sequence),
        sessionId,
        sequenceNum: sequence,
        data: arrayBuffer,
        sha256,
        mimeType: cleanType,
        recordedAt: Date.now(),
        lat: metadata?.latitude ?? null,
        lng: metadata?.longitude ?? null,
        batteryLevel: metadata?.batteryLevel ?? null,
        alerts: metadata?.alerts,
        retryCount: 0,
      };

      const db = await this.dbPromise;
      await db.put('chunk_queue', record);

      this.updateStats({
        pendingChunks: this.stats.pendingChunks + 1,
        totalBytes: this.stats.totalBytes + arrayBuffer.byteLength,
      });

      // 3. Trigger immediate queue flush without waiting for navigator.onLine
      this.triggerFlush();
    } catch (err: any) {
      console.error('Failed to enqueue chunk:', err);
      if (this.onError) this.onError(err.message || String(err));
    }
  }

  /**
   * Concurrency-safe queue flush using Web Locks API and Lost Wakeup loop protection.
   */
  public async triggerFlush(): Promise<void> {
    if (typeof navigator === 'undefined') return;

    // Mark pending work so any currently finishing loop will process newly added items
    this.hasPendingWork = true;

    if (!navigator.locks) {
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        while (this.hasPendingWork) {
          this.hasPendingWork = false;
          await this.processQueue();
        }
      } finally {
        this.isProcessing = false;
      }
      return;
    }

    await navigator.locks.request(
      UPLOAD_LOCK_NAME,
      { ifAvailable: true },
      async (lock) => {
        if (!lock) return; // Active lock will read this.hasPendingWork = true
        this.isProcessing = true;
        try {
          while (this.hasPendingWork) {
            this.hasPendingWork = false;
            await this.processQueue();
          }
        } finally {
          this.isProcessing = false;
        }
      }
    );
  }

  private async processQueue(): Promise<void> {
    const db = await this.dbPromise;

    while (true) {
      const tx = db.transaction('chunk_queue', 'readonly');
      const cursor = await tx.store.openCursor();
      const item = cursor?.value;
      await tx.done;

      if (!item) break; // Queue empty

      const success = await this.sendSingleChunk(item);
      if (success) {
        await db.delete('chunk_queue', item.id);
        this.updateStats({
          uploadedChunks: this.stats.uploadedChunks + 1,
          pendingChunks: Math.max(0, this.stats.pendingChunks - 1),
        });
      } else {
        item.retryCount += 1;
        await db.put('chunk_queue', item);
        this.updateStats({
          failedChunks: this.stats.failedChunks + 1,
        });

        // Abort outer loop to prevent tight retry spin on persistent network errors
        this.hasPendingWork = false;
        const backoffMs = Math.min(1000 * Math.pow(1.5, item.retryCount), 10_000);
        setTimeout(() => this.triggerFlush(), backoffMs);
        break;
      }
    }
  }

  private async sendSingleChunk(chunk: StoredChunkRecord): Promise<boolean> {
    const filename = `chunk-${chunk.sequenceNum}.part`;
    const url = `${this.apiBaseUrl}/api/upload/${chunk.sessionId}/${filename}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': chunk.mimeType,
        'X-Chunk-Sequence': chunk.sequenceNum.toString(),
        'X-Chunk-Timestamp': chunk.recordedAt.toString(),
        'X-Chunk-SHA256': chunk.sha256,
      };

      if (chunk.lat !== null) headers['X-Latitude'] = chunk.lat.toString();
      if (chunk.lng !== null) headers['X-Longitude'] = chunk.lng.toString();
      if (chunk.batteryLevel !== null) headers['X-Battery-Level'] = chunk.batteryLevel.toString();
      if (chunk.alerts) headers['X-Alert-Preferences'] = JSON.stringify(chunk.alerts);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: chunk.data,
        signal: controller.signal,
        // Keepalive flag allowed for chunks below 60 KB to survive iOS screen locks
        keepalive: chunk.data.byteLength < 60_000,
      });

      // 200/201 = Successfully stored, 409 = Conflict / Idempotent already stored
      if (response.ok || response.status === 409) {
        return true;
      }

      const errJson = await response.json().catch(() => ({ error: response.statusText }));
      const errMsg = `Upload error (${response.status}): ${errJson.error || response.statusText}`;
      console.warn(errMsg);
      if (this.onError) this.onError(errMsg);
      return false;
    } catch (error: any) {
      console.warn('Network upload error (queued for retry):', error.message || error);
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async finalizeSession(sessionId: string): Promise<boolean> {
    const url = `${this.apiBaseUrl}/api/session/${sessionId}/finalize`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (e) {
      console.warn('Finalize request failed:', e);
      return false;
    }
  }

  private updateStats(partial: Partial<UploadStats>) {
    this.stats = { ...this.stats, ...partial };
    if (this.onStatsChange) {
      this.onStatsChange({ ...this.stats });
    }
  }

  public getStats(): UploadStats {
    return { ...this.stats };
  }
}
