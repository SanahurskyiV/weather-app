/** Lookups the whole bot may make for Bot user requests per UTC day (AC-17). */
export const DAILY_LOOKUP_BUDGET = 5000;

/** Lookups one chat may make in any rolling 60 minutes (AC-16). */
export const USER_LOOKUPS_PER_HOUR = 30;

const WINDOW_MS = 60 * 60 * 1000;

export type LimitVerdict = "ok" | "daily_limit" | "user_limit";

/** The daily budget is checked first, so a Bot user over both limits gets the daily reply (AC-17). */
export function checkLimits(dailyCount: number, chatCountLastHour: number): LimitVerdict {
  if (dailyCount >= DAILY_LOOKUP_BUDGET) return "daily_limit";
  if (chatCountLastHour >= USER_LOOKUPS_PER_HOUR) return "user_limit";
  return "ok";
}

/** UTC day key "YYYY-MM-DD" for the bot-wide counter. */
export function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Start of the rolling window; a lookup counts when its time is strictly after this. */
export function windowStart(now: Date): string {
  return new Date(now.getTime() - WINDOW_MS).toISOString();
}
