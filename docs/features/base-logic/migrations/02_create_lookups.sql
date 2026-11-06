-- base-logic: per-chat lookup log for the rolling 60-minute cap (spec AC-16; feature ADR-0001).
-- Rows are pruned per chat once older than 60 minutes. No FK to home_cities: a chat is counted
-- before it has a Home city. Forward-only (ADR-0003); implement promotes it to migrations/NNNN_create_lookups.sql.
CREATE TABLE IF NOT EXISTS lookups (
  id           INTEGER PRIMARY KEY,
  chat_id      INTEGER NOT NULL,
  looked_up_at TEXT    NOT NULL
) STRICT;

-- Serves: COUNT(*) WHERE chat_id = ? AND looked_up_at > ?  and  DELETE WHERE chat_id = ? AND looked_up_at <= ?
CREATE INDEX IF NOT EXISTS idx_lookups_chat_id_looked_up_at ON lookups (chat_id, looked_up_at);
