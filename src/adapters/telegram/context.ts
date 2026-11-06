import type { ChatTypeContext, Composer, Context } from "grammy";

/** `ok` or a failure kind (SAD §8 Logging). `ignored`: an accepted update the bot does not answer. */
export type Outcome =
  | "ok"
  | "blank"
  | "too_long"
  | "not_found"
  | "unknown_country"
  | "unavailable"
  | "user_limit"
  | "daily_limit"
  | "no_home_city"
  | "not_understood"
  | "group_pointer"
  | "fault"
  | "ignored";

/** The one `update` log event per accepted update (feature ADR-0002). Never the token, secret or text. */
export interface UpdateEvent {
  update_id: number;
  is_edit: boolean;
  chat: number | null;
  chat_type: string | null;
  command: string | null;
  outcome: Outcome;
  lookups: number;
  replied: boolean;
  reading_time?: string;
  /** The reply was attempted and Telegram (or the network) refused it; `outcome` keeps the handler's result. */
  reply_failed?: boolean;
  /** What went wrong, for a `fault` or a failed reply: the error's name, or the grammY method and error code. Never its message. */
  fault_kind?: string;
}

export type BotContext = Context & { event: UpdateEvent };

export type PrivateComposer = Composer<ChatTypeContext<BotContext, "private">>;
export type GroupComposer = Composer<ChatTypeContext<BotContext, "group" | "supergroup">>;
