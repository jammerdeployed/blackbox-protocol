import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface WitnessDB extends DBSchema {
  'witness-queue': {
    key: number;
    value: {
      id?: number;
      sessionId: string;
      sequence: number;
      chunk: Blob;
      metadata?: any;
    };
    indexes: { 'by-session': string };
  };
}

export class ChunkUploader {
  private db: IDBPDatabase<WitnessDB> | null = null;
  private isProcessing = false;

  constructor(
    private apiUrl: string,
    private token: string
  ) {
    window.addEventListener('online', () => this.processQueue());
  }

  async init() {
    this.db = await openDB<WitnessDB>('witness-store', 1, {
      upgrade(db) {
        const store = db.createObjectStore('witness-queue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-session', 'sessionId');
      }
    });
  }

  async upload(sessionId: string, sequence: number, chunk: Blob, metadata?: any) {
    if (!this.db) await this.init();
    
    const item = { sessionId, sequence, chunk, metadata };
    await this.db!.add('witness-queue', item);
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing || !this.db || !navigator.onLine) return;
    this.isProcessing = true;

    try {
      const tx = this.db.transaction('witness-queue', 'readwrite');
      const store = tx.objectStore('witness-queue');
      const items = await store.getAll();

      for (const item of items) {
        if (!navigator.onLine) break;

        const filename = `chunk-${item.sequence}.part`;
        const url = `${this.apiUrl}/api/upload/${item.sessionId}/${filename}`;
        
        try {
          const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': item.chunk.type,
            'X-Chunk-Sequence': item.sequence.toString(),
            'X-Chunk-Timestamp': Date.now().toString(),
          };

          if (item.metadata) {
            if (item.metadata.latitude) headers['X-Latitude'] = item.metadata.latitude.toString();
            if (item.metadata.longitude) headers['X-Longitude'] = item.metadata.longitude.toString();
          }

          const response = await fetch(url, {
            method: 'PUT',
            body: item.chunk,
            headers,
            keepalive: item.chunk.size < 65536,
          });

          if (response.ok) {
            const deleteTx = this.db.transaction('witness-queue', 'readwrite');
            await deleteTx.objectStore('witness-queue').delete(item.id!);
          } else {
            console.error('Upload failed with status', response.status);
          }
        } catch (error) {
          console.error('Upload error', error);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
