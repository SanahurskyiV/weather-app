---
id: T3
title: "Pick the best-matching populated place and format its name"
layer: "domain"
deps: []
blocks: ["T6", "T7"]
acs: ["AC-01", "AC-06"]
files_hint: ["src/domain/place.ts", "src/domain/place.test.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "M"
status: "todo"
step: ""
---
# T3 — Pick the best-matching populated place and format its name

## Place in the sequence

- **Blocked by:** nothing · **Blocks:** T6 — Declare the four new ports and the get-home-city use case · T7 — Implement the set-home-city use case · **Wave:** 1 (starts immediately).
- **Lane:** own lane.

## Why (user story)

> **As a** Bot user
> **I want** to set my city by sending its name with one command
> **So that** the bot knows which place to report on
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

> **As a** Bot user
> **I want** to see exactly which place the bot matched, and narrow it down by adding a country
> **So that** I end up with the right city when several places share a name
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

It decides which candidate becomes the Home city and how its full resolved name is written back to the Bot user.

## Inlined context

> │   ├── place.ts            Place type; pickBestMatch(candidates) → populated places only, highest population, ties → source order
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> | Populated place | A geocoding result whose feature code marks a city, town or village, as opposed to a region or country |
>
> — `sad.md §12, Populated place, verbatim` · full text: [sad.md](../sad.md)

> S->>S: keep populated places, pick the most populous (AC-06, AC-07)
>                 S-->>C: full resolved name and timezone, plus a hint to add a country when the name matched several places
>
> — `sad.md §6, flow D, abridged` · full text: [sad.md](../sad.md)

> | `Place` field | Column |
> |---|---|
> | `name` | `name` |
> | `region?` (`undefined` when none) | `region` (NULL) |
> | `country` | `country` |
> | `latitude` / `longitude` | `latitude` / `longitude` |
> | `timezone` | `timezone` |
>
> — `data-model.md §Domain mapping, verbatim` · full text: [data-model.md](../data-model.md)

> - `src/domain/`: pure logic (alert rules, quiet hours, time). No I/O, no `grammy`, no `cloudflare:*`.
> - `src/app/`: use cases plus the port interfaces they need (`src/app/ports.ts`). Imports only `domain`.
>
> — `CLAUDE.md §Layers, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. `Place` mirrors `home_cities` (see the mapping above), and T9 does the mapping.

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

### AC-01 — happy

> **Given** a Bot user in a private chat who has no Home city yet
> **When** the Bot user sends the set-city command with the name "Kyiv"
> **Then** the system stores the best match as their Home city and replies with its full resolved name (city, region, country) and its timezone, plus how to ask for the weather. The resolved name is always shown in English, whatever alphabet the Bot user typed ("Київ" → "Kyiv, Kyiv City, Ukraine"). When the place has no region, that part is left out.
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — happy (ambiguous name)

> **Given** a Bot user, and the name "Paris" matches several populated places
> **When** the Bot user sets the city "Paris"
> **Then** the system stores the most populous populated place named Paris (never a region or a country), and replies with its full name and timezone plus a hint that adding a country picks another one, for example "Paris, US"
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `src/domain/place.ts`: `Place { name; region?; country; latitude; longitude; timezone }`, plus `PlaceCandidate = Place & { featureCode: string; population?: number }`.
- [ ] `isPopulatedPlace(c)`: GeoNames feature codes of the `PPL*` family (`PPL`, `PPLA`…`PPLA5`, `PPLC`, `PPLG`, `PPLS`, …). Confirm this against the geocoding fixture recorded in T10, and exclude `ADM*` and `PCL*`.
- [ ] `pickBestMatch(candidates): { place: Place; ambiguous: boolean } | undefined`. Filter to populated places and take the highest `population`. A missing population ranks below any number, and ties keep the source order (stable). `ambiguous` = more than one populated candidate. Return `undefined` when none are left.
- [ ] `formatPlaceName(place)`: `"Kyiv, Kyiv City, Ukraine"`, or `"Name, Country"` when `region` is `undefined`.
- [ ] Write `place.test.ts` from the edge table.

## Edge cases

| Case | Behaviour |
|---|---|
| Only `ADM1` / `PCLI` candidates ("Texas", "France") | `undefined`, so a region or country is never chosen (AC-06) |
| Paris FR (2.1M) and Paris US-TX (25k) | Paris, France, `ambiguous: true` (AC-06) |
| No candidate has a population | The first populated candidate in source order (OQ-1) |
| Equal populations | The earlier one in source order |
| One populated candidate | `ambiguous: false`, no country hint |
| `region` undefined | `"Name, Country"`, with no empty segment (AC-01) |

## Definition of Done

- [ ] `place.test.ts` covers every edge row and passes
- [ ] domain-only imports; lint + typecheck clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
