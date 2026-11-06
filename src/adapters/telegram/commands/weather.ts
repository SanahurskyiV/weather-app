import type { GetCurrentWeather } from "../../../app/get-current-weather";
import type { PrivateComposer } from "../context";
import { weatherErrorReply, weatherReply } from "../replies";

/** /weather: current conditions at the Home city (AC-08 to AC-10, AC-16, AC-17). */
export function registerWeather(composer: PrivateComposer, getCurrentWeather: GetCurrentWeather): void {
  composer.command("weather", async (ctx) => {
    const result = await getCurrentWeather(ctx.chat.id);
    if (result.ok) {
      const { place, weather } = result.value;
      ctx.event.outcome = "ok";
      ctx.event.lookups = 1;
      ctx.event.reading_time = weather.readingTime.toISOString();
      await ctx.reply(weatherReply(place, weather));
      return;
    }
    ctx.event.outcome = result.error.kind;
    // A forecast call was made (and counted) only when the source failed (AC-17).
    ctx.event.lookups = result.error.kind === "unavailable" ? 1 : 0;
    await ctx.reply(weatherErrorReply(result.error));
  });
}
