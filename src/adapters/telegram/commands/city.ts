import type { SetHomeCity } from "../../../app/set-home-city";
import type { PrivateComposer } from "../context";
import { cityOkReply, setCityErrorReply } from "../replies";

/** /city <name>: set the Home city (AC-01 to AC-07, AC-16, AC-17). */
export function registerCity(composer: PrivateComposer, setHomeCity: SetHomeCity): void {
  composer.command("city", async (ctx) => {
    const result = await setHomeCity(ctx.chat.id, ctx.match, () => {
      ctx.event.lookups++;
    });
    if (result.ok) {
      ctx.event.outcome = "ok";
      await ctx.reply(cityOkReply(result.value.place, result.value.ambiguous));
      return;
    }
    ctx.event.outcome = result.error.kind;
    await ctx.reply(setCityErrorReply(result.error));
  });
}
