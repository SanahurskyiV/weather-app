import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CITY_USAGE_REPLY,
  cityOkReply,
  DAILY_LIMIT_REPLY,
  notFoundReply,
  UNAVAILABLE_REPLY,
  USER_LIMIT_REPLY,
} from "../../src/adapters/telegram/replies";
import type { Place } from "../../src/domain/place";
import getKyiv from "../fixtures/open-meteo-get-kyiv.json";
import empty from "../fixtures/open-meteo-geocoding-empty.json";
import kyivUk from "../fixtures/open-meteo-geocoding-kyiv-uk.json";
import kyiv from "../fixtures/open-meteo-geocoding-kyiv.json";
import lviv from "../fixtures/open-meteo-geocoding-lviv.json";
import parisUs from "../fixtures/open-meteo-geocoding-paris-us.json";
import paris from "../fixtures/open-meteo-geocoding-paris.json";
import { resetTables, seedDailyCount, seedHomeCity, seedLookups, timesBefore } from "./db-fixtures";
import { CHAT_A, CHAT_B, captureLogs, privateText, send, stubOutbound } from "./telegram-harness";

const KYIV: Place = {
  name: "Kyiv",
  region: "Kyiv City",
  country: "Ukraine",
  latitude: 50.45466,
  longitude: 30.5238,
  timezone: "Europe/Kyiv",
};

/** Answers geocoding searches by the `name` parameter, and `/v1/get` with the Kyiv record. */
function geocoder(byName: Record<string, unknown>) {
  return (url: URL) => {
    if (url.pathname === "/v1/get") return Response.json(getKyiv);
    const name = url.searchParams.get("name") ?? "";
    const key = url.searchParams.has("countryCode") ? `${name}|${url.searchParams.get("countryCode") ?? ""}` : name;
    return Response.json(byName[key] ?? empty);
  };
}

const ANSWERS = {
  Kyiv: kyiv,
  Київ: kyivUk,
  Lviv: lviv,
  Paris: paris,
  "Paris|US": parisUs,
  "<b>Kyiv</b>": kyiv,
};

async function homeCity(chatId: number) {
  return env.DB.prepare("SELECT name, region, country, timezone FROM home_cities WHERE chat_id = ?")
    .bind(chatId)
    .first<{ name: string; region: string | null; country: string; timezone: string }>();
}

async function usage(chatId: number) {
  const day = await env.DB.prepare("SELECT lookup_count FROM daily_lookup_counts").first<{ lookup_count: number }>();
  const chat = await env.DB.prepare("SELECT COUNT(*) AS n FROM lookups WHERE chat_id = ?")
    .bind(chatId)
    .first<{ n: number }>();
  return { daily: day?.lookup_count ?? 0, chat: chat?.n ?? 0 };
}

