import { type Context, GrammyError, type MiddlewareFn } from "grammy";
import type { Clock } from "../../app/ports";
import { log } from "../log";
import type { BotContext, UpdateEvent } from "./context";
import { FAULT_REPLY } from "./replies";

/** "/city@weather_bot Kyiv" → "city"; null when the message does not start with a command. */
function commandOf(ctx: Context): string | null {
  const msg = ctx.msg;
  const text = msg?.text ?? msg?.caption;
  const entity = (msg?.entities ?? msg?.caption_entities)?.[0];
  if (text === undefined || entity?.type !== "bot_command" || entity.offset !== 0) return null;
  return text.slice(1, entity.length).split("@")[0]?.toLowerCase() ?? null;
}

/** A secret-free label for an error: "sendMessage 403" for a Bot API refusal, else the error's name. */
function faultKind(error: unknown): string {
  if (error instanceof GrammyError) return `${error.method} ${String(error.error_code)}`;
  return error instanceof Error ? error.name : "unknown";
}

/**
 * Outermost middleware (feature ADR-0002). Starts the update's event, lets handlers fill it in, and
 * writes exactly one `update` log event in `finally`. An unexpected fault gets the fault reply and is
 * swallowed, so the webhook still answers 200 (CLAUDE.md). Edits are logged and never answered (AC-12).
 */
export function requestLog(clock: Clock): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const started = clock.now().getTime();
    const isEdit = ctx.editedMessage !== undefined || ctx.editedChannelPost !== undefined;
    const event: UpdateEvent = {
      update_id: ctx.update.update_id,
      is_edit: isEdit,
      chat: ctx.chat?.id ?? null,
      chat_type: ctx.chat?.type ?? null,
      command: commandOf(ctx),
      outcome: "ignored",
      lookups: 0,
      replied: false,
    };
    ctx.event = event;

    const reply = ctx.reply.bind(ctx);
    ctx.reply = async (...args) => {
      try {
        const sent = await reply(...args);
        event.replied = true;
        return sent;
      } catch (error) {
        event.reply_failed = true;
        throw error;
      }
    };

    try {
      if (!isEdit) await next();
    } catch (error) {
      event.fault_kind = faultKind(error);
      // A refused reply is not a fault of the request: keep its outcome and do not try to send again (review R-06).
      if (!event.reply_failed) {
        event.outcome = "fault";
        if (ctx.chat?.type === "private" && !event.replied) {
          await ctx.reply(FAULT_REPLY).catch(() => undefined);
        }
      }
    } finally {
      log("update", { ...event, duration_ms: clock.now().getTime() - started });
    }
  };
}
