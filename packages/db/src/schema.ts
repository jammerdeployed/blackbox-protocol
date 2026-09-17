import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const sessionStatusEnum = ['ACTIVE', 'INTERRUPTED', 'COMPLETED', 'CORRUPTED'] as const;
export type SessionStatus = (typeof sessionStatusEnum)[number];

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    status: text('status', { enum: sessionStatusEnum }).notNull().default('ACTIVE'),
    mimeType: text('mime_type').notNull().default('video/mp4'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    lastHeartbeatAt: integer('last_heartbeat_at', { mode: 'timestamp_ms' }).notNull(),
    finalizedAt: integer('finalized_at', { mode: 'timestamp_ms' }),
    contiguousSeq: integer('contiguous_seq').notNull().default(-1),
    totalChunks: integer('total_chunks').notNull().default(0),
    totalBytes: integer('total_bytes').notNull().default(0),
    lastLat: real('last_lat'),
    lastLng: real('last_lng'),
    lastAccuracy: real('last_accuracy'),
    batteryLevel: real('battery_level'),
    metadata: text('metadata'),
  },
  (table) => ({
    statusHeartbeatIdx: index('idx_status_heartbeat').on(table.status, table.lastHeartbeatAt),
  })
);

export const chunks = sqliteTable(
  'chunks',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    sequenceNum: integer('sequence_num').notNull(),
    r2Key: text('r2_key').notNull(),
    byteLength: integer('byte_length').notNull(),
    byteOffset: integer('byte_offset').notNull().default(0),
    sha256: text('sha256').notNull(),
    recordedAt: integer('recorded_at', { mode: 'timestamp_ms' }).notNull(),
    uploadedAt: integer('uploaded_at', { mode: 'timestamp_ms' }).notNull(),
    lat: real('lat'),
    lng: real('lng'),
  },
  (table) => ({
    sessionSeqUnique: uniqueIndex('unq_session_seq').on(table.sessionId, table.sequenceNum),
    sessionSeqIdx: index('idx_chunks_session').on(table.sessionId, table.sequenceNum),
  })
);

export type SessionRecord = typeof sessions.$inferSelect;
export type NewSessionRecord = typeof sessions.$inferInsert;
export type ChunkRecord = typeof chunks.$inferSelect;
export type NewChunkRecord = typeof chunks.$inferInsert;
