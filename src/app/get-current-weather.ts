import type { Place } from "../domain/place";
import { err, ok, type Result } from "../domain/result";
import { checkLimits } from "../domain/usage-limits";
import type { CurrentWeather } from "../domain/weather";
import type { Clock, HomeCityRepo, UsageCounter, WeatherProvider } from "./ports";

export interface WeatherError {
  readonly kind: "no_home_city" | "unavailable" | "user_limit" | "daily_limit";
}

export interface HomeWeather {
  readonly place: Place;
  readonly weather: CurrentWeather;
}

export interface GetCurrentWeatherDeps {
  readonly repo: HomeCityRepo;
  readonly counter: UsageCounter;
  readonly weather: WeatherProvider;
  readonly clock: Clock;
}

/**
 * Current weather at the chat's Home city. Order (SAD §8 Request pipeline): load the Home city
 * (none → no counting, AC-09), check limits, reserve one lookup, then one forecast call.
 */
export function makeGetCurrentWeather({ repo, counter, weather, clock }: GetCurrentWeatherDeps) {
  return async (chatId: number): Promise<Result<HomeWeather, WeatherError>> => {
    const place = await repo.get(chatId);
    if (!place) return err({ kind: "no_home_city" });

    const now = clock.now();
    const { daily, chatLastHour } = await counter.counts(chatId, now);
    const verdict = checkLimits(daily, chatLastHour);
    if (verdict !== "ok") return err({ kind: verdict });

    // Reserved before the call, so a failed or timed-out fetch still counts (AC-17).
    await counter.reserve(chatId, now);
    const reading = await weather.current(place.latitude, place.longitude);
    if (!reading.ok) return err({ kind: "unavailable" });
    return ok({ place, weather: reading.value });
  };
}

export type GetCurrentWeather = ReturnType<typeof makeGetCurrentWeather>;
