-- base-logic: one Home city per private chat (spec AC-01, AC-02, AC-14; SAD §5 HomeCityRepo).
-- Forward-only (ADR-0003). Staged by sdd:data-model; implement promotes it to migrations/NNNN_create_home_cities.sql.
CREATE TABLE IF NOT EXISTS home_cities (
  chat_id    INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL,
  region     TEXT,
  country    TEXT    NOT NULL,
  latitude   REAL    NOT NULL,
  longitude  REAL    NOT NULL,
  timezone   TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
) STRICT;
