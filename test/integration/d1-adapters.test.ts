import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { makeD1HomeCityRepo } from "../../src/adapters/d1/home-city-repo";
import { makeD1UsageCounter } from "../../src/adapters/d1/usage-counter";
import type { Place } from "../../src/domain/place";
import { resetTables, seedDailyCount, seedHomeCity, seedLookups, timesBefore } from "./db-fixtures";

const NOW = new Date("2026-11-06T10:00:00.000Z");
const A = 100001;
const B = 100002;

const kyiv: Place = {
  name: "Kyiv",
  region: "Kyiv City",
  country: "Ukraine",
  latitude: 50.45,
  longitude: 30.52,
  timezone: "Europe/Kyiv",
};
const lviv: Place = { ...kyiv, name: "Lviv", region: "Lviv Oblast", latitude: 49.84, longitude: 24.03 };
const monaco: Place = {
  name: "Monaco",
  country: "Monaco",
  latitude: 43.73,
  longitude: 7.42,
  timezone: "Europe/Monaco",
};

async function lookupRows(chatId: number): Promise<string[]> {
  const rows = await env.DB.prepare("SELECT looked_up_at FROM lookups WHERE chat_id = ? ORDER BY looked_up_at")
    .bind(chatId)
    .all<{ looked_up_at: string }>();
  return rows.results.map((r) => r.looked_up_at);
}

async function dailyCount(day: string): Promise<number | undefined> {
  const row = await env.DB.prepare("SELECT lookup_count FROM daily_lookup_counts WHERE day = ?")
    .bind(day)
    .first<{ lookup_count: number }>();
  return row?.lookup_count;
}

async function updatedAt(chatId: number): Promise<string | undefined> {
  const row = await env.DB.prepare("SELECT updated_at FROM home_cities WHERE chat_id = ?")
    .bind(chatId)
    .first<{ updated_at: string }>();
  return row?.updated_at;
}

beforeEach(async () => {
  await resetTables(env.DB);
});

describe("D1 HomeCityRepo", () => {
  const repo = () => makeD1HomeCityRepo(env.DB);

  it("returns undefined for a chat with no Home city", async () => {
    expect(await repo().get(A)).toBeUndefined();
  });

  it("round-trips a place and stamps updated_at", async () => {
    await repo().save(A, kyiv, NOW);

    expect(await repo().get(A)).toEqual(kyiv);
    expect(await updatedAt(A)).toBe("2026-11-06T10:00:00.000Z");
  });

  it("replaces the chat's Home city, keeping one row (AC-02)", async () => {
    await repo().save(A, kyiv, NOW);
    await repo().save(A, lviv, new Date(NOW.getTime() + 60_000));

    expect(await repo().get(A)).toEqual(lviv);
    expect(await updatedAt(A)).toBe("2026-11-06T10:01:00.000Z");
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM home_cities WHERE chat_id = ?")
      .bind(A)
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it("never touches another chat's Home city (AC-14)", async () => {
    await seedHomeCity(env.DB, { chat_id: A });
    await repo().save(B, lviv, NOW);
    await repo().save(B, monaco, NOW);

    expect(await repo().get(A)).toEqual(kyiv);
    expect(await updatedAt(A)).toBe("2026-11-06T09:00:00.000Z");
    expect(await repo().get(B)).toEqual(monaco);
  });

  it("stores a missing region as NULL and reads it back as undefined", async () => {
    await repo().save(A, monaco, NOW);

    const raw = await env.DB.prepare("SELECT region FROM home_cities WHERE chat_id = ?")
      .bind(A)
      .first<{ region: string | null }>();
    expect(raw?.region).toBeNull();
    const place = await repo().get(A);
    expect(place).toEqual(monaco);
    expect(place && "region" in place).toBe(false);
  });
});

describe("D1 UsageCounter", () => {
  const counter = () => makeD1UsageCounter(env.DB);

  it("reads 0 when there is no row for today and no lookups (AC-17)", async () => {
    expect(await counter().counts(A, NOW)).toEqual({ daily: 0, chatLastHour: 0 });
  });

  it("reads today's count by UTC day key", async () => {
    await seedDailyCount(env.DB, "2026-11-05", 4000);
    await seedDailyCount(env.DB, "2026-11-06", 4999);

    expect((await counter().counts(A, NOW)).daily).toBe(4999);
  });

  it("counts a strict rolling 60 minutes: exactly 60:00 old is out, 59:59 is in (AC-16)", async () => {
    await seedLookups(env.DB, A, ["2026-11-06T09:00:00.000Z", "2026-11-06T09:00:01.000Z"]);

    expect((await counter().counts(A, NOW)).chatLastHour).toBe(1);
  });

  it("sees 30 lookups in the window, so the caller blocks the 31st (AC-16)", async () => {
    await seedLookups(env.DB, A, timesBefore(NOW, 30));

    expect((await counter().counts(A, NOW)).chatLastHour).toBe(30);
  });

  it("never counts another chat's lookups", async () => {
    await seedLookups(env.DB, B, timesBefore(NOW, 5));

    expect((await counter().counts(A, NOW)).chatLastHour).toBe(0);
  });

  it("reserve inserts today's counter row at 1, then increments it (AC-17)", async () => {
    await counter().reserve(A, NOW);
    expect(await dailyCount("2026-11-06")).toBe(1);

    await counter().reserve(B, NOW);
    expect(await dailyCount("2026-11-06")).toBe(2);
  });

  it("starts again from 0 on the next UTC day", async () => {
    await seedDailyCount(env.DB, "2026-11-06", 5000);
    const nextDay = new Date("2026-11-07T00:00:00.000Z");

    expect((await counter().counts(A, nextDay)).daily).toBe(0);
    await counter().reserve(A, nextDay);
    expect(await dailyCount("2026-11-07")).toBe(1);
    expect(await dailyCount("2026-11-06")).toBe(5000);
  });

  it("reserve logs this chat's lookup at now and prunes only this chat's rows outside the window", async () => {
    await seedLookups(env.DB, A, ["2026-11-06T08:30:00.000Z", "2026-11-06T09:00:00.000Z", "2026-11-06T09:00:01.000Z"]);
    await seedLookups(env.DB, B, ["2026-11-06T08:30:00.000Z"]);

    await counter().reserve(A, NOW);

    expect(await lookupRows(A)).toEqual(["2026-11-06T09:00:01.000Z", "2026-11-06T10:00:00.000Z"]);
    expect(await lookupRows(B)).toEqual(["2026-11-06T08:30:00.000Z"]);
    expect((await counter().counts(A, NOW)).chatLastHour).toBe(2);
  });
});
