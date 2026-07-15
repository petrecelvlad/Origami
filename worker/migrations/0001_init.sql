CREATE TABLE champions (
  family TEXT PRIMARY KEY,
  generation INTEGER NOT NULL,
  fitness REAL NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
