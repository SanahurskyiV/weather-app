-- Migration number: 0004 	 create_daily_lookup_counts
-- base-logic: bot-wide lookup counter per UTC day for the 5,000/day budget (spec AC-17; feature ADR-0001).
-- Forward-only (ADR-0003).
CREATE TABLE IF NOT EXISTS daily_lookup_counts (
  day          TEXT    PRIMARY KEY,
  lookup_count INTEGER NOT NULL
) STRICT;
