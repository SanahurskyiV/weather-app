-- base-logic: bot-wide lookup counter per UTC day for the 5,000/day budget (spec AC-17; feature ADR-0001).
-- Forward-only (ADR-0003); implement promotes it to migrations/NNNN_create_daily_lookup_counts.sql.
CREATE TABLE IF NOT EXISTS daily_lookup_counts (
  day          TEXT    PRIMARY KEY,
  lookup_count INTEGER NOT NULL
) STRICT;
