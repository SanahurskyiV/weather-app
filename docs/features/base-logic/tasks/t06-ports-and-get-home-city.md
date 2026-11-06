---
id: T6
title: "Declare the four new ports and the get-home-city use case"
layer: "app"
deps: ["T3", "T5"]
blocks: ["T7", "T8", "T9", "T10", "T11"]
acs: ["AC-11"]
files_hint: ["src/app/ports.ts", "src/app/get-home-city.ts", "src/app/get-home-city.test.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---
# T6 — Declare the four new ports and the get-home-city use case

## Place in the sequence

- **Blocked by:** T3 — Pick the best-matching populated place and format its name · T5 — Describe and round the current weather reading · **Blocks:** T7 — Implement the set-home-city use case · T8 — Implement the get-current-weather use case · T9 — Implement the D1 HomeCityRepo and UsageCounter adapters · T10 — Implement the Open-Meteo geocoding and forecast adapters · T11 — Build the Telegram edge: request-log middleware, chat-type split, start, help and group replies · **Wave:** 2 (after its dependencies).
- **Lane:** own lane.

## Why (user story)

> **As a** Bot user opening the bot for the first time, or sending something it doesn't understand
> **I want** a short reply that tells me what to type
> **So that** I can try the bot in seconds without reading docs
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It fixes the port contracts every adapter and use case builds on, and gives the greeting a way to name a returning Bot user's Home city.

## Inlined context

> │   ├── ports.ts            + PlaceLookup, WeatherProvider, HomeCityRepo, UsageCounter (Clock exists)
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> │   └── get-home-city.ts    for the /start greeting (no lookup)
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> | Authorization | Every Home city read or write is keyed by the chat id of the incoming update; no command accepts another chat's id. Use cases are reachable only from the private-chat composer. | spec §6.1; here |
>
> — `sad.md §8, Authorization, verbatim` · full text: [sad.md](../sad.md)

> - Moving to a Durable Object later is local to the `UsageCounter` adapter. The port and use cases don't change.
>
> — `adr/0001 Consequences, neutral, verbatim` · full text: [adr/0001](../adr/0001-count-lookups-in-d1-tables.md)

> - `src/domain/`: pure logic (alert rules, quiet hours, time). No I/O, no `grammy`, no `cloudflare:*`.
> - `src/app/`: use cases plus the port interfaces they need (`src/app/ports.ts`). Imports only `domain`.
>
> — `CLAUDE.md §Layers, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. These ports abstract `home_cities`, `lookups` and `daily_lookup_counts` (T1); the D1 implementations are T9.

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

### AC-11 — happy

> **Given** a Bot user, new or returning
> **When** the Bot user starts the bot
> **Then** the greeting explains in a few lines how to set a city and how to ask for the weather, each with an example; a returning Bot user who has a Home city also sees it named
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Contract note: these are new interfaces with no existing implementers, so this task compiles green on its own (no compile-coupled lane).
- [ ] `src/app/ports.ts`, keeping `Clock`:
  - `HomeCityRepo { get(chatId: number): Promise<Place | undefined>; save(chatId: number, place: Place, at: Date): Promise<void> }`
  - `UsageCounter { counts(chatId: number, now: Date): Promise<{ daily: number; chatLastHour: number }>; reserve(chatId: number, now: Date): Promise<void> }`. `reserve` = day-counter increment + chat log row + prune (data-model §Reserve as one batch).
  - `PlaceLookup { find(q: { name: string; countryCode?: string }): Promise<Result<PlaceCandidate[], "unavailable">> }`
  - `WeatherProvider { current(latitude: number, longitude: number): Promise<Result<CurrentWeather, "unavailable">> }`
  - Replace the placeholder comment ("Feature work adds WeatherProvider, SubscriptionRepo…") with what is now there.
- [ ] `src/app/get-home-city.ts`: `makeGetHomeCity(repo)(chatId): Promise<Place | undefined>`. It makes no lookup and no counting.
- [ ] Add `get-home-city.test.ts` with an in-memory fake `HomeCityRepo`.

## Edge cases

| Case | Behaviour |
|---|---|
| A chat with no Home city | `undefined`, and the greeting omits the city (AC-11) |
| Chat A asks | Only A's row is read, because the port takes the update's chat id and nothing else (AC-14) |

## Definition of Done

- [ ] `get-home-city.test.ts` passes
- [ ] `app` imports only `domain` (ESLint layer rule)
- [ ] typecheck + lint clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
