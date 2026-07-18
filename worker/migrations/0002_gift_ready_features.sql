CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS occasions (
  id TEXT PRIMARY KEY,
  occasion_date TEXT NOT NULL CHECK (occasion_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('birthday', 'milestone', 'celebration', 'custom')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS occasions_date_idx ON occasions (occasion_date ASC, created_at ASC);
