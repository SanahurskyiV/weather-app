import { describe, expect, it } from "vitest";
import type { CityQuery } from "../domain/city-query";
import type { Place, PlaceCandidate } from "../domain/place";
import { err, ok, type Result } from "../domain/result";
import type { Clock, HomeCityRepo, PlaceLookup, UsageCounter } from "./ports";
import { makeSetHomeCity } from "./set-home-city";

const NOW = new Date("2026-11-06T10:00:00.000Z");
const CHAT = 100001;

const kyiv: Place = {
  name: "Kyiv",
  region: "Kyiv City",
  country: "Ukraine",
  latitude: 50.45,
  longitude: 30.52,
  timezone: "Europe/Kyiv",
};
const lviv: Place = { ...kyiv, name: "Lviv", region: "Lviv Oblast", latitude: 49.84, longitude: 24.03 };
const parisFr: PlaceCandidate = {
  name: "Paris",
  region: "Île-de-France",
  country: "France",
  latitude: 48.85,
  longitude: 2.35,
  timezone: "Europe/Paris",
  featureCode: "PPLC",
  population: 2_138_551,
};
const parisTx: PlaceCandidate = {
  ...parisFr,
  region: "Texas",
  country: "United States",
  timezone: "America/Chicago",
  featureCode: "PPLA2",
  population: 24_171,
};
const ileDeFrance: PlaceCandidate = { ...parisFr, name: "Île-de-France", featureCode: "ADM1", population: 12_000_000 };

interface Setup {
  current?: Place;
  daily?: number;
  chatLastHour?: number;
  found?: Result<PlaceCandidate[], "unavailable">;
}

function setup({ current, daily = 0, chatLastHour = 0, found = ok([parisFr]) }: Setup = {}) {
  const calls: string[] = [];
  const queries: CityQuery[] = [];
  const saved: { chatId: number; place: Place; at: Date }[] = [];
  const reserved: { chatId: number; now: Date }[] = [];
  let nowCalls = 0;

  const repo: HomeCityRepo = {
    get(chatId) {
      calls.push(`repo.get(${String(chatId)})`);
      return Promise.resolve(chatId === CHAT ? current : undefined);
    },
    save(chatId, place, at) {
      calls.push("repo.save");
      saved.push({ chatId, place, at });
      return Promise.resolve();
    },
  };
  const counter: UsageCounter = {
    counts() {
      calls.push("counter.counts");
      return Promise.resolve({ daily, chatLastHour });
    },
    reserve(chatId, now) {
      calls.push("counter.reserve");
      reserved.push({ chatId, now });
      return Promise.resolve();
    },
  };
  const lookup: PlaceLookup = {
    find(query) {
      calls.push("lookup.find");
      queries.push(query);
      return Promise.resolve(found);
    },
  };
  const clock: Clock = {
    now() {
      nowCalls++;
      return NOW;
    },
  };

  const setHomeCity = makeSetHomeCity({ repo, counter, lookup, clock });
  return { setHomeCity, calls, queries, saved, reserved, nowCalls: () => nowCalls };
}

