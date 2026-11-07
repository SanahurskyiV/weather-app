import type { PrivateComposer } from "../context";
import { HELP_REPLY } from "../replies";

/** Fallback for anything else in a private chat: text, unknown commands, stickers, photos… (AC-12). Register last. */
export function registerHelp(composer: PrivateComposer): void {
  composer.on("message", async (ctx) => {
    ctx.event.outcome = "not_understood";
    await ctx.reply(HELP_REPLY);
  });
}
