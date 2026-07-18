PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('parent', 'guest')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS guest_invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_invites_one_active_idx
  ON guest_invites ((1)) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  memory_date TEXT NOT NULL CHECK (memory_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  caption TEXT,
  image_key TEXT NOT NULL UNIQUE,
  image_type TEXT NOT NULL,
  image_alt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS entries_memory_date_idx ON entries (memory_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS album_entries (
  album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (album_id, entry_id),
  UNIQUE (album_id, position)
);

CREATE INDEX IF NOT EXISTS album_entries_entry_idx ON album_entries (entry_id);
