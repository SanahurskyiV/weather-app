import type { PlaceLookup } from "../../app/ports";
import type { PlaceCandidate } from "../../domain/place";
import { err, ok } from "../../domain/result";
import { fetchJson, isFiniteNumber, isRecord } from "./http";

const SEARCH_URL = "https://geocoding-api.open-meteo.com/v1/search";
const MAX_CANDIDATES = 10;

/** Maps one `results[]` entry; `undefined` when a required field is missing or mistyped. */
function toCandidate(entry: unknown): PlaceCandidate | undefined {
  if (!isRecord(entry)) return undefined;
  const { name, admin1, country, latitude, longitude, timezone, feature_code, population } = entry;
  if (
    typeof name !== "string" ||
    typeof country !== "string" ||
    typeof timezone !== "string" ||
    typeof feature_code !== "string" ||
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude)
  ) {
    return undefined;
  }
  return {
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

/** PlaceLookup over Open-Meteo Geocoding: top 10 candidates with English names (SAD §5). */
export function makeOpenMeteoGeocoding(): PlaceLookup {
  return {
    async find({ name, countryCode }) {
      const url = new URL(SEARCH_URL);
      url.searchParams.set("name", name);
      url.searchParams.set("count", String(MAX_CANDIDATES));
      url.searchParams.set("language", "en");
      url.searchParams.set("format", "json");
      if (countryCode !== undefined) url.searchParams.set("countryCode", countryCode);

      const body = await fetchJson(url);
      if (!body.ok || !isRecord(body.value)) return err("unavailable");
      const { results } = body.value;
      if (results === undefined) return ok([]); // the source omits `results` when nothing matches
      if (!Array.isArray(results)) return err("unavailable");

      const candidates: PlaceCandidate[] = [];
      for (const entry of results) {
        const candidate = toCandidate(entry);
        if (!candidate) return err("unavailable");
        candidates.push(candidate);
      }
      return ok(candidates);
    },
  };
}
