import { webhookCallback } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { systemClock } from "./adapters/clock/system-clock";
import { makeD1HomeCityRepo } from "./adapters/d1/home-city-repo";
import { makeD1UsageCounter } from "./adapters/d1/usage-counter";
import { log } from "./adapters/log";
import { makeOpenMeteoForecast } from "./adapters/open-meteo/forecast";
import { makeOpenMeteoGeocoding } from "./adapters/open-meteo/geocoding";
import { createBot } from "./adapters/telegram/bot";
import { makeGetCurrentWeather } from "./app/get-current-weather";
import { makeGetHomeCity } from "./app/get-home-city";
import { makeSetHomeCity } from "./app/set-home-city";

// Composition root: builds adapters from env and hands them to use cases (ADR-0002).
// Everything is built once per isolate and cached at module scope (SAD §8 Composition); env does not
// change within an isolate. Nothing per-request is ever stored here.

export const WEBHOOK_PATH = "/webhook";

export interface App {
  handleUpdate(request: Request): Promise<Response>;
}

function parseBotInfo(raw: string | undefined): UserFromGetMe | undefined {
  return raw ? (JSON.parse(raw) as UserFromGetMe) : undefined;
}

/** Builds adapters, use cases and the bot from env. Call through `getApp` outside tests. */
export function buildApp(env: Cloudflare.Env): App {
  const botInfo = parseBotInfo(env.BOT_INFO);
  // Required for production deploys (SAD §7): without it grammY calls getMe on every cold start.
  if (!botInfo) log("startup_warning", { reason: "BOT_INFO missing" });

  const clock = systemClock;
  const repo = makeD1HomeCityRepo(env.DB);
  const counter = makeD1UsageCounter(env.DB);
  const bot = createBot(env.BOT_TOKEN, botInfo, {
    clock,
    getHomeCity: makeGetHomeCity(repo),
    setHomeCity: makeSetHomeCity({ repo, counter, lookup: makeOpenMeteoGeocoding(), clock }),
    getCurrentWeather: makeGetCurrentWeather({ repo, counter, weather: makeOpenMeteoForecast(), clock }),
  });
  return { handleUpdate: webhookCallback(bot, "cloudflare-mod", { secretToken: env.WEBHOOK_SECRET }) };
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
