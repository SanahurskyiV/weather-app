import { describe, expect, it } from "vitest";
import { formatPlaceName, isPopulatedPlace, pickBestMatch, type PlaceCandidate } from "./place";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function candidate(overrides: Partial<PlaceCandidate> = {}): PlaceCandidate {
  return {
    id: 2988507,
    name: "Paris",
    region: "Île-de-France",
    country: "France",
    latitude: 48.85,
    longitude: 2.35,
    timezone: "Europe/Paris",
    featureCode: "PPLC",
    population: 2_138_551,
    ...overrides,
  };
}

function withoutPopulation(c: PlaceCandidate): PlaceCandidate {
  const copy: Mutable<PlaceCandidate> = { ...c };
  delete copy.population;
  return copy;
}

const parisFr = candidate();
const parisTx = candidate({
  region: "Texas",
  country: "United States",
  latitude: 33.66,
  longitude: -95.56,
  timezone: "America/Chicago",
  featureCode: "PPLA2",
  population: 24_171,
  id: 4717560,
});

describe("isPopulatedPlace", () => {
  it.each(["PPL", "PPLA", "PPLA2", "PPLA5", "PPLC", "PPLG", "PPLS", "PPLX"])("accepts %s", (featureCode) => {
    expect(isPopulatedPlace(candidate({ featureCode }))).toBe(true);
  });

  it.each(["ADM1", "ADM2", "PCLI", "PCL", "ISL", "AIRP", "", "XPPL"])("rejects %j", (featureCode) => {
    expect(isPopulatedPlace(candidate({ featureCode }))).toBe(false);
  });
});

describe("pickBestMatch", () => {
  it("never picks a region or a country (AC-06)", () => {
    const texas = candidate({ name: "Texas", featureCode: "ADM1", population: 29_000_000 });
    const france = candidate({ name: "France", featureCode: "PCLI", population: 67_000_000 });
    expect(pickBestMatch([texas, france])).toBeUndefined();
  });

  it("returns undefined for no candidates", () => {
    expect(pickBestMatch([])).toBeUndefined();
  });

  it("skips a more populous region and picks the most populous populated place (AC-06)", () => {
    const region = candidate({ featureCode: "ADM1", population: 12_000_000 });
    const best = pickBestMatch([parisTx, region, parisFr]);
    expect(best?.place.country).toBe("France");
    expect(best?.placeId).toBe(2988507);
    expect(best?.ambiguous).toBe(true);
  });

  it("returns a Place without the candidate-only fields", () => {
    expect(pickBestMatch([parisFr])?.place).toEqual({
      name: "Paris",
      region: "Île-de-France",
      country: "France",
      latitude: 48.85,
      longitude: 2.35,
      timezone: "Europe/Paris",
    });
  });

  it("marks a single populated candidate as not ambiguous", () => {
    const region = candidate({ featureCode: "ADM1" });
    const best = pickBestMatch([region, parisTx]);
    expect(best?.place.region).toBe("Texas");
    expect(best?.ambiguous).toBe(false);
  });

  it("falls back to source order when no candidate has a population (OQ-1)", () => {
    const a = withoutPopulation(candidate({ country: "A" }));
    const b = withoutPopulation(candidate({ country: "B" }));
    expect(pickBestMatch([a, b])?.place.country).toBe("A");
  });

  it("keeps source order on equal populations", () => {
    const a = candidate({ country: "A", population: 500 });
    const b = candidate({ country: "B", population: 500 });
    expect(pickBestMatch([a, b])?.place.country).toBe("A");
  });

  it("ranks a missing population below any number", () => {
    const unknown = withoutPopulation(candidate({ country: "Unknown" }));
    const small = candidate({ country: "Small", population: 1 });
    expect(pickBestMatch([unknown, small])?.place.country).toBe("Small");
  });
});

describe("formatPlaceName", () => {
  it("names city, region and country (AC-01)", () => {
    expect(formatPlaceName({ ...parisFr, name: "Kyiv", region: "Kyiv City", country: "Ukraine" })).toBe(
      "Kyiv, Kyiv City, Ukraine",
    );
  });

  it("leaves out a missing region (AC-01)", () => {
    const noRegion: Mutable<PlaceCandidate> = { ...parisFr };
    delete noRegion.region;
    expect(formatPlaceName({ ...noRegion, name: "Monaco", country: "Monaco" })).toBe("Monaco, Monaco");
  });
});
