import { env, exports } from "cloudflare:workers";
import type { Update } from "grammy/types";
import { vi } from "vitest";
import { WEBHOOK_PATH } from "../../src/adapters/telegram/webhook-path";
import sendMessageOk from "../fixtures/telegram-send-message-ok.json";

// Webhook test harness: build Telegram updates, send them through the Worker, and observe every
// outbound call (Telegram replies, Open-Meteo lookups) and every `update` log event.

export const BOT_USERNAME = "weather_test_bot";
export const CHAT_A = 100001;
export const CHAT_B = 100002;
export const GROUP = -100500;

let nextUpdateId = 5000;
const DATE = 1793865600;

function commandEntities(text: string) {
  if (!text.startsWith("/")) return undefined;
  const length = text.split(/\s/, 1)[0]?.length ?? 1;
  return [{ type: "bot_command" as const, offset: 0, length }];
}

/** A message from a person in their private chat, `text` or any other message content. */
export function privateMessage(content: Record<string, unknown>, chatId = CHAT_A): Update {
  return {
    update_id: nextUpdateId++,
    message: {
      message_id: nextUpdateId,
      date: DATE,
      chat: { id: chatId, type: "private", first_name: "Test" },
      from: { id: chatId, is_bot: false, first_name: "Test" },
      ...content,
    },
  };
}

export function privateText(text: string, chatId = CHAT_A): Update {
  const entities = commandEntities(text);
  return privateMessage({ text, ...(entities ? { entities } : {}) }, chatId);
}

export function editedPrivateText(text: string, chatId = CHAT_A): Update {
  const { message, update_id } = privateText(text, chatId);
  return { update_id, edited_message: { ...message, edit_date: DATE + 60 } } as Update;
}

export function groupText(text: string, chatId = GROUP, fromId = CHAT_A): Update {
  const entities = commandEntities(text);
  return {
    update_id: nextUpdateId++,
    message: {
      message_id: nextUpdateId,
      date: DATE,
      chat: { id: chatId, type: "supergroup", title: "Friends" },
      from: { id: fromId, is_bot: false, first_name: "Test" },
      text,
      ...(entities ? { entities } : {}),
    },
  };
}

export function botAddedToGroup(chatId = GROUP): Update {
  return {
    update_id: nextUpdateId++,
    message: {
      message_id: nextUpdateId,
      date: DATE,
      chat: { id: chatId, type: "group", title: "Friends" },
      from: { id: CHAT_A, is_bot: false, first_name: "Test" },
      new_chat_members: [{ id: 123456, is_bot: true, first_name: "Weather Bot", username: BOT_USERNAME }],
    },
  };
}

export function channelPost(text: string): Update {
  const entities = commandEntities(text);
  return {
    update_id: nextUpdateId++,
    channel_post: {
      message_id: nextUpdateId,
      date: DATE,
      chat: { id: -100900, type: "channel", title: "News" },
      text,
      ...(entities ? { entities } : {}),
    },
  };
}

export function webhookRequest(update: Update, secret: string = env.WEBHOOK_SECRET): Request {
  return new Request(`https://bot.example${WEBHOOK_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
    body: JSON.stringify(update),
  });
}

export function send(update: Update, secret?: string): Promise<Response> {
  return exports.default.fetch(webhookRequest(update, secret));
}

export interface SentMessage {
  chat_id: number;
  text: string;
  parse_mode?: string;
}

type OpenMeteoAnswer = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

function urlOf(input: RequestInfo | URL): URL {
  return new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
}

/**
 * Stubs all outbound HTTP. Telegram `sendMessage` is recorded and answers OK (or `sendMessage()` when given);
 * Open-Meteo calls go to `openMeteo` (default: fail the test loudly). Anything else throws.
 */
export function stubOutbound(openMeteo?: OpenMeteoAnswer, { sendMessage }: { sendMessage?: () => Response } = {}) {
  const replies: SentMessage[] = [];
  const lookups: URL[] = [];
  const calls: URL[] = [];
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = urlOf(input);
    calls.push(url);
    if (url.hostname === "api.telegram.org") {
      // Only made when BOT_INFO is not configured.
      if (url.pathname.endsWith("/getMe"))
        return Response.json({ ok: true, result: JSON.parse(env.BOT_INFO ?? "{}") as unknown });
      if (!url.pathname.endsWith("/sendMessage")) throw new Error(`unexpected Telegram call ${url.pathname}`);
      const raw = init?.body;
      replies.push(JSON.parse(typeof raw === "string" ? raw : "{}") as SentMessage);
      return sendMessage ? sendMessage() : Response.json(sendMessageOk);
    }
    if (url.hostname.endsWith("open-meteo.com")) {
      lookups.push(url);
      if (!openMeteo) throw new Error(`unexpected Open-Meteo call ${url.href}`);
      return openMeteo(url, init);
    }
    throw new Error(`unexpected outbound call ${url.href}`);
  });
  return { spy, replies, lookups, calls };
}

export interface UpdateEvent {
  event: "update";
  update_id: number;
  is_edit: boolean;
  chat: number | null;
  chat_type: string | null;
  command: string | null;
  outcome: string;
  lookups: number;
  duration_ms: number;
  replied: boolean;
  reading_time?: string;
  reply_failed?: boolean;
  fault_kind?: string;
}

/** Captures every console.log line; `updates()` are the parsed `update` events. */
export function captureLogs() {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  });
  const parsed = () =>
    lines.flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
  return {
    lines,
    events: parsed,
    updates: () => parsed().filter((e): e is UpdateEvent & Record<string, unknown> => e.event === "update"),
  };
}
