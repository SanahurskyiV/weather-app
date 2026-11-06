import { GrammyError } from "grammy";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Clock } from "../../app/ports";
import type { BotContext, Outcome } from "./context";
import { FAULT_REPLY } from "./replies";
import { requestLog } from "./request-log";

// Unit test of the request-log collector (feature ADR-0002, AC-15): one complete `update` event per update.

afterEach(() => {
  vi.restoreAllMocks();
});

function clockAt(...ms: number[]): Clock {
  let i = 0;
  return { now: () => new Date(ms[Math.min(i++, ms.length - 1)] ?? 0) };
}

function forbidden(): GrammyError {
  return new GrammyError(
    "Call to 'sendMessage' failed! (403: Forbidden: bot was blocked by the user)",
    { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" },
    "sendMessage",
    { chat_id: 7, text: "hi" },
  );
}

/** A private-chat /city update context whose `reply` records its texts (or fails with `replyError`). */
function fakeContext(replyError?: Error) {
  const sent: string[] = [];
  const ctx = {
    update: { update_id: 42 },
    chat: { id: 7, type: "private" },
    msg: { text: "/city Kyiv", entities: [{ type: "bot_command", offset: 0, length: 5 }] },
    editedMessage: undefined,
    editedChannelPost: undefined,
    reply: (text: string) => {
      if (replyError) return Promise.reject(replyError);
      sent.push(text);
      return Promise.resolve({});
    },
  } as unknown as BotContext;
  return { ctx, sent };
}

function captureEvents() {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    lines.push(line);
  });
  return () => lines.map((l) => JSON.parse(l) as Record<string, unknown>);
}

async function run(ctx: BotContext, handler: (ctx: BotContext) => Promise<void>) {
  await requestLog(clockAt(1000, 1250))(ctx, () => handler(ctx));
}

function answer(outcome: Outcome, lookups = 0) {
  return async (ctx: BotContext) => {
    ctx.event.outcome = outcome;
    ctx.event.lookups = lookups;
    await ctx.reply("answer");
  };
}

describe("request-log collector (AC-15)", () => {
  it("writes one complete event for a success", async () => {
    const events = captureEvents();
    const { ctx, sent } = fakeContext();

    await run(ctx, answer("ok", 1));

    expect(sent).toEqual(["answer"]);
    expect(events()).toEqual([
      {
        event: "update",
        update_id: 42,
        is_edit: false,
        chat: 7,
        chat_type: "private",
        command: "city",
        outcome: "ok",
        lookups: 1,
        replied: true,
        duration_ms: 250,
      },
    ]);
  });

  it("writes one event carrying the failure kind for an expected failure", async () => {
    const events = captureEvents();
    const { ctx } = fakeContext();

    await run(ctx, answer("not_found", 1));

    expect(events()).toEqual([expect.objectContaining({ outcome: "not_found", lookups: 1, replied: true })]);
  });

  it("marks a thrown fault, names its kind without its message, and sends the fault reply", async () => {
    const events = captureEvents();
    const { ctx, sent } = fakeContext();

    await run(ctx, () => Promise.reject(new TypeError("token 123456:secret leaked in a message")));

    expect(sent).toEqual([FAULT_REPLY]);
    expect(events()).toEqual([expect.objectContaining({ outcome: "fault", fault_kind: "TypeError", replied: true })]);
    expect(JSON.stringify(events())).not.toContain("123456:secret");
  });

  it("keeps the handler's outcome when the reply itself fails, and sends nothing more (review R-06)", async () => {
    const events = captureEvents();
    const replyError = forbidden();
    const { ctx } = fakeContext(replyError);
    const reply = vi.spyOn(ctx, "reply");

    await run(ctx, answer("ok", 1));

    expect(reply).toHaveBeenCalledOnce();
    expect(events()).toEqual([
      expect.objectContaining({
        outcome: "ok",
        lookups: 1,
        replied: false,
        reply_failed: true,
        fault_kind: "sendMessage 403",
      }),
    ]);
  });

  it("writes one event for an edit and never runs the handler", async () => {
    const events = captureEvents();
    const { ctx } = fakeContext();
    (ctx as { editedMessage: unknown }).editedMessage = {};
    const handler = vi.fn(answer("ok"));

    await run(ctx, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(events()).toEqual([expect.objectContaining({ is_edit: true, outcome: "ignored", replied: false })]);
  });
});
