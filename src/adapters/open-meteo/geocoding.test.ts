import { afterEach, describe, expect, it, vi } from "vitest";
import empty from "../../../test/fixtures/open-meteo-geocoding-empty.json";
import getKyiv from "../../../test/fixtures/open-meteo-get-kyiv.json";
import kyivUk from "../../../test/fixtures/open-meteo-geocoding-kyiv-uk.json";
import paris from "../../../test/fixtures/open-meteo-geocoding-paris.json";
import { err, ok } from "../../domain/result";
import { makeOpenMeteoGeocoding } from "./geocoding";
import { hangingFetch, requestedUrl } from "./test-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

function stubFetch(body: unknown, init: ResponseInit = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(Response.json(body, init)));
}

describe("Open-Meteo geocoding", () => {
  it("asks for English names and at most 10 results, with no country filter by default (AC-06)", async () => {
    const spy = stubFetch(paris);

    await makeOpenMeteoGeocoding().find({ name: "Paris" }, "en");

    const url = requestedUrl(spy);
    expect(url.origin + url.pathname).toBe("https://geocoding-api.open-meteo.com/v1/search");
    expect(url.searchParams.get("name")).toBe("Paris");
    expect(url.searchParams.get("count")).toBe("10");
    expect(url.searchParams.get("language")).toBe("en");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.has("countryCode")).toBe(false);
  });

  it("passes the country filter when given (AC-07)", async () => {
    const spy = stubFetch(paris);

    await makeOpenMeteoGeocoding().find({ name: "Paris", countryCode: "US" }, "en");

    expect(requestedUrl(spy).searchParams.get("countryCode")).toBe("US");
  });

  it("sends a non-ASCII name as typed, URL-encoded", async () => {
    const spy = stubFetch(empty);

    await makeOpenMeteoGeocoding().find({ name: "Київ" }, "en");

    expect(requestedUrl(spy).searchParams.get("name")).toBe("Київ");
    expect(requestedUrl(spy).search).toContain("name=%D0%9A%D0%B8%D1%97%D0%B2");
  });

  it("maps the recorded Paris answer to place candidates (AC-06)", async () => {
    stubFetch(paris);

    const result = await makeOpenMeteoGeocoding().find({ name: "Paris" }, "en");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(10);
    expect(result.value[0]).toEqual({
      id: 2988507,
      name: "Paris",
      region: "Île-de-France Region",
      country: "France",
      latitude: 48.85341,
      longitude: 2.3488,
      timezone: "Europe/Paris",
      featureCode: "PPLC",
      population: 2138551,
    });
    expect(result.value[1]).toMatchObject({ region: "Texas", country: "United States", featureCode: "PPLA2" });
  });

  it("leaves region and population undefined when the source omits them", async () => {
    stubFetch({
      results: [
        {
          id: 1,
          name: "Nowhere",
          country: "Monaco",
          latitude: 1,
          longitude: 2,
          timezone: "Europe/Monaco",
          feature_code: "PPL",
        },
      ],
    });

    const result = await makeOpenMeteoGeocoding().find({ name: "Nowhere" }, "en");

    expect(result.ok && result.value[0]).toEqual({
      id: 1,
      name: "Nowhere",
      country: "Monaco",
      latitude: 1,
      longitude: 2,
      timezone: "Europe/Monaco",
      featureCode: "PPL",
    });
  });

  it("returns an empty list when the answer has no results (AC-04)", async () => {
    stubFetch(empty);

    expect(await makeOpenMeteoGeocoding().find({ name: "Xyzzyqq" }, "en")).toEqual({ ok: true, value: [] });
  });

  it("reports a server error as unavailable (AC-04b)", async () => {
    stubFetch({ error: true, reason: "boom" }, { status: 500 });

    expect(await makeOpenMeteoGeocoding().find({ name: "Paris" }, "en")).toEqual(err("unavailable"));
  });

  it("reports a network error as unavailable (AC-04b)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network connection lost."));

    expect(await makeOpenMeteoGeocoding().find({ name: "Paris" }, "en")).toEqual(err("unavailable"));
  });

  it("reports an unreadable answer as unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>oops</html>", { status: 200 }));

    expect(await makeOpenMeteoGeocoding().find({ name: "Paris" }, "en")).toEqual(err("unavailable"));
  });

  it("reports an answer whose every entry is malformed as unavailable", async () => {
    stubFetch({ results: [{ name: "Paris" }, { name: "Paris", country: "France" }] });

    expect(await makeOpenMeteoGeocoding().find({ name: "Paris" }, "en")).toEqual(err("unavailable"));
  });

  it("skips a malformed entry and keeps the valid ones (review R-05)", async () => {
    stubFetch({
      results: [{ id: 1, name: "Paris", latitude: 1, longitude: 2, feature_code: "PPL" }, ...paris.results],
    });

    const result = await makeOpenMeteoGeocoding().find({ name: "Paris" }, "en");

    expect(result.ok && result.value.map((c) => c.id)).toEqual(paris.results.map((r) => r.id));
  });

  it("skips an entry whose timezone the runtime does not know (review R-14)", async () => {
    const [first, ...rest] = paris.results;
    stubFetch({ results: [{ ...first, timezone: "Mars/Olympus_Mons" }, ...rest] });

    const result = await makeOpenMeteoGeocoding().find({ name: "Paris" }, "en");

    expect(result.ok && result.value.map((c) => c.id)).toEqual(rest.map((r) => r.id));
  });

  it("cuts every search off after exactly 1.5 seconds (AC-04b)", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    stubFetch(paris);

    await makeOpenMeteoGeocoding().find({ name: "Paris" }, "en");

    expect(timeout).toHaveBeenCalledWith(1500);
  });

  it("gives up after 1.5 seconds and reports unavailable (AC-04b)", async () => {
    const spy = hangingFetch();

    expect(await makeOpenMeteoGeocoding().find({ name: "Paris" }, "en")).toEqual(err("unavailable"));
    expect(spy).toHaveBeenCalledOnce();
  }, 5000);

  it("searches in the requested language for a non-Latin name (AC-01)", async () => {
    const spy = stubFetch(kyivUk);

    const result = await makeOpenMeteoGeocoding().find({ name: "Київ" }, "uk");

    expect(requestedUrl(spy).searchParams.get("language")).toBe("uk");
    expect(result.ok && result.value[0]).toMatchObject({ id: 703448, name: "Київ", featureCode: "PPLC" });
  });
});

