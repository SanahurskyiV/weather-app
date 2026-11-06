import { afterEach, describe, expect, it, vi } from "vitest";
import kyiv from "../../../test/fixtures/open-meteo-forecast-kyiv.json";
import { err, ok } from "../../domain/result";
import { makeOpenMeteoForecast } from "./forecast";
import { hangingFetch, requestedUrl } from "./test-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

function stubFetch(body: unknown, init: ResponseInit = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(Response.json(body, init)));
}

describe("Open-Meteo forecast", () => {
  it("asks for the current metric fields at the stored coordinates, in GMT (AC-08)", async () => {
    const spy = stubFetch(kyiv);

    await makeOpenMeteoForecast().current(50.45, 30.52);

    const url = requestedUrl(spy);
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(url.searchParams.get("latitude")).toBe("50.45");
    expect(url.searchParams.get("longitude")).toBe("30.52");
    expect(url.searchParams.get("current")?.split(",").sort()).toEqual(
      ["apparent_temperature", "relative_humidity_2m", "temperature_2m", "weather_code", "wind_speed_10m"].sort(),
    );
    expect(url.searchParams.get("timezone")).toBe("GMT");
    // Open-Meteo defaults are °C and km/h; we must not ask for anything else.
    expect(url.searchParams.has("temperature_unit")).toBe(false);
    expect(url.searchParams.has("wind_speed_unit")).toBe(false);
  });

  it("maps the recorded answer to a reading, reading time as UTC (AC-08)", async () => {
    stubFetch(kyiv);

    expect(await makeOpenMeteoForecast().current(50.45, 30.52)).toEqual(
      ok({
        readingTime: new Date("2026-11-06T09:45:00.000Z"),
        weatherCode: 3,
        temperatureC: 2.6,
        feelsLikeC: -1.2,
        windKmh: 13.7,
        humidityPct: 81,
      }),
    );
  });

  it("reports a server error as unavailable (AC-10)", async () => {
    stubFetch({ error: true }, { status: 503 });

    expect(await makeOpenMeteoForecast().current(50.45, 30.52)).toEqual(err("unavailable"));
  });

  it("reports a network error as unavailable (AC-10)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network connection lost."));

    expect(await makeOpenMeteoForecast().current(50.45, 30.52)).toEqual(err("unavailable"));
  });

  it.each([
    ["not JSON", new Response("not json")],
    ["no current block", Response.json({ latitude: 1 })],
    ["a missing field", Response.json({ current: { ...kyiv.current, temperature_2m: undefined } })],
    ["a bad time", Response.json({ current: { ...kyiv.current, time: "yesterday" } })],
  ])("reports %s as unavailable (AC-10)", async (_label, response) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    expect(await makeOpenMeteoForecast().current(50.45, 30.52)).toEqual(err("unavailable"));
  });

  it("gives up after 1.5 seconds and reports unavailable (AC-10)", async () => {
    hangingFetch();

    expect(await makeOpenMeteoForecast().current(50.45, 30.52)).toEqual(err("unavailable"));
  }, 5000);
});
