import { createScheduledController } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pingDatabase } from "../../src/adapters/d1/health";
import { greetingReply } from "../../src/adapters/telegram/replies";
import { WEBHOOK_PATH } from "../../src/adapters/telegram/webhook-path";
import * as mainModule from "../../src/worker";
import worker from "../../src/worker";
import sendMessageOk from "../fixtures/telegram-send-message-ok.json";
import startUpdate from "../fixtures/telegram-start-update.json";

function webhookRequest(secret: string): Request {
  return new Request(`https://bot.example${WEBHOOK_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
    body: JSON.stringify(startUpdate),
  });
}

function stubTelegram() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(Response.json(sendMessageOk)));
}

describe("worker skeleton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports only entry points from the main module, so workerd can start it", () => {
    // workerd treats every named export of `main` as an entry point and refuses to start on anything else:
    // "Incorrect type for map entry 'X': the provided value is not of type 'function or ExportedHandler'".
    // The vitest pool imports the module without that check, so it is asserted here (fix 2026-11-07).
    const kinds = Object.fromEntries(
      Object.entries(mainModule as Record<string, unknown>).map(([name, value]) => [
        name,
        typeof value === "function" || (typeof value === "object" && value !== null) ? "entry point" : typeof value,
      ]),
    );
    expect(kinds).toEqual(Object.fromEntries(Object.keys(mainModule).map((name) => [name, "entry point"])));
  });

  it("boots and answers the health check", async () => {
    const response = await exports.default.fetch("https://bot.example/health");
    expect(response.status).toBe(200);
  });

  it("replies to /start through the Telegram API", async () => {
    const fetchSpy = stubTelegram();

    const response = await exports.default.fetch(webhookRequest(env.WEBHOOK_SECRET));

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error("Telegram API was not called");
    const [input, init] = call;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    expect(url).toContain("/sendMessage");
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { chat_id: number; text: string };
    expect(body).toMatchObject({ chat_id: 4242, text: greetingReply(undefined) });
  });

  it("drops an update with the wrong secret token without saying why", async () => {
    const fetchSpy = stubTelegram();

    const response = await exports.default.fetch(webhookRequest("wrong-secret"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("runs the scheduled handler without error", async () => {
    await expect(worker.scheduled(createScheduledController({ cron: "*/15 * * * *" }))).resolves.toBeUndefined();
  });

  it("reaches D1 with migrations applied", async () => {
    expect(await pingDatabase(env.DB)).toBe(true);
    const applied = await env.DB.prepare("SELECT name FROM d1_migrations").all<{ name: string }>();
    expect(applied.results.map((r) => r.name)).toContain("0001_init.sql");
  });
});
