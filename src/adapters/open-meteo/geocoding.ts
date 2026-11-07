import type { PlaceLookup } from "../../app/ports";
import { type PlaceCandidate, toPlace } from "../../domain/place";
import { err, ok } from "../../domain/result";
import { fetchJson, isFiniteNumber, isRecord } from "./http";

const SEARCH_URL = "https://geocoding-api.open-meteo.com/v1/search";
const GET_URL = "https://geocoding-api.open-meteo.com/v1/get";
const MAX_CANDIDATES = 10;

/** True when the runtime can format times in this IANA zone (the weather reply needs it, AC-08). */
function isKnownTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Maps one place entry; `undefined` when a required field is missing or mistyped, or the timezone is unknown. */
function toCandidate(entry: unknown): PlaceCandidate | undefined {
  if (!isRecord(entry)) return undefined;
  const { id, name, admin1, country, latitude, longitude, timezone, feature_code, population } = entry;
  if (
    !isFiniteNumber(id) ||
    typeof name !== "string" ||
    typeof country !== "string" ||
    typeof timezone !== "string" ||
    typeof feature_code !== "string" ||
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude) ||
    !isKnownTimeZone(timezone)
  ) {
    return undefined;
  }
  return {
    id,
    name,
    ...(typeof admin1 === "string" ? { region: admin1 } : {}),
    country,
    latitude,
    longitude,
    timezone,
    featureCode: feature_code,
    ...(isFiniteNumber(population) ? { population } : {}),
  };
}

/** PlaceLookup over Open-Meteo Geocoding: top 10 candidates in the requested language (SAD §5, T16). */
export function makeOpenMeteoGeocoding(): PlaceLookup {
  return {
    async find({ name, countryCode }, language) {
      const url = new URL(SEARCH_URL);
      url.searchParams.set("name", name);
      url.searchParams.set("count", String(MAX_CANDIDATES));
      url.searchParams.set("language", language);
      url.searchParams.set("format", "json");
      if (countryCode !== undefined) url.searchParams.set("countryCode", countryCode);

      const body = await fetchJson(url);
      if (!body.ok || !isRecord(body.value)) return err("unavailable");
      const { results } = body.value;
      if (results === undefined) return ok([]); // the source omits `results` when nothing matches
      if (!Array.isArray(results)) return err("unavailable");

      // A bad entry is skipped, not fatal: one odd place must not block every retry (review R-05).
      const candidates = results.map(toCandidate).filter((c) => c !== undefined);
      return candidates.length > 0 || results.length === 0 ? ok(candidates) : err("unavailable");
    },

    async findById(id) {
      const url = new URL(GET_URL);
      url.searchParams.set("id", String(id));
      url.searchParams.set("language", "en");

      const body = await fetchJson(url);
      const candidate = body.ok ? toCandidate(body.value) : undefined;
      return candidate ? ok(toPlace(candidate)) : err("unavailable");
    },
  };
}
