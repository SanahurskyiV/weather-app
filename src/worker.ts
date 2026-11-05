import { webhookCallback } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { log } from "./adapters/log";
import { createBot } from "./adapters/telegram/bot";

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

    const bot = createBot(env.BOT_TOKEN, parseBotInfo(env.BOT_INFO));
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
