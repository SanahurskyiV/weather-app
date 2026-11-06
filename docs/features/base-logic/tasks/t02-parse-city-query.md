---
id: T2
title: "Parse the city query and recognise countries"
layer: "domain"
deps: []
blocks: ["T7"]
acs: ["AC-03", "AC-04", "AC-07"]
files_hint: ["src/domain/city-query.ts", "src/domain/city-query.test.ts", "src/domain/countries.ts", "src/domain/countries.test.ts"]
owner: "Vlad S"
estimate: "M"
context_budget: "M"
status: "todo"
step: ""
---
# T2 — Parse the city query and recognise countries

## Place in the sequence

- **Blocked by:** nothing · **Blocks:** T7 — Implement the set-home-city use case · **Wave:** 1 (starts immediately).
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

It turns the raw text after the set-city command into a name plus an optional country, and rejects blank, too-long and non-country input before any lookup happens.

## Inlined context

> │   ├── city-query.ts       parseCityQuery(text) → Result<{ name, countryCode? }, blank | too_long | unknown_country>
> │   ├── countries.ts        ISO 3166-1 alpha-2 ↔ English short name + aliases (USA, UK)
>
> — `sad.md §5, internal decomposition, abridged` · full text: [sad.md](../sad.md)

> **Resolved in design (SAD §5 `domain/countries.ts`, 2026-11-05):** country = 2-letter code (any case), English short name, or aliases USA/UK; ties without population → source order.
>
> — `spec.md §8, OQ-1, verbatim` · full text: [spec.md](../spec.md)

> | Request pipeline (order of checks) | 1. Parse the input (`blank`, `too_long`, `unknown_country`), or for `/weather` load the Home city (`no_home_city`). No lookup and no counting at this step. 2. Daily budget (`daily_limit` wins when both limits are hit). 3. Per-chat rolling 60 min (`user_limit`). 4. Reserve: increment the day counter and insert the chat log row. 5. One outbound lookup with a 1.5 s timeout. | spec AC-16/AC-17; here |
>
> — `sad.md §8, Request pipeline, verbatim` · full text: [sad.md](../sad.md)

> - `src/domain/`: pure logic (alert rules, quiet hours, time). No I/O, no `grammy`, no `cloudflare:*`.
> - `src/app/`: use cases plus the port interfaces they need (`src/app/ports.ts`). Imports only `domain`.
>
> — `CLAUDE.md §Layers, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> - Expected failures return `Result<T, E>` from `src/domain/result.ts`; never throw them.
>
> — `CLAUDE.md §Conventions, Result, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

### AC-03 — error (missing name)

> **Given** a Bot user in a private chat
> **When** the Bot user sends the set-city command with no name, or only spaces
> **Then** nothing changes and the system replies with how to use the command, with an example
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — error (no such place)

> **Given** a Bot user in a private chat
> **When** the Bot user sets a name that matches no populated place (for example "Xyzzyqq"), or a name longer than 100 characters (counted as visible characters, in any alphabet)
> **Then** nothing is stored and the system replies that it couldn't find that place and suggests checking the spelling or adding a country. A name in any alphabet is looked up as typed. A name longer than 100 characters is refused without any lookup and does not count toward the limits in AC-16 and AC-17.
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — happy (refine with a country)

> **Given** a Bot user whose Home city is Paris, France
> **When** the Bot user sets the city "Paris, US"
> **Then** the system stores the most populous Paris in the United States and replies with its full name and timezone. Only text after a comma is read as a country. If the country is not recognised ("Paris, XX"), or has no place of that name ("Paris, Japan"), or the text after the comma is not a country ("Paris, Texas"), the system gives the "couldn't find that place" reply (AC-04) and the Home city does not change. It never quietly falls back to a match in another country.
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `src/domain/countries.ts`: a static ISO 3166-1 alpha-2 table (code → English short name) and `resolveCountry(text): string | undefined`. It is case-insensitive and trimmed, accepts the code or the English short name, and maps the aliases `USA` → `US` and `UK` → `GB`.
- [ ] `src/domain/city-query.ts`: `parseCityQuery(text): Result<{ name: string; countryCode?: string }, "blank" | "too_long" | "unknown_country">`, built with `ok`/`err` from `result.ts`.
- [ ] Trim the input. Empty or whitespace only gives `blank`.
- [ ] Length is counted in visible characters (grapheme clusters, `Intl.Segmenter`) on the trimmed text. More than 100 gives `too_long`, checked before the country split.
- [ ] Split on the last comma. The text after it must resolve through `resolveCountry`, else `unknown_country`. The name is the trimmed text before it, and an empty name gives `blank`.
- [ ] Keep the name exactly as typed (any alphabet), with no transliteration.
- [ ] Write the unit tests `countries.test.ts` and `city-query.test.ts` from the edge-case table.

## Edge cases

| Case | Behaviour |
|---|---|
| `""` or `"   "` | `blank` (AC-03) |
| `"Київ"` | `ok({ name: "Київ" })`, looked up as typed (AC-04) |
| 101 visible characters (e.g. 101 × "é" written with combining marks) | `too_long`, counted per grapheme, not per UTF-16 unit (AC-04) |
| Exactly 100 visible characters | `ok` |
| `"Paris, US"` / `"paris, us"` / `"Paris, USA"` / `"Paris, United States"` | `ok({ name: "Paris", countryCode: "US" })` (AC-07) |
| `"Paris, XX"` / `"Paris, Texas"` | `unknown_country` (AC-07) |
| `", US"` | `blank` |
| `"Paris,"` (empty text after the comma) | Not specified in spec §5. Raise it with the owner. The proposal is to treat it as `ok({ name: "Paris" })`, so don't invent a different rule silently. |
| `"Paris, Japan"` | `ok` here. "No place of that name in Japan" is decided by the lookup (T7/T10), not by the parser. |

## Definition of Done

- [ ] `city-query.test.ts` and `countries.test.ts` cover every edge row and pass
- [ ] No import outside `src/domain/` (ESLint layer rule)
- [ ] lint + typecheck clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
