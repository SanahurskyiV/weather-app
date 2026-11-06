import type { GetHomeCity } from "../../../app/get-home-city";
import type { PrivateComposer } from "../context";
import { greetingReply } from "../replies";

/** /start: how to set a city and ask for the weather, naming the Home city when set (AC-11). */
export function registerStart(composer: PrivateComposer, getHomeCity: GetHomeCity): void {
  composer.command("start", async (ctx) => {
    const homeCity = await getHomeCity(ctx.chat.id);
    ctx.event.outcome = "ok";
    await ctx.reply(greetingReply(homeCity));
  });
}
