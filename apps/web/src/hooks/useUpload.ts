import { useState, useEffect } from 'react';
import { openDB } from 'idb';

export function useUploadStatus() {
  const [stats, setStats] = useState({ uploadedChunks: 0, failedChunks: 0, pendingChunks: 0, totalBytes: 0 });

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const db = await openDB('witness-store', 1);
        const tx = db.transaction('witness-queue', 'readonly');
        const count = await tx.objectStore('witness-queue').count();
        setStats(s => ({ ...s, pendingChunks: count }));
      } catch (err) {
        // Ignored
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return { uploadStats: stats };
}
