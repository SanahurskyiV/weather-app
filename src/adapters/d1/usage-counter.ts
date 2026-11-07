import type { UsageCounter } from "../../app/ports";
import { utcDayKey, windowStart } from "../../domain/usage-limits";

const SELECT_DAILY = "SELECT lookup_count FROM daily_lookup_counts WHERE day = ?";
const COUNT_CHAT_WINDOW = "SELECT COUNT(*) AS n FROM lookups WHERE chat_id = ? AND looked_up_at > ?";
const UPSERT_DAILY =
  "INSERT INTO daily_lookup_counts (day, lookup_count) VALUES (?, 1) " +
  "ON CONFLICT(day) DO UPDATE SET lookup_count = lookup_count + 1";
const INSERT_LOOKUP = "INSERT INTO lookups (chat_id, looked_up_at) VALUES (?, ?)";
const PRUNE_CHAT = "DELETE FROM lookups WHERE chat_id = ? AND looked_up_at <= ?";

/** Per-UTC-day counter plus per-chat rolling lookup log (feature ADR-0001, data-model.md). */
export function makeD1UsageCounter(db: D1Database): UsageCounter {
  return {
    async counts(chatId, now) {
      const [daily, chat] = await db.batch<{ lookup_count?: number; n?: number }>([
        db.prepare(SELECT_DAILY).bind(utcDayKey(now)),
        db.prepare(COUNT_CHAT_WINDOW).bind(chatId, windowStart(now)),
      ]);
      return {
        daily: daily?.results[0]?.lookup_count ?? 0,
        chatLastHour: chat?.results[0]?.n ?? 0,
      };
    },

    async reserve(chatId, now) {
      // One round-trip, applied atomically (data-model.md §Reserve as one batch).
      await db.batch([
        db.prepare(UPSERT_DAILY).bind(utcDayKey(now)),
        db.prepare(INSERT_LOOKUP).bind(chatId, now.toISOString()),
        db.prepare(PRUNE_CHAT).bind(chatId, windowStart(now)),
      ]);
    },
  };
}