describe("setHomeCity", () => {
  it("runs parse → load → limits → reserve → lookup → save and returns the best match (AC-01, AC-06)", async () => {
    const t = setup({ found: ok([parisTx, ileDeFrance, parisFr]) });

    const result = await t.setHomeCity(CHAT, "Paris");

    expect(result).toEqual(ok({ place: expect.objectContaining({ country: "France" }) as Place, ambiguous: true }));
    expect(t.calls).toEqual([
      `repo.get(${String(CHAT)})`,
      "counter.counts",
      "counter.reserve",
      "lookup.find",
      "repo.save",
    ]);
    expect(t.queries).toEqual([{ name: "Paris" }]);
    expect(t.saved).toEqual([
      { chatId: CHAT, place: expect.objectContaining({ name: "Paris", country: "France" }) as Place, at: NOW },
    ]);
  });

  it("replaces the current Home city (AC-02)", async () => {
    const t = setup({ current: kyiv, found: ok([{ ...lviv, featureCode: "PPLA", population: 717_000 }]) });

    const result = await t.setHomeCity(CHAT, "Lviv");

    expect(result).toEqual(ok({ place: lviv, ambiguous: false }));
    expect(t.saved.map((s) => s.place)).toEqual([lviv]);
  });

  it("passes the country filter to the lookup (AC-07)", async () => {
    const t = setup({ found: ok([parisTx]) });

    await t.setHomeCity(CHAT, "Paris, US");

    expect(t.queries).toEqual([{ name: "Paris", countryCode: "US" }]);
  });

  it.each([
    ["", "blank"],
    ["   ", "blank"],
    ["a".repeat(101), "too_long"],
    ["Paris, Texas", "unknown_country"],
  ])("refuses %j as %s with no counting and no lookup (AC-03, AC-04, AC-16)", async (text, kind) => {
    const t = setup({ current: kyiv });

    expect(await t.setHomeCity(CHAT, text)).toEqual(err({ kind }));
    expect(t.calls.filter((c) => c.startsWith("counter") || c.startsWith("lookup") || c === "repo.save")).toEqual([]);
  });

  it.each([
    [5000, 0, "daily_limit"],
    [0, 30, "user_limit"],
    [5000, 30, "daily_limit"],
  ])("daily %i, chat %i → %s, with no reserve and no lookup (AC-16, AC-17)", async (daily, chatLastHour, kind) => {
    const t = setup({ current: kyiv, daily, chatLastHour });

    expect(await t.setHomeCity(CHAT, "Paris")).toEqual(err({ kind }));
    expect(t.calls).not.toContain("counter.reserve");
    expect(t.calls).not.toContain("lookup.find");
    expect(t.saved).toEqual([]);
  });

  it("allows the 30th lookup in the window (chat at 29) and the 5,000th of the day (daily at 4,999)", async () => {
    const t = setup({ daily: 4999, chatLastHour: 29 });

    expect((await t.setHomeCity(CHAT, "Paris")).ok).toBe(true);
    expect(t.reserved).toEqual([{ chatId: CHAT, now: NOW }]);
  });

  it("reports an unavailable lookup with the current Home city, keeps the reservation, saves nothing (AC-04b, AC-05, AC-17)", async () => {
    const t = setup({ current: kyiv, found: err("unavailable") });

    expect(await t.setHomeCity(CHAT, "Paris")).toEqual(err({ kind: "unavailable", current: kyiv }));
    expect(t.reserved).toHaveLength(1);
    expect(t.saved).toEqual([]);
  });

  it("reports no match with the current Home city when only regions or countries come back (AC-05, AC-06)", async () => {
    const t = setup({ current: kyiv, found: ok([ileDeFrance]) });

    expect(await t.setHomeCity(CHAT, "Île-de-France")).toEqual(err({ kind: "not_found", current: kyiv }));
    expect(t.saved).toEqual([]);
  });

  it("never falls back to another country when the filtered lookup is empty (AC-07)", async () => {
    const t = setup({ current: kyiv, found: ok([]) });

    expect(await t.setHomeCity(CHAT, "Paris, Japan")).toEqual(err({ kind: "not_found", current: kyiv }));
    expect(t.queries).toEqual([{ name: "Paris", countryCode: "JP" }]);
    expect(t.calls.filter((c) => c === "lookup.find")).toHaveLength(1);
  });

  it("carries no current city when the chat has none and the lookup fails", async () => {
    const t = setup({ found: err("unavailable") });

    expect(await t.setHomeCity(CHAT, "Paris")).toEqual(err({ kind: "unavailable" }));
  });

  it("reads the clock once and uses it for the reservation and updated_at", async () => {
    const t = setup();

    await t.setHomeCity(CHAT, "Paris");

    expect(t.nowCalls()).toBe(1);
    expect(t.reserved[0]?.now).toBe(NOW);
    expect(t.saved[0]?.at).toBe(NOW);
  });
});
