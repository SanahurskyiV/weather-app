import { env } from "cloudflare:workers";
import type { Update } from "grammy/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAULT_REPLY, greetingReply, UNAVAILABLE_REPLY } from "../../src/adapters/telegram/replies";
import worker, { buildApp, getApp } from "../../src/worker";
import kyivForecast from "../fixtures/open-meteo-forecast-kyiv.json";
import getKyiv from "../fixtures/open-meteo-get-kyiv.json";
import empty from "../fixtures/open-meteo-geocoding-empty.json";
import kyivUk from "../fixtures/open-meteo-geocoding-kyiv-uk.json";
import kyiv from "../fixtures/open-meteo-geocoding-kyiv.json";
import lviv from "../fixtures/open-meteo-geocoding-lviv.json";
import paris from "../fixtures/open-meteo-geocoding-paris.json";
import { resetTables, seedHomeCity } from "./db-fixtures";
import {
  CHAT_A,
  CHAT_B,
  captureLogs,
  groupText,
  privateText,
  send,
  stubOutbound,
  webhookRequest,
} from "./telegram-harness";

const SEARCHES: Record<string, unknown> = { Kyiv: kyiv, Київ: kyivUk, Lviv: lviv, Paris: paris };

/** A fake Open-Meteo: geocoding by name, get-by-id for Kyiv, and the Kyiv forecast. */
function openMeteo(url: URL): Response {
  if (url.hostname === "api.open-meteo.com") return Response.json(kyivForecast);
  if (url.pathname === "/v1/get") return Response.json(getKyiv);
  return Response.json(SEARCHES[url.searchParams.get("name") ?? ""] ?? empty);
}

function hosts(calls: URL[]) {
  return {
    telegram: calls.filter((u) => u.hostname === "api.telegram.org").length,
    openMeteo: calls.filter((u) => u.hostname.endsWith("open-meteo.com")).length,
  };
}

