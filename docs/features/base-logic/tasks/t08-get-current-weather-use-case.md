---
id: T8
title: "Implement the get-current-weather use case"
layer: "app"
deps: ["T4", "T5", "T6"]
blocks: ["T13"]
acs: ["AC-09", "AC-10", "AC-16", "AC-17"]
files_hint: ["src/app/get-current-weather.ts", "src/app/get-current-weather.test.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "M"
status: "todo"
step: ""
---
# T8 — Implement the get-current-weather use case

## Place in the sequence

- **Blocked by:** T4 — Encode the lookup limits and UTC counting keys · T5 — Describe and round the current weather reading · T6 — Declare the four new ports and the get-home-city use case · **Blocks:** T13 — Add the /weather command and its replies · **Wave:** 3 (after its dependencies).
- **Lane:** own lane.

## Why (user story)

> **As a** Bot user
> **I want** to ask for the Current weather in my Home city
> **So that** I know what it's like outside without opening another app
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It decides whether a weather request may make its one lookup, and returns the reading for the Home city.

## Inlined context

> │   ├── get-current-weather.ts  home city? → limits → reserve → fetch; Result<{ place, weather }, WeatherError>
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> alt no Home city
>         S-->>C: no city set yet, how to set one with an example, no lookup made (AC-09)
>     else Home city set
>         S->>D: read today's lookup count and this chat's last-60-min count
>
> — `sad.md §6, flow E, abridged` · full text: [sad.md](../sad.md)

> | Request pipeline (order of checks) | 1. Parse the input (`blank`, `too_long`, `unknown_country`), or for `/weather` load the Home city (`no_home_city`). No lookup and no counting at this step. 2. Daily budget (`daily_limit` wins when both limits are hit). 3. Per-chat rolling 60 min (`user_limit`). 4. Reserve: increment the day counter and insert the chat log row. 5. One outbound lookup with a 1.5 s timeout. | spec AC-16/AC-17; here |
>
> — `sad.md §8, Request pipeline, verbatim` · full text: [sad.md](../sad.md)

> | Error handling | Use cases return `Result`. `SetCityError` failures `not_found` and `unavailable` carry the current Home city (or none) so the reply can say "your city is still …" (AC-05). `SetCityError` is `blank`, `too_long`, `unknown_country`, `not_found`, `unavailable`, `user_limit` or `daily_limit`; `WeatherError` is `no_home_city`, `unavailable`, `user_limit` or `daily_limit`. `replies.ts` maps each to plain-language text. Unexpected throws become the "something went wrong" reply plus `outcome: fault`, and the webhook still answers 200. | CLAUDE.md; here |
>
> — `sad.md §8, Error handling, verbatim` · full text: [sad.md](../sad.md)

> - Read time only through the `Clock` port. Store times as UTC ISO-8601; per-user IANA timezone for display and quiet hours.
>
> — `CLAUDE.md §Conventions, time, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

### AC-09 — cross-context

> **Given** a Bot user who has no Home city
> **When** the Bot user asks for the weather
> **Then** the system replies that no city is set yet and how to set one, with an example, and makes no weather lookup
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — error (source unavailable)

> **Given** a Bot user whose Home city is Kyiv, and the weather source is down or does not answer within 1.5 seconds
> **When** the Bot user asks for the weather
> **Then** the system replies that the weather is temporarily unavailable and to try again in a few minutes. The wording is different from the "couldn't find that place" reply.
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-16 — error (too many requests)

> **Given** a Bot user for whom the bot has already made 30 place or weather lookups within the past 60 minutes (a rolling window)
> **When** the Bot user sets a city or asks for the weather again
> **Then** no lookup is made, their Home city is unchanged, and the system replies that they are sending too many requests and to try again later. Only lookups actually made count, whether or not a place was found. Requests blocked by this cap or by AC-17, blank names (AC-03), names that are too long (AC-04) and weather requests with no Home city (AC-09) do not count, so retrying while blocked never extends the block.
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — error (bot-wide daily budget used up)

> **Given** the bot has already made 5,000 place or weather lookups for Bot user requests during the current day (counted in UTC)
> **When** any Bot user sets a city or asks for the weather
> **Then** no lookup is made, their Home city is unchanged, and the system replies that the bot has reached its daily limit and to try again tomorrow. This keeps the rest of the weather source's free daily allowance for alerts. Every place and weather lookup the bot makes counts, including ones that fail or time out, because both kinds draw on the same daily allowance. Requests that arrive at the same moment may push the count past 5,000 by a few lookups. When a Bot user hits both this budget and their own limit (AC-16), they get this "daily limit" reply.
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `makeGetCurrentWeather({ repo, counter, weather, clock })(chatId)` returns `Result<{ place: Place; weather: CurrentWeather }, WeatherError>`, where `WeatherError = { kind: "no_home_city" | "unavailable" | "user_limit" | "daily_limit" }`.
- [ ] Order: `repo.get`. When there is none, return `no_home_city` before any counter call. Then `counts` and `checkLimits`, then `reserve`, then `weather.current(place.latitude, place.longitude)`.
- [ ] Add `get-current-weather.test.ts` with recording fakes.

## Edge cases

| Case | Behaviour |
|---|---|
| No Home city | `no_home_city`, with zero `counts` / `reserve` / `current` calls (AC-09, AC-16) |
| Provider is down or exceeds 1.5 s | `unavailable`, with `reserve` called once (AC-10, AC-17) |
| Both limits hit | `daily_limit` |

## Definition of Done

- [ ] `get-current-weather.test.ts` passes
- [ ] `app` imports only `domain`; typecheck + lint clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
