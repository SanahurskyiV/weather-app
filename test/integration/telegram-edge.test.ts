import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAULT_REPLY, greetingReply, groupPointerReply, HELP_REPLY } from "../../src/adapters/telegram/replies";
import groupCommand from "../fixtures/telegram-group-command-update.json";
import { buildApp } from "../../src/composition";
import { resetTables, seedHomeCity } from "./db-fixtures";
import {
  BOT_USERNAME,
  botAddedToGroup,
  CHAT_A,
  captureLogs,
  channelPost,
  editedPrivateText,
  GROUP,
  groupText,
  privateMessage,
  privateText,
  send,
  stubOutbound,
  webhookRequest,
} from "./telegram-harness";
import type { Update } from "grammy/types";

const KYIV = {
  name: "Kyiv",
  region: "Kyiv City",
  country: "Ukraine",
  latitude: 50.45,
  longitude: 30.52,
  timezone: "Europe/Kyiv",
};

async function homeCityRows(): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM home_cities").first<{ n: number }>();
  return row?.n ?? 0;
}

beforeEach(async () => {
  await resetTables(env.DB);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("webhook intake (flow A)", () => {
  it("drops a forged update silently: no reply, no log event", async () => {
    const out = stubOutbound();
    const logs = captureLogs();

    const response = await send(privateText("/start"), "wrong-secret");

    // Indistinguishable from an accepted update: a forger learns nothing (spec §6.1, review R-04).
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(out.calls).toEqual([]);
    expect(logs.updates()).toEqual([]);
  });

  it("drops an update with no secret header the same way (spec §6.1)", async () => {
    const out = stubOutbound();
    const logs = captureLogs();
    const request = webhookRequest(privateText("/start"));
    request.headers.delete("X-Telegram-Bot-Api-Secret-Token");

    const response = await exports.default.fetch(request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(out.calls).toEqual([]);
    expect(logs.updates()).toEqual([]);
  });

  it.each([
    ["empty", ""],
    ["unset", undefined],
  ])("fails closed when WEBHOOK_SECRET is %s (review R-07)", async (_label, secret) => {
    const out = stubOutbound();
    const logs = captureLogs();
    const misconfigured: Cloudflare.Env = { ...env };
    if (secret === undefined) delete (misconfigured as Partial<Cloudflare.Env>).WEBHOOK_SECRET;
    else misconfigured.WEBHOOK_SECRET = secret;
    const app = buildApp(misconfigured);

    const withEmpty = await app.handleUpdate(webhookRequest(privateText("/start"), ""));
    const withAny = await app.handleUpdate(webhookRequest(privateText("/start"), "anything"));

    expect([withEmpty.status, withAny.status]).toEqual([200, 200]);
    expect(out.calls).toEqual([]);
    expect(logs.updates()).toEqual([]);
    expect(logs.events().filter((e) => e.event === "startup_error")).toEqual([
      { event: "startup_error", reason: "WEBHOOK_SECRET missing" },
    ]);
  });

  it("logs an edited message once, marked as an edit, and does not reply or store anything (AC-12)", async () => {
    const out = stubOutbound();
    const logs = captureLogs();

    const response = await send(editedPrivateText("/city Kyiv"));

    expect(response.status).toBe(200);
    expect(out.calls).toEqual([]);
    expect(await homeCityRows()).toBe(0);
    expect(logs.updates()).toEqual([expect.objectContaining({ is_edit: true, outcome: "ignored", replied: false })]);
  });
});

describe("start greeting (AC-11)", () => {
  it("greets a new Bot user with how to set a city and ask for the weather", async () => {
    const out = stubOutbound();
    const logs = captureLogs();

    const update = privateText("/start");
    const response = await send(update);

    expect(response.status).toBe(200);
    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: greetingReply(undefined) }]);
    expect(out.lookups).toEqual([]);
    expect(greetingReply(undefined)).toContain("/city Kyiv");
    expect(greetingReply(undefined)).toContain("/weather");
    const [event] = logs.updates();
    expect(logs.updates()).toHaveLength(1);
    expect(event).toMatchObject({
      update_id: update.update_id,
      is_edit: false,
      chat: CHAT_A,
      chat_type: "private",
      command: "start",
      outcome: "ok",
      lookups: 0,
      replied: true,
    });
    expect(typeof event?.duration_ms).toBe("number");
  });

  it("names the Home city for a returning Bot user", async () => {
    await seedHomeCity(env.DB, { chat_id: CHAT_A });
    const out = stubOutbound();
    captureLogs();

    await send(privateText("/start"));

    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: greetingReply(KYIV) }]);
    expect(greetingReply(KYIV)).toContain("Kyiv, Kyiv City, Ukraine");
  });
});

describe("not understood (AC-12)", () => {
  const cases: [string, Update][] = [
    ["plain text", privateText("hello there")],
    ["an unknown command", privateText("/forecast")],
    [
      "a sticker",
      privateMessage({
        sticker: {
          file_id: "s",
          file_unique_id: "s",
          type: "regular",
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
        },
      }),
    ],
    ["a photo", privateMessage({ photo: [{ file_id: "p", file_unique_id: "p", width: 90, height: 90 }] })],
    ["a voice note", privateMessage({ voice: { file_id: "v", file_unique_id: "v", duration: 2 } })],
    ["a location pin", privateMessage({ location: { latitude: 50.45, longitude: 30.52 } })],
  ];

  it.each(cases)("answers %s with the help list and stores nothing", async (_label, update) => {
    const out = stubOutbound();
    const logs = captureLogs();

    await send(update);

    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: HELP_REPLY }]);
    expect(out.lookups).toEqual([]);
    expect(await homeCityRows()).toBe(0);
    expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "not_understood", replied: true, lookups: 0 })]);
  });

  it("lists the set-city command by its real name, followed by the city name (AC-12, spec §1)", () => {
    expect(HELP_REPLY).toContain("send /city followed by the city name");
    expect(HELP_REPLY).not.toContain("set-city");
    expect(HELP_REPLY).toContain("/weather");
  });
});