beforeEach(async () => {
  await resetTables(env.DB);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("per-message budgets (spec §6, AC-15)", () => {
  it.each<[string, () => Update, number]>([
    ["set-city", () => privateText("/city Kyiv"), 1],
    ["weather", () => privateText("/weather"), 1],
    ["start", () => privateText("/start"), 0],
    ["fallback", () => privateText("what's up"), 0],
    ["group pointer", () => groupText("/weather"), 0],
  ])("%s: exactly one reply, at most one lookup, exactly one update event", async (_label, update, lookups) => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(openMeteo);
    const logs = captureLogs();

    const response = await send(update());

    expect(response.status).toBe(200);
    expect(hosts(out.calls)).toEqual({ telegram: 1, openMeteo: lookups });
    expect(out.calls.length).toBeLessThanOrEqual(3);
    expect(logs.updates()).toHaveLength(1);
    expect(logs.updates()[0]?.lookups).toBe(lookups);
  });

  it("a Cyrillic set-city stays within 3 outbound calls (T16)", async () => {
    const out = stubOutbound(openMeteo);
    captureLogs();

    await send(privateText("/city Київ"));

    expect(hosts(out.calls)).toEqual({ telegram: 1, openMeteo: 2 });
  });
});

describe("end to end", () => {
  it("sets Kyiv, replaces it with Lviv, and the next weather request reports Lviv (AC-01, AC-02, AC-08)", async () => {
    const out = stubOutbound(openMeteo);
    captureLogs();

    await send(privateText("/city Kyiv"));
    await send(privateText("/city Lviv"));
    await send(privateText("/weather"));

    expect(out.replies.map((r) => r.text.split("\n")[0])).toEqual([
      "Your city is now Kyiv, Kyiv City, Ukraine (timezone Europe/Kyiv).",
      "Your city is now Lviv, Lviv Oblast, Ukraine (timezone Europe/Kyiv).",
      "Weather in Lviv, Lviv Oblast, Ukraine at 11:45 local time:",
    ]);
    const forecastCall = out.lookups.find((u) => u.hostname === "api.open-meteo.com");
    expect(forecastCall?.searchParams.get("latitude")).toBe(String(lviv.results[0]?.latitude));
  });

  it("keeps two chats apart: B's Paris never touches or reveals A's Kyiv (AC-14)", async () => {
    const out = stubOutbound(openMeteo);
    captureLogs();

    await send(privateText("/city Kyiv", CHAT_A));
    await send(privateText("/city Paris", CHAT_B));
    await send(privateText("/weather", CHAT_A));

    const toB = out.replies.filter((r) => r.chat_id === CHAT_B);
    expect(toB).toHaveLength(1);
    expect(toB[0]?.text).not.toContain("Kyiv");
    const lastToA = out.replies.filter((r) => r.chat_id === CHAT_A).at(-1);
    expect(lastToA?.text).toContain("Weather in Kyiv, Kyiv City, Ukraine");
  });

  it("still answers when the weather source never responds (AC-10)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("timed out"));
          });
        }),
    );
    const logs = captureLogs();

    const response = await send(privateText("/weather"));

    expect(response.status).toBe(200);
    expect(out.replies.map((r) => r.text)).toEqual([UNAVAILABLE_REPLY]);
    expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "unavailable", lookups: 1 })]);
  }, 5000);

  it("turns an unexpected throw inside a use case into the fault reply, one fault event and HTTP 200 (AC-15)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound(openMeteo);
    const logs = captureLogs();
    vi.spyOn(env.DB, "batch").mockRejectedValue(new Error("D1 overloaded"));

    const response = await send(privateText("/weather"));

    expect(response.status).toBe(200);
    expect(out.replies.map((r) => r.text)).toEqual([FAULT_REPLY]);
    expect(logs.updates()).toEqual([expect.objectContaining({ command: "weather", outcome: "fault" })]);
    expect(logs.lines.join("\n")).not.toContain(env.BOT_TOKEN);
  });

  it("never logs the bot token or the webhook secret on the failure paths (AC-15, review R-09)", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    // Search answers from the fixtures (nothing for "Xyzzyqq"); the forecast source is down.
    stubOutbound((url) =>
      url.hostname === "api.open-meteo.com" ? Response.json({ error: true }, { status: 500 }) : openMeteo(url),
    );
    const logs = captureLogs();

    await send(privateText("/city Xyzzyqq"));
    await send(privateText("/weather"));
    vi.spyOn(env.DB, "batch").mockRejectedValue(new Error(`D1 down, token ${env.BOT_TOKEN}`));
    await send(privateText("/weather"));

    expect(logs.updates().map((e) => e.outcome)).toEqual(["not_found", "unavailable", "fault"]);
    const all = logs.lines.join("\n");
    expect(all).not.toContain(env.BOT_TOKEN);
    expect(all).not.toContain(env.WEBHOOK_SECRET);
  });

  it("logs a redelivered update twice under the same update id (accepted risk, SAD §11)", async () => {
    stubOutbound(openMeteo);
    const logs = captureLogs();
    const update = privateText("/start");

    await send(update);
    await send(update);

    expect(logs.updates().map((e) => e.update_id)).toEqual([update.update_id, update.update_id]);
  });
});

describe("composition root (SAD §5, §8 Composition)", () => {
  it("builds the app once per isolate and reuses it for every update", async () => {
    stubOutbound(openMeteo);
    captureLogs();
    const first = getApp(env);
    const incoming = () => webhookRequest(privateText("/start")) as Parameters<typeof worker.fetch>[0];
    await worker.fetch(incoming(), env);
    await worker.fetch(incoming(), env);

    expect(getApp(env)).toBe(first);
  });

  it("warns once when BOT_INFO is missing, and the bot still answers (SAD §7)", async () => {
    const out = stubOutbound(openMeteo);
    const logs = captureLogs();
    const withoutBotInfo: Cloudflare.Env = { ...env };
    delete withoutBotInfo.BOT_INFO;

    const app = buildApp(withoutBotInfo);
    const first = await app.handleUpdate(webhookRequest(privateText("/start")));
    const second = await app.handleUpdate(webhookRequest(privateText("/start")));

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(logs.events().filter((e) => e.event === "startup_warning")).toEqual([
      { event: "startup_warning", reason: "BOT_INFO missing" },
    ]);
    expect(out.replies.map((r) => r.text)).toEqual([greetingReply(undefined), greetingReply(undefined)]);
    expect(out.calls.filter((u) => u.pathname.endsWith("/getMe"))).toHaveLength(1);
  });
});
