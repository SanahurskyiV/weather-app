import { afterEach, describe, expect, it, vi } from "vitest";
import empty from "../../../test/fixtures/open-meteo-geocoding-empty.json";
import paris from "../../../test/fixtures/open-meteo-geocoding-paris.json";
import { err } from "../../domain/result";
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

    await makeOpenMeteoGeocoding().find({ name: "Paris" });

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

    await makeOpenMeteoGeocoding().find({ name: "Paris", countryCode: "US" });

    expect(requestedUrl(spy).searchParams.get("countryCode")).toBe("US");
  });

  it("sends a non-ASCII name as typed, URL-encoded", async () => {
    const spy = stubFetch(empty);

    await makeOpenMeteoGeocoding().find({ name: "Київ" });

    expect(requestedUrl(spy).searchParams.get("name")).toBe("Київ");
    expect(requestedUrl(spy).search).toContain("name=%D0%9A%D0%B8%D1%97%D0%B2");
  });

  it("maps the recorded Paris answer to place candidates (AC-06)", async () => {
    stubFetch(paris);

    const result = await makeOpenMeteoGeocoding().find({ name: "Paris" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(10);
    expect(result.value[0]).toEqual({
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
          name: "Nowhere",
          country: "Monaco",
          latitude: 1,
          longitude: 2,
          timezone: "Europe/Monaco",
          feature_code: "PPL",
        },
      ],
    });

    const result = await makeOpenMeteoGeocoding().find({ name: "Nowhere" });

    expect(result.ok && result.value[0]).toEqual({
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

    expect(await makeOpenMeteoGeocoding().find({ name: "Xyzzyqq" })).toEqual({ ok: true, value: [] });
  });

  it("reports a server error as unavailable (AC-04b)", async () => {
    stubFetch({ error: true, reason: "boom" }, { status: 500 });

    expect(await makeOpenMeteoGeocoding().find({ name: "Paris" })).toEqual(err("unavailable"));
  });

  it("reports a network error as unavailable (AC-04b)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network connection lost."));

    expect(await makeOpenMeteoGeocoding().find({ name: "Paris" })).toEqual(err("unavailable"));
  });

  it("reports an unreadable answer as unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>oops</html>", { status: 200 }));

    expect(await makeOpenMeteoGeocoding().find({ name: "Paris" })).toEqual(err("unavailable"));
  });

  it("reports a malformed result entry as unavailable", async () => {
    stubFetch({ results: [{ name: "Paris" }] });

    expect(await makeOpenMeteoGeocoding().find({ name: "Paris" })).toEqual(err("unavailable"));
  });

  it("gives up after 1.5 seconds and reports unavailable (AC-04b)", async () => {
    const spy = hangingFetch();

    expect(await makeOpenMeteoGeocoding().find({ name: "Paris" })).toEqual(err("unavailable"));
    expect(spy).toHaveBeenCalledOnce();
  }, 5000);
});