describe("groups and channels (AC-13)", () => {
  it.each([
    ["/city@weather_test_bot Kyiv (recorded)", groupCommand as Update, "city"],
    ["bare /city Kyiv", groupText("/city Kyiv"), "city"],
    ["/weather", groupText("/weather"), "weather"],
    [`/weather@${BOT_USERNAME}`, groupText(`/weather@${BOT_USERNAME}`), "weather"],
    ["/start", groupText("/start"), "start"],
  ])("answers the bot's own command %s with one private-chat pointer", async (_label, update, command) => {
    const out = stubOutbound();
    const logs = captureLogs();

    await send(update);

    expect(out.replies).toEqual([{ chat_id: GROUP, text: groupPointerReply(BOT_USERNAME) }]);
    expect(out.lookups).toEqual([]);
    expect(await homeCityRows()).toBe(0);
    expect(logs.updates()).toEqual([
      expect.objectContaining({
        chat: GROUP,
        chat_type: "supergroup",
        command,
        outcome: "group_pointer",
        replied: true,
      }),
    ]);
  });

  it.each([
    ["a command for another bot", groupText("/city@other_bot Kyiv")],
    ["plain group text", groupText("is it raining?")],
    ["the bot being added to a group", botAddedToGroup()],
    ["a channel post", channelPost("/weather")],
  ])("ignores %s with no reply", async (_label, update) => {
    const out = stubOutbound();
    const logs = captureLogs();

    const response = await send(update);

    expect(response.status).toBe(200);
    expect(out.calls).toEqual([]);
    expect(logs.updates()).toEqual([expect.objectContaining({ outcome: "ignored", replied: false })]);
  });

  it("points people to a private chat by the bot's username", () => {
    expect(groupPointerReply(BOT_USERNAME)).toContain("private chat");
    expect(groupPointerReply(BOT_USERNAME)).toContain(`@${BOT_USERNAME}`);
  });
});

describe("an invalid BOT_INFO (AC-13, AC-15, review R3-01)", () => {
  it.each([
    ["not JSON", "weather_test_bot"],
    ["the whole getMe response", JSON.stringify({ ok: true, result: JSON.parse(env.BOT_INFO ?? "{}") as unknown })],
    ["a user that is not a bot", JSON.stringify({ id: 1, is_bot: false, first_name: "Human", username: "human" })],
  ])("warns once when BOT_INFO is %s and falls back to getMe", async (_label, botInfo) => {
    const out = stubOutbound();
    const logs = captureLogs();
    const misconfigured: Cloudflare.Env = { ...env, BOT_INFO: botInfo };

    const app = buildApp(misconfigured);
    const first = await app.handleUpdate(webhookRequest(groupText("/weather")));
    const second = await app.handleUpdate(webhookRequest(groupText("/weather")));

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(logs.events().filter((e) => e.event === "startup_warning")).toEqual([
      { event: "startup_warning", reason: "BOT_INFO invalid" },
    ]);
    // The stubbed getMe answers with the real bot, so the pointer names its real username.
    expect(out.calls.filter((u) => u.pathname.endsWith("/getMe"))).toHaveLength(1);
    expect(out.replies.map((r) => r.text)).toEqual([groupPointerReply(BOT_USERNAME), groupPointerReply(BOT_USERNAME)]);
  });
});

describe("unexpected fault (AC-15)", () => {
  it("replies 'something went wrong', logs one fault event and still answers 200", async () => {
    const out = stubOutbound();
    const logs = captureLogs();
    vi.spyOn(env.DB, "prepare").mockImplementation(() => {
      throw new Error("D1 is on fire");
    });

    const response = await send(privateText("/start"));

    expect(response.status).toBe(200);
    expect(out.replies).toEqual([{ chat_id: CHAT_A, text: FAULT_REPLY }]);
    expect(FAULT_REPLY.toLowerCase()).toContain("something went wrong, please try again");
    expect(logs.updates()).toEqual([
      expect.objectContaining({ command: "start", outcome: "fault", fault_kind: "Error", replied: true }),
    ]);
  });

  it("keeps the real outcome when Telegram refuses the reply, and does not send a second one (review R-06)", async () => {
    const out = stubOutbound(undefined, {
      sendMessage: () =>
        Response.json(
          { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" },
          { status: 403 },
        ),
    });
    const logs = captureLogs();

    const response = await send(privateText("/start"));

    expect(response.status).toBe(200);
    expect(out.replies).toHaveLength(1);
    expect(logs.updates()).toEqual([
      expect.objectContaining({
        command: "start",
        outcome: "ok",
        replied: false,
        reply_failed: true,
        fault_kind: "sendMessage 403",
      }),
    ]);
  });
});

describe("log safety (AC-15)", () => {
  it("never logs the bot token, the webhook secret or the message text", async () => {
    stubOutbound();
    const logs = captureLogs();

    for (const update of [
      privateText("/start"),
      privateText("my secret plans"),
      groupText("/city Kyiv"),
      editedPrivateText("hi"),
    ]) {
      await send(update);
    }

    expect(logs.updates()).toHaveLength(4);
    const all = logs.lines.join("\n");
    expect(all).not.toContain(env.BOT_TOKEN);
    expect(all).not.toContain(env.WEBHOOK_SECRET);
    expect(all).not.toContain("my secret plans");
  });
});
