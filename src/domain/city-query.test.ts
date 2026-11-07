import { describe, expect, it } from "vitest";
import { MAX_QUERY_LENGTH, parseCityQuery, searchLanguage } from "./city-query";
import { err, ok } from "./result";

// "é" written as "e" + combining acute accent: one visible character, two UTF-16 units.
const COMBINING_E = "é";

describe("parseCityQuery", () => {
  it.each(["", "   ", "\t \t", ", US", "  ,  us "])("refuses %j as blank (AC-03)", (text) => {
    expect(parseCityQuery(text)).toEqual(err("blank"));
  });

  it.each([
    ["Kyiv", ok({ name: "Kyiv" })],
    ["  Kyiv  ", ok({ name: "Kyiv" })],
    ["Київ", ok({ name: "Київ" })],
    ["New York", ok({ name: "New York" })],
  ])("keeps the name %j as typed (AC-04)", (text, expected) => {
    expect(parseCityQuery(text)).toEqual(expected);
  });

  it.each(["Paris, US", "paris, us", "Paris, USA", "Paris, United States", "Paris,US", "  Paris ,  us  "])(
    "reads the country after the comma in %j (AC-07)",
    (text) => {
      const result = parseCityQuery(text);
      expect(result).toEqual(ok({ name: text.split(",")[0]?.trim(), countryCode: "US" }));
    },
  );

  it("splits on the last comma only", () => {
    expect(parseCityQuery("Washington, D.C., US")).toEqual(ok({ name: "Washington, D.C.", countryCode: "US" }));
  });

  it.each(["Paris, XX", "Paris, Texas", "Springfield, Illinois"])("refuses %j as unknown_country (AC-07)", (text) => {
    expect(parseCityQuery(text)).toEqual(err("unknown_country"));
  });

  it("leaves 'no place of that name in the country' to the lookup", () => {
    expect(parseCityQuery("Paris, Japan")).toEqual(ok({ name: "Paris", countryCode: "JP" }));
  });

  it("treats an empty country after a trailing comma as no country (owner default for 'Paris,')", () => {
    expect(parseCityQuery("Paris,")).toEqual(ok({ name: "Paris" }));
    expect(parseCityQuery("Paris,   ")).toEqual(ok({ name: "Paris" }));
  });

  it("accepts exactly 100 visible characters and refuses 101 (AC-04)", () => {
    expect(MAX_QUERY_LENGTH).toBe(100);
    expect(parseCityQuery("a".repeat(100))).toEqual(ok({ name: "a".repeat(100) }));
    expect(parseCityQuery("a".repeat(101))).toEqual(err("too_long"));
  });

  it("counts graphemes, not UTF-16 units (AC-04)", () => {
    const hundred = COMBINING_E.repeat(100); // 200 UTF-16 units, 100 visible characters
    expect(parseCityQuery(hundred)).toEqual(ok({ name: hundred }));
    expect(parseCityQuery(COMBINING_E.repeat(101))).toEqual(err("too_long"));
    expect(parseCityQuery("👍🏽".repeat(100)).ok).toBe(true);
  });

  it("checks the length before the country split", () => {
    expect(parseCityQuery(`${"a".repeat(100)}, XX`)).toEqual(err("too_long"));
  });

  it("measures the trimmed text", () => {
    expect(parseCityQuery(`  ${"a".repeat(100)}  `)).toEqual(ok({ name: "a".repeat(100) }));
  });
});

describe("searchLanguage", () => {
  it.each(["Kyiv", "Paris", "São Paulo", "Zürich", "Łódź", "Washington, D.C.", "1st Street", ""])(
    "searches %j in English",
    (name) => {
      expect(searchLanguage(name)).toBe("en");
    },
  );

  it.each([
    ["Київ", "uk"],
    ["Львів", "uk"],
    ["Kyiv Київ", "uk"],
    ["Αθήνα", "el"],
    ["القاهرة", "ar"],
    ["תל אביב", "he"],
    ["თბილისი", "ka"],
    ["東京", "zh"],
    ["とうきょう", "ja"],
    ["서울", "ko"],
  ])("searches %j in its script's language %s (AC-01)", (name, language) => {
    expect(searchLanguage(name)).toBe(language);
  });

  it("falls back to English for a script without a mapped language", () => {
    expect(searchLanguage("ᚠᚢᚦ")).toBe("en");
  });
});
