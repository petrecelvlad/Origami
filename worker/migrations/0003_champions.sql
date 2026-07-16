-- Owner request (2026-07-16): each family champion as its own row, not
-- nested inside the lineage payload. The body-shell blueprint still lives
-- exactly once, in `lineages` — this table only ever holds a brain + identity
-- per row (Charter invariants 1-2), referencing its project by lineage_id.
CREATE TABLE champions (
  lineage_id TEXT NOT NULL,
  family TEXT NOT NULL,
  generation INTEGER NOT NULL,
  fitness REAL NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (lineage_id, family)
);
