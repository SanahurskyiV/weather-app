import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAILY_LIMIT_REPLY,
  NO_HOME_CITY_REPLY,
  UNAVAILABLE_REPLY,
  USER_LIMIT_REPLY,
} from "../../src/adapters/telegram/replies";
import kyivForecast from "../fixtures/open-meteo-forecast-kyiv.json";
import { resetTables, seedDailyCount, seedHomeCity, seedLookups, timesBefore } from "./db-fixtures";
import { CHAT_A, captureLogs, privateText, send, stubOutbound } from "./telegram-harness";

function forecast(current: Partial<typeof kyivForecast.current> = {}) {
  return () => Response.json({ ...kyivForecast, current: { ...kyivForecast.current, ...current } });
}

const today = () => new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  await resetTables(env.DB);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/weather", () => {
  it("replies with the full current conditions for the Home city (AC-08)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(forecast());
    const logs = captureLogs();

    await send(privateText("/weather"));

    expect(out.replies).toHaveLength(1);
    const text = out.replies[0]?.text ?? "";
    expect(text).toContain("Kyiv, Kyiv City, Ukraine");
    expect(text).toContain("11:45"); // 09:45 UTC in Kyiv (UTC+2 in November)
    expect(text).toContain("overcast");
    expect(text).toContain("3 °C, feels like -1 °C, wind 14 kilometres per hour, humidity 81%");
    expect(out.replies[0]).not.toHaveProperty("parse_mode");

    expect(out.lookups).toHaveLength(1);
    expect(out.lookups[0]?.searchParams.get("latitude")).toBe("50.45");
    expect(out.lookups[0]?.searchParams.get("longitude")).toBe("30.52");
    expect(logs.updates()).toEqual([
      expect.objectContaining({
        command: "weather",
        outcome: "ok",
        lookups: 1,
        replied: true,
        reading_time: "2026-11-06T09:45:00.000Z",
      }),
    ]);
  });

  it("rounds a value near zero to 0, never -0 (AC-08)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(forecast({ temperature_2m: -0.4, apparent_temperature: -0.2 }));
    captureLogs();

    await send(privateText("/weather"));

    expect(out.replies[0]?.text).toContain("0 °C, feels like 0 °C");
    expect(out.replies[0]?.text).not.toContain("-0");
  });

  it("says 'unknown conditions' for a weather code the bot does not recognise (AC-08)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(forecast({ weather_code: 999 }));
    captureLogs();

    await send(privateText("/weather"));

    expect(out.replies[0]?.text).toContain("unknown conditions");
  });

  it("still shows an old reading, with its local reading time (spec §6 freshness)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(forecast({ time: "2026-11-06T06:45" }));
    captureLogs();

    await send(privateText("/weather"));

    expect(out.replies[0]?.text).toContain("08:45");
  });

  it("explains how to set a city when there is none, with no lookup (AC-09)", async () => {
    const out = stubOutbound(forecast());
    const logs = captureLogs();

    await send(privateText("/weather"));

    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: NO_HOME_CITY_REPLY }]);
    expect(NO_HOME_CITY_REPLY).toContain("/city Kyiv");
    expect(out.calls).toHaveLength(1); // the reply itself
    expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "no_home_city", lookups: 0 })]);
  });

  it.each([
    ["is down", () => Response.json({ error: true }, { status: 503 })],
    ["answers garbage", () => new Response("<html>")],
  ])(
    "says 'temporarily unavailable' when the weather source %s, and counts the lookup (AC-10, AC-17)",
    async (_label, answer) => {
      await seedHomeCity(env.DB, { chat_id: CHAT_A });
      const out = stubOutbound(answer);
      const logs = captureLogs();

      await send(privateText("/weather"));

      expect(out.replies).toEqual([{ chat_id: CHAT_A, text: UNAVAILABLE_REPLY }]);
      expect(UNAVAILABLE_REPLY).toMatch(/temporarily unavailable/);
      expect(UNAVAILABLE_REPLY).toMatch(/few minutes/);
      expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "unavailable", lookups: 1 })]);
      const day = await env.DB.prepare("SELECT lookup_count FROM daily_lookup_counts WHERE day = ?")
        .bind(today())
        .first<{ lookup_count: number }>();
      expect(day?.lookup_count).toBe(1);
    },
  );

  it("says 'temporarily unavailable' when the weather source hangs past 1.5 seconds (AC-10)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("timed out"));
          });
        }),
    );
    captureLogs();

    await send(privateText("/weather"));

    expect(out.replies.map((r) => r.text)).toEqual([UNAVAILABLE_REPLY]);
  }, 5000);

  it("answers 'too many requests' at 30 lookups in the past hour, with no lookup (AC-16)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    await seedLookups(env.DB, CHAT_A, timesBefore(new Date(), 30, 5));
    const out = stubOutbound(forecast());
    const logs = captureLogs();

    await send(privateText("/weather"));

    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: USER_LIMIT_REPLY }]);
    expect(out.lookups).toEqual([]);
    expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "user_limit", lookups: 0 })]);
  });

  it("succeeds at 4,999 lookups today and refuses at 5,000, even with the chat capped too (AC-17)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    await seedDailyCount(env.DB, today(), 4999);
    const out = stubOutbound(forecast());
    const logs = captureLogs();

    await send(privateText("/weather"));
    await seedLookups(env.DB, CHAT_A, timesBefore(new Date(), 30, 5));
    await send(privateText("/weather"));

    expect(out.lookups).toHaveLength(1);
    expect(out.replies[1]).toEqual({ chat_id: CHAT_A, text: DAILY_LIMIT_REPLY });
    expect(logs.updates().map((e) => e.outcome)).toEqual(["ok", "daily_limit"]);
  });
});
