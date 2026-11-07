import { describe, expect, it } from "vitest";
import { COUNTRIES, resolveCountry } from "./countries";

describe("resolveCountry", () => {
  it.each([
    ["US", "US"],
    ["us", "US"],
    ["  Us  ", "US"],
    ["United States", "US"],
    ["united states", "US"],
    ["USA", "US"],
    ["usa", "US"],
    ["UK", "GB"],
    ["uk", "GB"],
    ["GB", "GB"],
    ["United Kingdom", "GB"],
    ["Ukraine", "UA"],
    ["UA", "UA"],
    ["France", "FR"],
    ["Japan", "JP"],
    ["Germany", "DE"],
  ])("resolves %j to %s", (text, code) => {
    expect(resolveCountry(text)).toBe(code);
  });

  it.each(["XX", "Texas", "", "   ", "U", "United", "Paris"])("does not resolve %j", (text) => {
    expect(resolveCountry(text)).toBeUndefined();
  });

  it("holds every ISO 3166-1 alpha-2 code exactly once with an English name", () => {
    const codes = Object.keys(COUNTRIES);
    expect(codes.length).toBe(249);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(COUNTRIES[code]?.length).toBeGreaterThan(1);
    }
  });

  it("has no English name that is also another country's code or alias", () => {
    const names = Object.values(COUNTRIES).map((n) => n.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name.length).toBeGreaterThan(2);
    }
  });
});