describe("Open-Meteo geocoding by id", () => {
  it("re-fetches a place by id with English names (AC-01)", async () => {
    const spy = stubFetch(getKyiv);

    const result = await makeOpenMeteoGeocoding().findById(703448);

    const url = requestedUrl(spy);
    expect(url.origin + url.pathname).toBe("https://geocoding-api.open-meteo.com/v1/get");
    expect(url.searchParams.get("id")).toBe("703448");
    expect(url.searchParams.get("language")).toBe("en");
    expect(result).toEqual(
      ok({
        name: "Kyiv",
        region: "Kyiv City",
        country: "Ukraine",
        latitude: 50.45466,
        longitude: 30.5238,
        timezone: "Europe/Kyiv",
      }),
    );
  });

  it.each([
    [
      "an unknown id (the source answers 400)",
      () => Response.json({ error: true, reason: "not found" }, { status: 400 }),
    ],
    ["a malformed body", () => Response.json({ name: "Kyiv" })],
    ["a non-JSON body", () => new Response("nope")],
  ])("reports %s as unavailable", async (_label, response) => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(response()));

    expect(await makeOpenMeteoGeocoding().findById(703448)).toEqual(err("unavailable"));
  });

  it("reports a network error as unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network connection lost."));

    expect(await makeOpenMeteoGeocoding().findById(703448)).toEqual(err("unavailable"));
  });

  it("reports a place whose timezone the runtime does not know as unavailable (review R-14)", async () => {
    stubFetch({ ...getKyiv, timezone: "Mars/Olympus_Mons" });

    expect(await makeOpenMeteoGeocoding().findById(703448)).toEqual(err("unavailable"));
  });

  it("cuts the re-fetch off after exactly 1.5 seconds (AC-04b)", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    stubFetch(getKyiv);

    await makeOpenMeteoGeocoding().findById(703448);

    expect(timeout).toHaveBeenCalledWith(1500);
  });
});
