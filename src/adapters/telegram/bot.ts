import { Bot } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import type { GetHomeCity } from "../../app/get-home-city";
import type { Clock } from "../../app/ports";
import { registerGroup } from "./commands/group";
import { registerHelp } from "./commands/help";
import { registerStart } from "./commands/start";
import type { BotContext } from "./context";
import { requestLog } from "./request-log";

export interface BotDeps {
  readonly clock: Clock;
  readonly getHomeCity: GetHomeCity;
}

/** request-log → private chats (commands, then the help fallback) → groups (pointer). Channels get nothing. */
export function createBot(token: string, botInfo: UserFromGetMe | undefined, deps: BotDeps): Bot<BotContext> {
  const bot = new Bot<BotContext>(token, botInfo ? { botInfo } : {});
  bot.use(requestLog(deps.clock));

  const privateChats = bot.chatType("private");
  registerStart(privateChats, deps.getHomeCity);
  registerHelp(privateChats);

  registerGroup(bot.chatType(["group", "supergroup"]));
  return bot;
}
