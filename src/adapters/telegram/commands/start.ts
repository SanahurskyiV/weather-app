import type { Bot } from "grammy";

export const START_MESSAGE =
  "Hi! I'm a weather bot. Soon you'll be able to pick a city, ask for the current weather, " +
  "and get heads-up alerts about rain or sharp temperature changes.";

export function registerStart(bot: Bot): void {
  bot.command("start", (ctx) => ctx.reply(START_MESSAGE));
}
