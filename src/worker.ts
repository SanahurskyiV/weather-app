import { webhookCallback } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { systemClock } from "./adapters/clock/system-clock";
import { makeD1HomeCityRepo } from "./adapters/d1/home-city-repo";
import { makeD1UsageCounter } from "./adapters/d1/usage-counter";
import { log } from "./adapters/log";
import { makeOpenMeteoForecast } from "./adapters/open-meteo/forecast";
import { makeOpenMeteoGeocoding } from "./adapters/open-meteo/geocoding";
import { createBot } from "./adapters/telegram/bot";
import { WEBHOOK_PATH } from "./adapters/telegram/webhook-path";
import { makeGetCurrentWeather } from "./app/get-current-weather";
import { makeGetHomeCity } from "./app/get-home-city";
import { makeSetHomeCity } from "./app/set-home-city";

// Composition root: builds adapters from env and hands them to use cases (ADR-0002).
// Everything is built once per isolate and cached at module scope (SAD §8 Composition); env does not
// change within an isolate. Nothing per-request is ever stored here.

export interface App {
  handleUpdate(request: Request): Promise<Response>;
}

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

/** What a dropped update gets: the same bare 200 as an accepted one, so a forger learns nothing (spec §6.1). */
function dropped(): Response {
  return new Response(null, { status: 200 });
}

/** Constant-time comparison of the secret header with the configured secret. */
function hasSecret(request: Request, secret: string): boolean {
  const encoder = new TextEncoder();
  const given = encoder.encode(request.headers.get(SECRET_HEADER) ?? "");
  const expected = encoder.encode(secret);
  return given.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(given, expected);
}

type BotInfo = { kind: "ok"; info: UserFromGetMe } | { kind: "missing" } | { kind: "invalid" };

/** Reads the cached getMe result. Never throws: anything that isn't a bot user is "invalid" (review R3-01). */
function parseBotInfo(raw: string | undefined): BotInfo {
  if (!raw) return { kind: "missing" };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { kind: "invalid" };
  }
  if (typeof value !== "object" || value === null) return { kind: "invalid" };
  const user = value as Record<string, unknown>;
  const valid = typeof user.id === "number" && typeof user.username === "string" && user.is_bot === true;
  return valid ? { kind: "ok", info: value as UserFromGetMe } : { kind: "invalid" };
}

/** Builds adapters, use cases and the bot from env. Call through `getApp` outside tests. */
export function buildApp(env: Cloudflare.Env): App {
  // Fail closed: with no secret configured every update is dropped, never accepted (review R-07).
  const secret = env.WEBHOOK_SECRET as string | undefined;
  if (!secret) {
    log("startup_error", { reason: "WEBHOOK_SECRET missing" });
    return { handleUpdate: () => Promise.resolve(dropped()) };
  }

  const parsed = parseBotInfo(env.BOT_INFO);
  // Required for production deploys (SAD §7): without a valid one grammY calls getMe on every cold start.
  if (parsed.kind !== "ok") log("startup_warning", { reason: `BOT_INFO ${parsed.kind}` });
  const botInfo = parsed.kind === "ok" ? parsed.info : undefined;

  const clock = systemClock;
  const repo = makeD1HomeCityRepo(env.DB);
  const counter = makeD1UsageCounter(env.DB);
  const bot = createBot(env.BOT_TOKEN, botInfo, {
    clock,
    getHomeCity: makeGetHomeCity(repo),
    setHomeCity: makeSetHomeCity({ repo, counter, lookup: makeOpenMeteoGeocoding(), clock }),
    getCurrentWeather: makeGetCurrentWeather({ repo, counter, weather: makeOpenMeteoForecast(), clock }),
  });
  const handle = webhookCallback(bot, "cloudflare-mod", { secretToken: secret });
  return { handleUpdate: (request) => (hasSecret(request, secret) ? handle(request) : Promise.resolve(dropped())) };
}

let app: App | undefined;

/** The app for this isolate, built on the first update. */
export function getApp(env: Cloudflare.Env): App {
  app ??= buildApp(env);
  return app;
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/health") {
      return new Response("ok");
    }
    if (request.method !== "POST" || pathname !== WEBHOOK_PATH) {
      return new Response("Not found", { status: 404 });
    }

    try {
      return await getApp(env).handleUpdate(request);
    } catch (error) {
      // Answer 200 anyway so Telegram does not keep redelivering the same update.
      log("webhook_error", { message: error instanceof Error ? error.message : String(error) });
      return new Response("ok");
    }
  },

  scheduled(controller): Promise<void> {
    // The alert check use case is wired here by the heads-up alerts feature.
    log("alert_check", { cron: controller.cron, status: "skipped", reason: "no alert rules yet" });
    return Promise.resolve();
  },
} satisfies ExportedHandler<Cloudflare.Env>;
