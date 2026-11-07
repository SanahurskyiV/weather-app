---
id: T10
title: "Implement the Open-Meteo geocoding and forecast adapters"
layer: "infra"
deps: ["T6"]
blocks: ["T12", "T13"]
acs: ["AC-04b", "AC-06", "AC-10"]
files_hint: ["src/adapters/open-meteo/geocoding.ts", "src/adapters/open-meteo/geocoding.test.ts", "src/adapters/open-meteo/forecast.ts", "src/adapters/open-meteo/forecast.test.ts", "test/fixtures/open-meteo-geocoding-paris.json", "test/fixtures/open-meteo-geocoding-empty.json", "test/fixtures/open-meteo-forecast-kyiv.json"]
owner: "Vlad S"
estimate: "M"
context_budget: "M"
status: "done"
step: "COMMIT"
---
# T10 — Implement the Open-Meteo geocoding and forecast adapters

## Place in the sequence

- **Blocked by:** T6 — Declare the four new ports and the get-home-city use case · **Blocks:** T12 — Add the /city command and its replies · T13 — Add the /weather command and its replies · **Wave:** 3 (after its dependencies).
- **Lane:** own lane.

## Why (user story)

> **As a** Bot user
> **I want** to set my city by sending its name with one command
> **So that** the bot knows which place to report on
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

> **As a** Bot user
> **I want** to ask for the Current weather in my Home city
> **So that** I know what it's like outside without opening another app
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It is the only place that talks to the weather source, so each lookup is bounded at 1.5 s and arrives as domain types.

## Inlined context

> │   ├── open-meteo/geocoding.ts   PlaceLookup — top 10 candidates, language=en, optional country filter, 1.5 s timeout
> │   ├── open-meteo/forecast.ts    WeatherProvider — current fields at stored coordinates, metric, 1.5 s timeout
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> | Outbound HTTP | `fetch` with `AbortSignal.timeout(1500)`. A timeout, network error or non-OK answer means `unavailable`. Open-Meteo adapters map JSON into domain types and never leak response shapes. | here |
>
> — `sad.md §8, Outbound HTTP, verbatim` · full text: [sad.md](../sad.md)

> - Tests: unit tests next to the code (`*.test.ts`); integration tests in `test/integration/`.
>   Stub outbound HTTP (`vi.spyOn(globalThis, "fetch")`) with JSON fixtures from `test/fixtures/`.
>
> — `CLAUDE.md §Conventions, tests, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> | Open-Meteo Geocoding API | System (external) | Turns a city query (plus an optional country filter) into candidate places with population, feature code, coordinates, timezone and English names |
>
> — `sad.md §3, external systems, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal: no API surface of our own. The external calls (endpoint shapes are not in any repo contract, so confirm them against the live API when you record the fixtures):

- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name=<name>&count=10&language=en&format=json[&countryCode=<CC>]`. It reads `results[].{name, admin1, country, latitude, longitude, timezone, feature_code, population}`. When there are no matches, `results` is absent.
- Forecast: `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=GMT`. It reads `current.{time, …}`. Default units are °C and km/h. `time` has no zone suffix, so with `timezone=GMT` parse it as UTC.

## Acceptance criteria

### AC-04b — error (place lookup unavailable)

> **Given** a Bot user in a private chat, and the place lookup is down or does not answer within 1.5 seconds
> **When** the Bot user sets a city
> **Then** nothing is stored and the system replies that this is temporarily unavailable and to try again in a few minutes, using the AC-10 wording, not the "couldn't find that place" reply. "Couldn't find that place" is used only when the lookup answered and found no match.
>
> — `spec.md §5, AC-04b, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — happy (ambiguous name)

> **Given** a Bot user, and the name "Paris" matches several populated places
> **When** the Bot user sets the city "Paris"
> **Then** the system stores the most populous populated place named Paris (never a region or a country), and replies with its full name and timezone plus a hint that adding a country picks another one, for example "Paris, US"
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — error (source unavailable)

> **Given** a Bot user whose Home city is Kyiv, and the weather source is down or does not answer within 1.5 seconds
> **When** the Bot user asks for the weather
> **Then** the system replies that the weather is temporarily unavailable and to try again in a few minutes. The wording is different from the "couldn't find that place" reply.
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `geocoding.ts`: `makeOpenMeteoGeocoding(fetchFn = fetch): PlaceLookup` with `AbortSignal.timeout(1500)`. Map to `PlaceCandidate` (`admin1` gives `region`, `feature_code` gives `featureCode`). A missing `results` gives `ok([])`.
- [ ] `forecast.ts`: `makeOpenMeteoForecast(fetchFn = fetch): WeatherProvider`, with the same timeout. Map to `CurrentWeather`, where `readingTime` = `new Date(current.time + "Z")`.
- [ ] Record three fixtures under `test/fixtures/`: Paris (several candidates, including a region), an empty result and Kyiv current conditions.
- [ ] Write the unit tests with `vi.spyOn(globalThis, "fetch")`. Assert the query parameters (`language=en`, `count=10`, `countryCode` only when given), the mapping, and each failure, which must give `unavailable`.

## Edge cases

| Case | Behaviour |
|---|---|
| `results` absent | `ok([])`, which the use case reports as not found (AC-04) |
| HTTP 500 / network error / abort after 1.5 s / non-JSON body | `err("unavailable")`, never thrown (AC-04b, AC-10) |
| Candidate without `admin1` or `population` | `region` / `population` is `undefined` |
| Non-ASCII query "Київ" | URL-encoded and sent as typed |

## Definition of Done

- [ ] `geocoding.test.ts` and `forecast.test.ts` pass with the recorded fixtures
- [ ] No response shape leaks past the adapter (only domain types are exported)
- [ ] lint + typecheck clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
