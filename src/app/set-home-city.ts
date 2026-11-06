import { parseCityQuery, searchLanguage } from "../domain/city-query";
import { type Place, pickBestMatch } from "../domain/place";
import { err, ok, type Result } from "../domain/result";
import { checkLimits, type LimitVerdict } from "../domain/usage-limits";
import type { Clock, HomeCityRepo, PlaceLookup, UsageCounter } from "./ports";

/** Every "couldn't find" or "unavailable" failure carries the current Home city, so the reply can say "your city is still …" (AC-05). */
export type SetCityError =
  | { readonly kind: "blank" | "user_limit" | "daily_limit" }
  | { readonly kind: "too_long" | "unknown_country" | "not_found" | "unavailable"; readonly current?: Place };

export interface SetCityResult {
  readonly place: Place;
  /** More than one populated place matched, so the reply hints at adding a country (AC-06). */
  readonly ambiguous: boolean;
}

type FailureWithCurrent = "too_long" | "unknown_country" | "not_found" | "unavailable";

function withCurrent(kind: FailureWithCurrent, current: Place | undefined): SetCityError {
  return current ? { kind, current } : { kind };
}

export interface SetHomeCityDeps {
  readonly repo: HomeCityRepo;
  readonly counter: UsageCounter;
  readonly lookup: PlaceLookup;
  readonly clock: Clock;
}

/**
 * Sets the chat's Home city from a query. Order (SAD §8 Request pipeline): parse, load the current city,
 * then for each outbound lookup check the limits and reserve it first; finally save. A Latin name makes one
 * English search. A non-Latin name ("Київ") is searched in its script's language and the picked place is
 * re-fetched with English names (T16). A Home city only changes to a found place (AC-05).
 * `onLookup` is told about every lookup made, for the request log.
 */
export function makeSetHomeCity({ repo, counter, lookup, clock }: SetHomeCityDeps) {
  return async (
    chatId: number,
    text: string,
    onLookup: () => void = () => undefined,
  ): Promise<Result<SetCityResult, SetCityError>> => {
    const query = parseCityQuery(text);
    if (!query.ok) {
      if (query.error === "blank") return err({ kind: "blank" });
      // Still a "couldn't find" reply, so it names the current city too (AC-05); one read, no lookup.
      return err(withCurrent(query.error, await repo.get(chatId)));
    }

    const current = await repo.get(chatId);
    const failure = (kind: "not_found" | "unavailable"): SetCityError => withCurrent(kind, current);
    const now = clock.now();

    /** Checks both limits and reserves one lookup before it is made, so failed calls count too (AC-17). */
    const reserveLookup = async (): Promise<LimitVerdict> => {
      const { daily, chatLastHour } = await counter.counts(chatId, now);
      const verdict = checkLimits(daily, chatLastHour);
      if (verdict !== "ok") return verdict;
      await counter.reserve(chatId, now);
      onLookup();
      return "ok";
    };

    const language = searchLanguage(query.value.name);
    const firstVerdict = await reserveLookup();
    if (firstVerdict !== "ok") return err({ kind: firstVerdict });
    const found = await lookup.find(query.value, language);
    if (!found.ok) return err(failure("unavailable"));

    const best = pickBestMatch(found.value);
    if (!best) return err(failure("not_found"));

    let place = best.place;
    if (language !== "en") {
      const secondVerdict = await reserveLookup();
      if (secondVerdict !== "ok") return err({ kind: secondVerdict });
      const english = await lookup.findById(best.placeId);
      if (!english.ok) return err(failure("unavailable"));
      place = english.value;
    }

    await repo.save(chatId, place, now);
    return ok({ place, ambiguous: best.ambiguous });
  };
}

export type SetHomeCity = ReturnType<typeof makeSetHomeCity>;
