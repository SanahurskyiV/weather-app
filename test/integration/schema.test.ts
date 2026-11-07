import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// T1: the three base-logic tables exist after the migrations, and home_cities holds one row per chat.

async function schemaNames(type: "table" | "index"): Promise<string[]> {
  const rows = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = ?").bind(type).all<{ name: string }>();
  return rows.results.map((r) => r.name);
}

function upsertHomeCity(chatId: number, name: string, updatedAt: string) {
  return env.DB.prepare(
    `INSERT INTO home_cities (chat_id, name, region, country, latitude, longitude, timezone, updated_at)
     VALUES (?, ?, NULL, 'Ukraine', 50.45, 30.52, 'Europe/Kyiv', ?)
     ON CONFLICT(chat_id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
  )
    .bind(chatId, name, updatedAt)
    .run();
}

describe("base-logic schema", () => {
  it("applies the three migrations in order", async () => {
    const applied = await env.DB.prepare("SELECT name FROM d1_migrations ORDER BY id").all<{ name: string }>();
    expect(applied.results.map((r) => r.name)).toEqual([
      "0001_init.sql",
      "0002_create_home_cities.sql",
      "0003_create_lookups.sql",
      "0004_create_daily_lookup_counts.sql",
    ]);
  });

  it("creates the three tables and the lookups index", async () => {
    expect(await schemaNames("table")).toEqual(
      expect.arrayContaining(["home_cities", "lookups", "daily_lookup_counts"]),
    );
    expect(await schemaNames("index")).toContain("idx_lookups_chat_id_looked_up_at");
  });

  it("keeps one Home city row per chat and replaces it on upsert", async () => {
    await upsertHomeCity(100001, "Kyiv", "2026-11-06T10:00:00.000Z");
    await upsertHomeCity(100001, "Lviv", "2026-11-06T10:05:00.000Z");
    await upsertHomeCity(100002, "Paris", "2026-11-06T10:06:00.000Z");

    const rows = await env.DB.prepare("SELECT chat_id, name FROM home_cities ORDER BY chat_id").all<{
      chat_id: number;
      name: string;
    }>();
    expect(rows.results).toEqual([
      { chat_id: 100001, name: "Lviv" },
      { chat_id: 100002, name: "Paris" },
    ]);
  });

  it("rejects a non-integer chat id (STRICT table)", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO home_cities (chat_id, name, country, latitude, longitude, timezone, updated_at)
         VALUES ('abc', 'X', 'Y', 0, 0, 'UTC', '2026-11-06T10:00:00.000Z')`,
      ).run(),
    ).rejects.toThrow(/SQLITE_MISMATCH/);
  });
});
