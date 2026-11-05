import { Bot } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { registerStart } from "./commands/start";

export function createBot(token: string, botInfo?: UserFromGetMe): Bot {
  const bot = new Bot(token, botInfo ? { botInfo } : {});
  registerStart(bot);
  return bot;
}
