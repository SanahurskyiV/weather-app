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
  id: 2988507,
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
  id: 4717560,
};
const kyivUk: PlaceCandidate = {
  ...kyiv,
  id: 703448,
  name: "Київ",
  region: "Місто Київ",
  country: "Україна",
  featureCode: "PPLC",
  population: 2_952_301,
};
const ileDeFrance: PlaceCandidate = { ...parisFr, name: "Île-de-France", featureCode: "ADM1", population: 12_000_000 };

interface Setup {
  current?: Place;
  daily?: number;
  chatLastHour?: number;
  found?: Result<PlaceCandidate[], "unavailable">;
  byId?: Result<Place, "unavailable">;
}

function setup({ current, daily = 0, chatLastHour = 0, found = ok([parisFr]), byId = ok(kyiv) }: Setup = {}) {
  const calls: string[] = [];
  const queries: CityQuery[] = [];
  const languages: string[] = [];
  const ids: number[] = [];
  let lookups = 0;
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
      // Reservations made earlier in the same request count, like the real counter.
      return Promise.resolve({ daily: daily + reserved.length, chatLastHour: chatLastHour + reserved.length });
    },
    reserve(chatId, now) {
      calls.push("counter.reserve");
      reserved.push({ chatId, now });
      return Promise.resolve();
    },
  };
  const lookup: PlaceLookup = {
    find(query, language) {
      calls.push("lookup.find");
      queries.push(query);
      languages.push(language);
      return Promise.resolve(found);
    },
    findById(id) {
      calls.push("lookup.findById");
      ids.push(id);
      return Promise.resolve(byId);
    },
  };
  const clock: Clock = {
    now() {
      nowCalls++;
      return NOW;
    },
  };

  const run = makeSetHomeCity({ repo, counter, lookup, clock });
  const setHomeCity = (chatId: number, text: string) =>
    run(chatId, text, () => {
      lookups++;
    });
  return {
    setHomeCity,
    calls,
    queries,
    languages,
    ids,
    saved,
    reserved,
    nowCalls: () => nowCalls,
    lookups: () => lookups,
  };
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
    const t = setup({ current: kyiv, found: ok([{ ...lviv, id: 702550, featureCode: "PPLA", population: 717_000 }]) });

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
  ])("refuses %j as %s with no read, no counting and no lookup (AC-03, AC-16)", async (text, kind) => {
    const t = setup({ current: kyiv });

    expect(await t.setHomeCity(CHAT, text)).toEqual(err({ kind }));
    expect(t.calls).toEqual([]);
  });

  it.each([
    ["a".repeat(101), "too_long"],
    ["Paris, Texas", "unknown_country"],
  ])(
    "refuses %j as %s with the current Home city, no counting and no lookup (AC-04, AC-05, AC-07, AC-16)",
    async (text, kind) => {
      const t = setup({ current: kyiv });

      expect(await t.setHomeCity(CHAT, text)).toEqual(err({ kind, current: kyiv }));
      expect(t.calls).toEqual([`repo.get(${String(CHAT)})`]);
    },
  );

  it("refuses an unknown country without a current Home city when none is set (AC-07)", async () => {
    const t = setup();

    expect(await t.setHomeCity(CHAT, "Paris, Texas")).toEqual(err({ kind: "unknown_country" }));
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
  it("searches a Latin name once, in English, and reports one lookup", async () => {
    const t = setup();

    await t.setHomeCity(CHAT, "Paris");

    expect(t.languages).toEqual(["en"]);
    expect(t.calls).not.toContain("lookup.findById");
    expect(t.lookups()).toBe(1);
  });

  it("reports no lookups for a refused query", async () => {
    const t = setup();

    await t.setHomeCity(CHAT, "   ");

    expect(t.lookups()).toBe(0);
  });

  it("resolves a non-Latin name with a localized search, then an English re-fetch by id (AC-01)", async () => {
    const t = setup({ found: ok([kyivUk]), byId: ok(kyiv) });

    const result = await t.setHomeCity(CHAT, "Київ");

    expect(result).toEqual(ok({ place: kyiv, ambiguous: false }));
    expect(t.queries).toEqual([{ name: "Київ" }]);
    expect(t.languages).toEqual(["uk"]);
    expect(t.ids).toEqual([703448]);
    expect(t.saved.map((s) => s.place)).toEqual([kyiv]);
    expect(t.calls).toEqual([
      `repo.get(${String(CHAT)})`,
      "counter.counts",
      "counter.reserve",
      "lookup.find",
      "counter.counts",
      "counter.reserve",
      "lookup.findById",
      "repo.save",
    ]);
    expect(t.lookups()).toBe(2);
  });

  it("skips the re-fetch when the localized search finds no populated place (AC-05)", async () => {
    const t = setup({ current: lviv, found: ok([]) });

    expect(await t.setHomeCity(CHAT, "Київ")).toEqual(err({ kind: "not_found", current: lviv }));
    expect(t.calls).not.toContain("lookup.findById");
    expect(t.lookups()).toBe(1);
  });

  it("reports a failed re-fetch as unavailable, counts both calls and saves nothing (AC-04b, AC-17)", async () => {
    const t = setup({ current: lviv, found: ok([kyivUk]), byId: err("unavailable") });

    expect(await t.setHomeCity(CHAT, "Київ")).toEqual(err({ kind: "unavailable", current: lviv }));
    expect(t.reserved).toHaveLength(2);
    expect(t.saved).toEqual([]);
    expect(t.lookups()).toBe(2);
  });

  it("refuses the re-fetch when the first call used the chat's last lookup (AC-16)", async () => {
    const t = setup({ current: lviv, chatLastHour: 29, found: ok([kyivUk]) });

    expect(await t.setHomeCity(CHAT, "Київ")).toEqual(err({ kind: "user_limit" }));
    expect(t.reserved).toHaveLength(1);
    expect(t.calls).not.toContain("lookup.findById");
    expect(t.saved).toEqual([]);
    expect(t.lookups()).toBe(1);
  });

  it("refuses the re-fetch when the first call used the bot's last daily lookup (AC-17)", async () => {
    const t = setup({ daily: 4999, found: ok([kyivUk]) });

    expect(await t.setHomeCity(CHAT, "Київ")).toEqual(err({ kind: "daily_limit" }));
    expect(t.calls).not.toContain("lookup.findById");
  });
});
