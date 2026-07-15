-- Charter invariants 1-2: a stored record is a body shell (blueprint) plus
-- its champion brains, stored once per lineage - never a per-creature body
-- snapshot. Replaces the per-family `champions` table (kept, unused, for
-- manual inspection/rollback; drop it once the new table is confirmed live).
CREATE TABLE lineages (
  lineage_id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  generation INTEGER NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
