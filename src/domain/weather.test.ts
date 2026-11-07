import { describe, expect, it } from "vitest";
import { type CurrentWeather, describeConditions, formatLocalTime, roundReading } from "./weather";

const reading: CurrentWeather = {
  readingTime: new Date("2026-11-06T22:30:00Z"),
  weatherCode: 3,
  temperatureC: 2.5,
  feelsLikeC: -1.2,
  windKmh: 13.6,
  humidityPct: 81.4,
};

describe("describeConditions", () => {
  it.each([
    [0, "clear sky"],
    [1, "mainly clear"],
    [2, "partly cloudy"],
    [3, "overcast"],
    [45, "fog"],
    [48, "depositing rime fog"],
    [53, "moderate drizzle"],
    [57, "dense freezing drizzle"],
    [61, "slight rain"],
    [67, "heavy freezing rain"],
    [73, "moderate snow"],
    [77, "snow grains"],
    [80, "slight rain showers"],
    [82, "violent rain showers"],
    [86, "heavy snow showers"],
    [95, "thunderstorm"],
    [99, "thunderstorm with heavy hail"],
  ])("describes WMO code %i as %j (AC-08)", (code, words) => {
    expect(describeConditions(code)).toBe(words);
  });

  it.each([100, -1, 4, 50, 2.5, Number.NaN])("falls back to 'unknown conditions' for %d (AC-08)", (code) => {
    expect(describeConditions(code)).toBe("unknown conditions");
  });
});

describe("roundReading", () => {
  it("rounds all four numbers to whole numbers (AC-08)", () => {
    expect(roundReading(reading)).toEqual({
      ...reading,
      temperatureC: 3,
      feelsLikeC: -1,
      windKmh: 14,
      humidityPct: 81,
    });
  });

  it.each([
    [2.5, 3],
    [-0.4, 0],
    [-1.5, -1],
    [-0, 0],
  ])("rounds %d to %d, never -0", (value, expected) => {
    const rounded = roundReading({
      ...reading,
      temperatureC: value,
      feelsLikeC: value,
      windKmh: value,
      humidityPct: value,
    });
    for (const n of [rounded.temperatureC, rounded.feelsLikeC, rounded.windKmh, rounded.humidityPct]) {
      expect(Object.is(n, expected)).toBe(true);
    }
  });
});

describe("formatLocalTime", () => {
  it("shows the reading time in the Home city's timezone, not UTC (AC-08)", () => {
    expect(formatLocalTime(new Date("2026-11-06T22:30:00Z"), "Europe/Kyiv")).toBe("00:30");
    expect(formatLocalTime(new Date("2026-11-06T22:30:00Z"), "America/New_York")).toBe("17:30");
    expect(formatLocalTime(new Date("2026-11-06T22:30:00Z"), "UTC")).toBe("22:30");
  });
});
