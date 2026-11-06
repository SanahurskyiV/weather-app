import { parseCityQuery } from "../domain/city-query";
import { type BestMatch, type Place, pickBestMatch } from "../domain/place";
import { err, ok, type Result } from "../domain/result";
import { checkLimits } from "../domain/usage-limits";
import type { Clock, HomeCityRepo, PlaceLookup, UsageCounter } from "./ports";

/** `not_found` and `unavailable` carry the current Home city so the reply can say "your city is still …" (AC-05). */
export type SetCityError =
  | { readonly kind: "blank" | "too_long" | "unknown_country" | "user_limit" | "daily_limit" }
  | { readonly kind: "not_found" | "unavailable"; readonly current?: Place };

export interface SetHomeCityDeps {
  readonly repo: HomeCityRepo;
  readonly counter: UsageCounter;
  readonly lookup: PlaceLookup;
  readonly clock: Clock;
}

/**
 * Sets the chat's Home city from a query. Order (SAD §8 Request pipeline): parse, load the current city,
 * check limits, reserve one lookup, look up, pick, save. A Home city only changes to a found place (AC-05).
 */
export function makeSetHomeCity({ repo, counter, lookup, clock }: SetHomeCityDeps) {
  return async (chatId: number, text: string): Promise<Result<BestMatch, SetCityError>> => {
    const query = parseCityQuery(text);
    if (!query.ok) return err({ kind: query.error });

    const current = await repo.get(chatId);
    const now = clock.now();
    const { daily, chatLastHour } = await counter.counts(chatId, now);
    const verdict = checkLimits(daily, chatLastHour);
    if (verdict !== "ok") return err({ kind: verdict });

    // Reserved before the call, so a failed or timed-out lookup still counts (AC-17).
    await counter.reserve(chatId, now);
    const found = await lookup.find(query.value);
    const failure = (kind: "not_found" | "unavailable"): SetCityError => (current ? { kind, current } : { kind });
    if (!found.ok) return err(failure("unavailable"));

    const best = pickBestMatch(found.value);
    if (!best) return err(failure("not_found"));

    await repo.save(chatId, best.place, now);
    return ok(best);
  };
}

export type SetHomeCity = ReturnType<typeof makeSetHomeCity>;
