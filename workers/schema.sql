DROP TABLE IF EXISTS chunks;
DROP TABLE IF EXISTS sessions;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INTERRUPTED','COMPLETED','CORRUPTED')),
  mime_type TEXT NOT NULL DEFAULT 'video/mp4',
  created_at INTEGER NOT NULL,
  last_heartbeat_at INTEGER NOT NULL,
  finalized_at INTEGER,
  contiguous_seq INTEGER NOT NULL DEFAULT -1,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  last_lat REAL,
  last_lng REAL,
  last_accuracy REAL,
  battery_level REAL,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence_num INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  byte_offset INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  uploaded_at INTEGER NOT NULL,
  lat REAL,
  lng REAL,
  UNIQUE(session_id, sequence_num)
);

CREATE INDEX IF NOT EXISTS idx_status_heartbeat ON sessions(status, last_heartbeat_at);
