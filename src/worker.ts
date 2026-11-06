import { webhookCallback } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { systemClock } from "./adapters/clock/system-clock";
import { makeD1HomeCityRepo } from "./adapters/d1/home-city-repo";
import { makeD1UsageCounter } from "./adapters/d1/usage-counter";
import { log } from "./adapters/log";
import { makeOpenMeteoGeocoding } from "./adapters/open-meteo/geocoding";
import { createBot } from "./adapters/telegram/bot";
import { makeGetHomeCity } from "./app/get-home-city";
import { makeSetHomeCity } from "./app/set-home-city";

// Composition root: builds adapters from env and hands them to use cases (ADR-0002).

export const WEBHOOK_PATH = "/webhook";

function parseBotInfo(raw: string | undefined): UserFromGetMe | undefined {
  return raw ? (JSON.parse(raw) as UserFromGetMe) : undefined;
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

    const repo = makeD1HomeCityRepo(env.DB);
    const counter = makeD1UsageCounter(env.DB);
    const bot = createBot(env.BOT_TOKEN, parseBotInfo(env.BOT_INFO), {
      clock: systemClock,
      getHomeCity: makeGetHomeCity(repo),
      setHomeCity: makeSetHomeCity({ repo, counter, lookup: makeOpenMeteoGeocoding(), clock: systemClock }),
    });
    const handleUpdate = webhookCallback(bot, "cloudflare-mod", { secretToken: env.WEBHOOK_SECRET });
    try {
      return await handleUpdate(request);
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
