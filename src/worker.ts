import { log } from "./adapters/log";
import { WEBHOOK_PATH } from "./adapters/telegram/webhook-path";
import { getApp } from "./composition";

// Wrangler `main`: routing only. workerd treats every named export here as an entry point, so this module
// exports nothing but the default handler; the composition root lives in ./composition (review R3-02).

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
