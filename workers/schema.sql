CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'recording' CHECK(status IN ('recording','finalizing','complete','failed')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  latitude REAL,
  longitude REAL,
  mime_type TEXT DEFAULT 'video/webm',
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence_num INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, sequence_num)
);

CREATE INDEX idx_chunks_session ON chunks(session_id, sequence_num);
CREATE INDEX idx_sessions_status ON sessions(status);
