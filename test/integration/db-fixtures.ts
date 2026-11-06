// Seed helpers for the base-logic tables (data-model.md §Test fixtures). Chat ids are synthetic (1000NN).

export interface HomeCityRow {
  chat_id: number;
  name: string;
  region: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  updated_at: string;
}

export const KYIV_ROW: HomeCityRow = {
  chat_id: 100001,
  name: "Kyiv",
  region: "Kyiv City",
  country: "Ukraine",
  latitude: 50.45,
  longitude: 30.52,
  timezone: "Europe/Kyiv",
  updated_at: "2026-11-06T09:00:00.000Z",
};

/** Empties the three base-logic tables so counters never leak between tests. */
export async function resetTables(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM home_cities"),
    db.prepare("DELETE FROM lookups"),
    db.prepare("DELETE FROM daily_lookup_counts"),
  ]);
}

export async function seedHomeCity(db: D1Database, overrides: Partial<HomeCityRow> = {}): Promise<HomeCityRow> {
  const row = { ...KYIV_ROW, ...overrides };
  await db
    .prepare(
      `INSERT INTO home_cities (chat_id, name, region, country, latitude, longitude, timezone, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.chat_id, row.name, row.region, row.country, row.latitude, row.longitude, row.timezone, row.updated_at)
    .run();
  return row;
}

export async function seedLookups(db: D1Database, chatId: number, times: readonly string[]): Promise<void> {
  if (times.length === 0) return;
  const insert = db.prepare("INSERT INTO lookups (chat_id, looked_up_at) VALUES (?, ?)");
  await db.batch(times.map((time) => insert.bind(chatId, time)));
}

export async function seedDailyCount(db: D1Database, day: string, count: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO daily_lookup_counts (day, lookup_count) VALUES (?, ?) " +
        "ON CONFLICT(day) DO UPDATE SET lookup_count = excluded.lookup_count",
    )
    .bind(day, count)
    .run();
}

/** `count` ISO times one second apart, the newest `newestSecondsAgo` seconds before `now`. */
export function timesBefore(now: Date, count: number, newestSecondsAgo = 1): string[] {
  return Array.from({ length: count }, (_, i) => new Date(now.getTime() - (newestSecondsAgo + i) * 1000).toISOString());
}
