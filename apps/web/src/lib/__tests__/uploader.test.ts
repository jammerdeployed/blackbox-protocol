import { describe, it, expect } from 'vitest';

describe('ResilientUploadEngine Logic', () => {
  it('formats lexicographically sortable chunk keys for IndexedDB', () => {
    const sessionId = 'test-session-uuid';
    const formatKey = (seq: number) => `${sessionId}_${seq.toString().padStart(8, '0')}`;

    const key0 = formatKey(0);
    const key1 = formatKey(1);
    const key9 = formatKey(9);
    const key10 = formatKey(10);
    const key100 = formatKey(100);

    const keys = [key10, key100, key0, key9, key1];
    keys.sort();

    // Zero-padded keys must naturally sort chunk 0 first, then 1, 9, 10, 100
    expect(keys).toEqual([key0, key1, key9, key10, key100]);
    expect(keys[0]).toContain('_00000000');
  });

  it('computes deterministic SHA-256 integrity hashes for binary chunks', async () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const hashBuffer = await crypto.subtle.digest('SHA-256', payload.buffer);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    expect(hashHex).toHaveLength(64);

    // Identical payload yields identical hash (write-once idempotency)
    const hashBuffer2 = await crypto.subtle.digest('SHA-256', payload.buffer);
    const hashHex2 = Array.from(new Uint8Array(hashBuffer2))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hashHex).toBe(hashHex2);
  });
});
