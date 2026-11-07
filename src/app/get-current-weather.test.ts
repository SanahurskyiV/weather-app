import { describe, expect, it, vi } from "vitest";
import type { Place } from "../domain/place";
import { err, ok, type Result } from "../domain/result";
import type { CurrentWeather } from "../domain/weather";
import { makeGetCurrentWeather } from "./get-current-weather";
import type { Clock, HomeCityRepo, UsageCounter, WeatherProvider } from "./ports";

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
const reading: CurrentWeather = {
  readingTime: new Date("2026-11-06T09:45:00.000Z"),
  weatherCode: 3,
  temperatureC: 2.6,
  feelsLikeC: -1.2,
  windKmh: 13.7,
  humidityPct: 81,
};

interface Setup {
  current?: Place;
  daily?: number;
  chatLastHour?: number;
  answer?: Result<CurrentWeather, "unavailable">;
}

function setup({ current = kyiv, daily = 0, chatLastHour = 0, answer = ok(reading) }: Setup = {}) {
  const calls: string[] = [];
  const fetchedAt: [number, number][] = [];
  const reserved: { chatId: number; now: Date }[] = [];
  const repo: HomeCityRepo = {
    get(chatId) {
      calls.push("repo.get");
      return Promise.resolve(chatId === CHAT ? current : undefined);
    },
    save() {
      return Promise.reject(new Error("getCurrentWeather must not save"));
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
  const weather: WeatherProvider = {
    current(latitude, longitude) {
      calls.push("weather.current");
      fetchedAt.push([latitude, longitude]);
      return Promise.resolve(answer);
    },
  };
  const clock: Clock = { now: () => NOW };
  return { getCurrentWeather: makeGetCurrentWeather({ repo, counter, weather, clock }), calls, fetchedAt, reserved };
}

describe("getCurrentWeather", () => {
  it("loads the Home city, checks limits, reserves once, then fetches at its coordinates (AC-08)", async () => {
    const t = setup();

    expect(await t.getCurrentWeather(CHAT)).toEqual(ok({ place: kyiv, weather: reading }));
    expect(t.calls).toEqual(["repo.get", "counter.counts", "counter.reserve", "weather.current"]);
    expect(t.fetchedAt).toEqual([[50.45, 30.52]]);
    expect(t.reserved).toEqual([{ chatId: CHAT, now: NOW }]);
  });

  it("stops at no_home_city before any counting or fetch (AC-09, AC-16)", async () => {
    const t = setup();

    expect(await t.getCurrentWeather(100002)).toEqual(err({ kind: "no_home_city" }));
    expect(t.calls).toEqual(["repo.get"]);
  });

  it.each([
    [5000, 0, "daily_limit"],
    [0, 30, "user_limit"],
    [5000, 30, "daily_limit"],
  ])("daily %i, chat %i → %s, with no reserve and no fetch (AC-16, AC-17)", async (daily, chatLastHour, kind) => {
    const t = setup({ daily, chatLastHour });

    expect(await t.getCurrentWeather(CHAT)).toEqual(err({ kind }));
    expect(t.calls).toEqual(["repo.get", "counter.counts"]);
  });

  it("allows the request at daily 4,999 and chat 29", async () => {
    const t = setup({ daily: 4999, chatLastHour: 29 });

    expect((await t.getCurrentWeather(CHAT)).ok).toBe(true);
  });

  it("reports a provider failure as unavailable and keeps the reservation (AC-10, AC-17)", async () => {
    const t = setup({ answer: err("unavailable") });

    expect(await t.getCurrentWeather(CHAT)).toEqual(err({ kind: "unavailable" }));
    expect(t.reserved).toHaveLength(1);
  });
});

describe("getCurrentWeather lookup reporting (AC-15, review R-13)", () => {
  it.each<[string, Setup & { chat?: number }, number]>([
    ["a reading", {}, 1],
    ["a source failure", { answer: err("unavailable") }, 1],
    ["no Home city", { chat: 100002 }, 0],
    ["the daily limit", { daily: 5000 }, 0],
    ["the per-user limit", { chatLastHour: 30 }, 0],
  ])("tells onLookup about each lookup made, for %s", async (_label, { chat = CHAT, ...options }, expected) => {
    const t = setup(options);
    const onLookup = vi.fn();

    await t.getCurrentWeather(chat, onLookup);

    expect(onLookup).toHaveBeenCalledTimes(expected);
  });
});
