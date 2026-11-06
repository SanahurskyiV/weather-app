import type { GroupComposer } from "../context";
import { groupPointerReply } from "../replies";

/** The bot's own commands. grammY matches them bare or addressed to this bot, never to another bot. */
export const BOT_COMMANDS = ["start", "city", "weather"];

/** In a group, the bot's own commands get one private-chat pointer; everything else is ignored (AC-13). */
export function registerGroup(composer: GroupComposer): void {
  composer.command(BOT_COMMANDS, async (ctx) => {
    ctx.event.outcome = "group_pointer";
    await ctx.reply(groupPointerReply(ctx.me.username));
  });
}
