import { resolveCountry } from "./countries";
import { err, ok, type Result } from "./result";

/** Longest accepted set-city query, in visible characters (AC-04). */
export const MAX_QUERY_LENGTH = 100;

export interface CityQuery {
  readonly name: string;
  readonly countryCode?: string;
}

export type CityQueryError = "blank" | "too_long" | "unknown_country";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function visibleLength(text: string): number {
  return Array.from(graphemes.segment(text)).length;
}

/**
 * Reads a set-city query: "Kyiv", "Київ" or "Paris, US". Only the text after the last comma is read as
 * a country (AC-07). The name is kept exactly as typed; the lookup decides whether it exists (AC-04).
 */
export function parseCityQuery(text: string): Result<CityQuery, CityQueryError> {
  const trimmed = text.trim();
  if (trimmed === "") return err("blank");
  if (visibleLength(trimmed) > MAX_QUERY_LENGTH) return err("too_long");

  const comma = trimmed.lastIndexOf(",");
  if (comma === -1) return ok({ name: trimmed });

  const name = trimmed.slice(0, comma).trim();
  const countryText = trimmed.slice(comma + 1).trim();
  if (name === "") return err("blank");
  // "Paris," with nothing after the comma: read as no country (owner default, T2 edge case).
  if (countryText === "") return ok({ name });

  const countryCode = resolveCountry(countryText);
  return countryCode ? ok({ name, countryCode }) : err("unknown_country");
}