beforeEach(async () => {
  await resetTables(env.DB);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/city", () => {
  it("stores the best match and replies with its full name, timezone and how to ask for the weather (AC-01)", async () => {
    const out = stubOutbound(geocoder(ANSWERS));
    const logs = captureLogs();

    await send(privateText("/city Kyiv"));

    expect(await homeCity(CHAT_A)).toEqual({
      name: "Kyiv",
      region: "Kyiv City",
      country: "Ukraine",
      timezone: "Europe/Kyiv",
    });
    expect(out.replies).toHaveLength(1);
    const text = out.replies[0]?.text ?? "";
    expect(text).toContain("Kyiv, Kyiv City, Ukraine");
    expect(text).toContain("Europe/Kyiv");
    expect(text).toContain("/weather");
    expect(out.lookups).toHaveLength(1);
    expect(out.lookups[0]?.searchParams.get("language")).toBe("en");
    expect(logs.updates()).toEqual([
      expect.objectContaining({ command: "city", outcome: "ok", lookups: 1, replied: true }),
    ]);
    expect(await usage(CHAT_A)).toEqual({ daily: 1, chat: 1 });
  });

  it("shows the English name for a Cyrillic query, with two counted lookups (AC-01, T16)", async () => {
    const out = stubOutbound(geocoder(ANSWERS));
    const logs = captureLogs();

    await send(privateText("/city Київ"));

    expect(await homeCity(CHAT_A)).toEqual({
      name: "Kyiv",
      region: "Kyiv City",
      country: "Ukraine",
      timezone: "Europe/Kyiv",
    });
    expect(out.replies[0]?.text).toContain("Kyiv, Kyiv City, Ukraine");
    expect(out.lookups.map((u) => [u.pathname, u.searchParams.get("language")])).toEqual([
      ["/v1/search", "uk"],
      ["/v1/get", "en"],
    ]);
    expect(out.calls.length).toBeLessThanOrEqual(3);
    expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "ok", lookups: 2 })]);
    expect(await usage(CHAT_A)).toEqual({ daily: 2, chat: 2 });
  });

  it("replaces Kyiv with Lviv (AC-02)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(geocoder(ANSWERS));
    captureLogs();

    await send(privateText("/city Lviv"));

    expect(await homeCity(CHAT_A)).toMatchObject({ name: "Lviv", region: "Lviv Oblast" });
    expect(out.replies[0]?.text).toContain("Lviv, Lviv Oblast, Ukraine");
  });

  it.each(["/city", "/city    "])(
    "answers %j with the usage and an example, storing and counting nothing (AC-03)",
    async (text) => {
      const out = stubOutbound(geocoder(ANSWERS));
      const logs = captureLogs();

      await send(privateText(text));

      expect(out.replies).toEqual([{ chat_id: CHAT_A, text: CITY_USAGE_REPLY }]);
      expect(CITY_USAGE_REPLY).toContain("/city Kyiv");
      expect(out.lookups).toEqual([]);
      expect(await homeCity(CHAT_A)).toBeNull();
      expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "blank", lookups: 0 })]);
      expect(await usage(CHAT_A)).toEqual({ daily: 0, chat: 0 });
    },
  );

  it("refuses a name over 100 characters without a lookup and without counting (AC-04)", async () => {
    const out = stubOutbound(geocoder(ANSWERS));
    const logs = captureLogs();

    await send(privateText(`/city ${"a".repeat(101)}`));

    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: notFoundReply(undefined) }]);
    expect(out.lookups).toEqual([]);
    expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "too_long", lookups: 0 })]);
    expect(await usage(CHAT_A)).toEqual({ daily: 0, chat: 0 });
  });

  it("answers an unknown name with 'couldn't find', keeps Kyiv and says so (AC-04, AC-05)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(geocoder(ANSWERS));
    const logs = captureLogs();

    await send(privateText("/city Xyzzyqq"));

    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: notFoundReply(KYIV) }]);
    expect(notFoundReply(undefined).toLowerCase()).toMatch(/couldn.t find that place/);
    expect(notFoundReply(undefined)).toMatch(/spelling/);
    expect(notFoundReply(undefined)).toMatch(/country/);
    expect(notFoundReply(KYIV)).toContain("still Kyiv");
    expect(await homeCity(CHAT_A)).toMatchObject({ name: "Kyiv" });
    expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "not_found", lookups: 1 })]);
  });

  it.each([
    ["is down", () => Response.json({ error: true }, { status: 500 })],
    ["fails at the network", () => Promise.reject(new TypeError("Network connection lost."))],
  ])(
    "says 'temporarily unavailable' when the place lookup %s, keeping Kyiv (AC-04b, AC-05)",
    async (_label, answer) => {
      await seedHomeCity(env.DB, { chat_id: CHAT_A });
      const out = stubOutbound(answer);
      const logs = captureLogs();

      await send(privateText("/city Paris"));

      expect(out.replies).toEqual([
        { chat_id: CHAT_A, text: `${UNAVAILABLE_REPLY}\nYour city is still Kyiv, Kyiv City, Ukraine.` },
      ]);
      expect(UNAVAILABLE_REPLY).not.toMatch(/couldn.t find/);
      expect(await homeCity(CHAT_A)).toMatchObject({ name: "Kyiv" });
      expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "unavailable", lookups: 1 })]);
      expect(await usage(CHAT_A)).toEqual({ daily: 1, chat: 1 });
    },
  );

  it("says 'temporarily unavailable' when the place lookup hangs past 1.5 seconds (AC-04b)", async () => {
    const out = stubOutbound(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("timed out"));
          });
        }),
    );
    captureLogs();

    await send(privateText("/city Paris"));

    expect(out.replies.map((r) => r.text)).toEqual([UNAVAILABLE_REPLY]);
  }, 5000);

  it("stores the most populous Paris and hints at adding a country (AC-06)", async () => {
    const out = stubOutbound(geocoder(ANSWERS));
    captureLogs();

    await send(privateText("/city Paris"));

    expect(await homeCity(CHAT_A)).toEqual({
      name: "Paris",
      region: "Île-de-France Region",
      country: "France",
      timezone: "Europe/Paris",
    });
    const text = out.replies[0]?.text ?? "";
    expect(text).toContain("Paris, Île-de-France Region, France");
    expect(text).toContain("Europe/Paris");
    expect(text).toContain("Paris, US");
  });

  it("sends the country filter and stores the US match for 'Paris, US' (AC-07)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A, name: "Paris", region: "Île-de-France Region", country: "France" });
    const out = stubOutbound(geocoder(ANSWERS));
    captureLogs();

    await send(privateText("/city Paris, US"));

    expect(out.lookups[0]?.searchParams.get("countryCode")).toBe("US");
    expect(await homeCity(CHAT_A)).toMatchObject({ name: "Paris", region: "Texas", country: "United States" });
    expect(out.replies[0]?.text).toContain("America/Chicago");
  });

  it("refuses 'Paris, Texas' as not found without a lookup (AC-07)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(geocoder(ANSWERS));
    const logs = captureLogs();

    await send(privateText("/city Paris, Texas"));

    // A parse refusal happens before the Home city is loaded, so it carries no "still …" line (SAD §8).
    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: notFoundReply(undefined) }]);
    expect(out.lookups).toEqual([]);
    expect(await homeCity(CHAT_A)).toMatchObject({ name: "Kyiv" });
    expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "unknown_country", lookups: 0 })]);
  });

  it("answers 'Paris, Japan' as not found after an empty lookup, never another country (AC-07)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(geocoder(ANSWERS));
    captureLogs();

    await send(privateText("/city Paris, Japan"));

    expect(out.lookups.map((u) => u.searchParams.get("countryCode"))).toEqual(["JP"]);
    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: notFoundReply(KYIV) }]);
    expect(await homeCity(CHAT_A)).toMatchObject({ name: "Kyiv" });
  });

  it("echoes only the resolved name, as plain text, for a query with markup (spec §6.1)", async () => {
    const out = stubOutbound(geocoder(ANSWERS));
    captureLogs();

    await send(privateText("/city <b>Kyiv</b>"));

    const [reply] = out.replies;
    expect(reply?.text).toContain("Kyiv, Kyiv City, Ukraine");
    expect(reply?.text).not.toContain("<b>");
    expect(reply).not.toHaveProperty("parse_mode");
  });

  it("never changes or names another chat's Home city (AC-14)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    await seedHomeCity(env.DB, { chat_id: CHAT_B, name: "Lviv", region: "Lviv Oblast" });
    const out = stubOutbound(geocoder(ANSWERS));
    captureLogs();

    await send(privateText("/city Paris", CHAT_B));

    expect(await homeCity(CHAT_A)).toMatchObject({ name: "Kyiv" });
    expect(await homeCity(CHAT_B)).toMatchObject({ name: "Paris" });
    expect(out.replies.every((r) => r.chat_id === CHAT_B && !r.text.includes("Kyiv"))).toBe(true);
  });

  it("answers 'too many requests' after 30 lookups in the past hour, with no lookup (AC-16)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    await seedLookups(env.DB, CHAT_A, timesBefore(new Date(), 30, 5));
    const out = stubOutbound(geocoder(ANSWERS));
    const logs = captureLogs();

    await send(privateText("/city Paris"));

    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: USER_LIMIT_REPLY }]);
    expect(USER_LIMIT_REPLY.toLowerCase()).toContain("too many requests");
    expect(out.lookups).toEqual([]);
    expect(await homeCity(CHAT_A)).toMatchObject({ name: "Kyiv" });
    expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "user_limit", lookups: 0 })]);
    expect((await usage(CHAT_A)).chat).toBe(30);
  });

  it("answers 'daily limit' when the bot-wide budget is used up, even when the chat is also capped (AC-17)", async () => {
    await seedDailyCount(env.DB, new Date().toISOString().slice(0, 10), 5000);
    await seedLookups(env.DB, CHAT_A, timesBefore(new Date(), 30, 5));
    const out = stubOutbound(geocoder(ANSWERS));
    const logs = captureLogs();

    await send(privateText("/city Paris"));

    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: DAILY_LIMIT_REPLY }]);
    expect(DAILY_LIMIT_REPLY.toLowerCase()).toContain("daily limit");
    expect(DAILY_LIMIT_REPLY.toLowerCase()).toContain("tomorrow");
    expect(out.lookups).toEqual([]);
    expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "daily_limit", lookups: 0 })]);
  });

  it("builds the success reply from the resolved place", () => {
    expect(cityOkReply(KYIV, false)).not.toContain("Paris, US");
    expect(cityOkReply(KYIV, true)).toContain("Paris, US");
  });
});
