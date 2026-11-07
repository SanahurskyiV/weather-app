// Port interfaces the use cases depend on. Adapters in src/adapters implement them.
// Every Home city read or write is keyed by the chat id of the incoming update (spec §6.1, AC-14).

import type { CityQuery } from "../domain/city-query";
import type { Place, PlaceCandidate } from "../domain/place";
import type { Result } from "../domain/result";
import type { CurrentWeather } from "../domain/weather";

/** Read time only through this port so tests can control it. */
export interface Clock {
  now(): Date;
}

/** One Home city per private chat; `save` replaces it (AC-02). */
export interface HomeCityRepo {
  get(chatId: number): Promise<Place | undefined>;
  save(chatId: number, place: Place, at: Date): Promise<void>;
}

export interface UsageCounts {
  /** Lookups reserved by the whole bot during the current UTC day (AC-17). */
  readonly daily: number;
  /** Lookups reserved by this chat in the rolling 60 minutes before `now` (AC-16). */
  readonly chatLastHour: number;
}

/** Lookup budgets (feature ADR-0001). */
export interface UsageCounter {
  counts(chatId: number, now: Date): Promise<UsageCounts>;
  /** Counts one lookup before it is made: today's counter, this chat's log row, and a prune of old rows. */
  reserve(chatId: number, now: Date): Promise<void>;
}

/** Place candidates for a name, optionally limited to one country. */
export interface PlaceLookup {
  /** Searches names in `language` ("en", or the query's script language for a non-Latin name). */
  find(query: CityQuery, language: string): Promise<Result<PlaceCandidate[], "unavailable">>;
  /** The place with this id, with English names. */
  findById(id: number): Promise<Result<Place, "unavailable">>;
}

/** Current conditions at a location. */
export interface WeatherProvider {
  current(latitude: number, longitude: number): Promise<Result<CurrentWeather, "unavailable">>;
}
