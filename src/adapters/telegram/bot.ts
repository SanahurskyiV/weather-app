import { Bot } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import type { GetCurrentWeather } from "../../app/get-current-weather";
import type { GetHomeCity } from "../../app/get-home-city";
import type { Clock } from "../../app/ports";
import type { SetHomeCity } from "../../app/set-home-city";
import { registerCity } from "./commands/city";
import { registerGroup } from "./commands/group";
import { registerHelp } from "./commands/help";
import { registerStart } from "./commands/start";
import { registerWeather } from "./commands/weather";
import type { BotContext } from "./context";
import { requestLog } from "./request-log";

export interface BotDeps {
  readonly clock: Clock;
  readonly getHomeCity: GetHomeCity;
  readonly setHomeCity: SetHomeCity;
  readonly getCurrentWeather: GetCurrentWeather;
}

/** request-log → private chats (commands, then the help fallback) → groups (pointer). Channels get nothing. */
export function createBot(token: string, botInfo: UserFromGetMe | undefined, deps: BotDeps): Bot<BotContext> {
  const bot = new Bot<BotContext>(token, botInfo ? { botInfo } : {});
  bot.use(requestLog(deps.clock));

  const privateChats = bot.chatType("private");
  registerStart(privateChats, deps.getHomeCity);
  registerCity(privateChats, deps.setHomeCity);
  registerWeather(privateChats, deps.getCurrentWeather);
  registerHelp(privateChats);

  registerGroup(bot.chatType(["group", "supergroup"]));
  return bot;
}
