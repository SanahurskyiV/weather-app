/** A resolved populated place: what a Home city stores (data-model.md §Domain mapping). */
export interface Place {
  readonly name: string;
  /** First-level region ("Kyiv City"); absent when the place has none. */
  readonly region?: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  /** IANA timezone, e.g. "Europe/Kyiv". */
  readonly timezone: string;
}

/** One geocoding result, before the best match is picked. */
export interface PlaceCandidate extends Place {
  /** The source's place id, used to re-fetch the place with English names. */
  readonly id: number;
  /** GeoNames feature code: "PPLC" for a capital, "ADM1" for a region, "PCLI" for a country. */
  readonly featureCode: string;
  readonly population?: number;
}

export interface BestMatch {
  readonly place: Place;
  readonly placeId: number;
  /** More than one populated place matched, so the reply hints at adding a country (AC-06). */
  readonly ambiguous: boolean;
}

/** Cities, towns and villages (GeoNames "PPL*" codes), never regions or countries (AC-06). */
export function isPopulatedPlace(candidate: PlaceCandidate): boolean {
  return candidate.featureCode.startsWith("PPL");
}

/** The most populous populated place; a missing population ranks lowest, ties keep source order. */
export function pickBestMatch(candidates: readonly PlaceCandidate[]): BestMatch | undefined {
  const populated = candidates.filter(isPopulatedPlace);
  let best: PlaceCandidate | undefined;
  for (const candidate of populated) {
    if (!best || (candidate.population ?? -1) > (best.population ?? -1)) best = candidate;
  }
  if (!best) return undefined;
  return { place: toPlace(best), placeId: best.id, ambiguous: populated.length > 1 };
}

/** "Kyiv, Kyiv City, Ukraine", or "Monaco, Monaco" when there is no region (AC-01). */
export function formatPlaceName(place: Place): string {
  return [place.name, place.region, place.country].filter((part) => part !== undefined).join(", ");
}

export function toPlace({ name, region, country, latitude, longitude, timezone }: PlaceCandidate): Place {
  return { name, ...(region === undefined ? {} : { region }), country, latitude, longitude, timezone };
}
