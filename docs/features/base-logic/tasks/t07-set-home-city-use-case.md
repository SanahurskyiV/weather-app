---
id: T7
title: "Implement the set-home-city use case"
layer: "app"
deps: ["T2", "T3", "T4", "T6"]
blocks: ["T12"]
acs: ["AC-02", "AC-04", "AC-04b", "AC-05", "AC-16", "AC-17"]
files_hint: ["src/app/set-home-city.ts", "src/app/set-home-city.test.ts"]
owner: "Vlad S"
estimate: "M"
context_budget: "M"
status: "todo"
step: ""
---
# T7 — Implement the set-home-city use case

## Place in the sequence

- **Blocked by:** T2 — Parse the city query and recognise countries · T3 — Pick the best-matching populated place and format its name · T4 — Encode the lookup limits and UTC counting keys · T6 — Declare the four new ports and the get-home-city use case · **Blocks:** T12 — Add the /city command and its replies · **Wave:** 3 (after its dependencies).
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

It is the whole set-city decision: what is checked, in which order, what is counted, and when the Home city may change.

## Inlined context

> │   ├── set-home-city.ts    parse → load current → limits → reserve → lookup → pick → save; Result<Place, SetCityError> (failures carry the current Home city, AC-05)
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> | Request pipeline (order of checks) | 1. Parse the input (`blank`, `too_long`, `unknown_country`), or for `/weather` load the Home city (`no_home_city`). No lookup and no counting at this step. 2. Daily budget (`daily_limit` wins when both limits are hit). 3. Per-chat rolling 60 min (`user_limit`). 4. Reserve: increment the day counter and insert the chat log row. 5. One outbound lookup with a 1.5 s timeout. | spec AC-16/AC-17; here |
>
> — `sad.md §8, Request pipeline, verbatim` · full text: [sad.md](../sad.md)

> | Error handling | Use cases return `Result`. `SetCityError` failures `not_found` and `unavailable` carry the current Home city (or none) so the reply can say "your city is still …" (AC-05). `SetCityError` is `blank`, `too_long`, `unknown_country`, `not_found`, `unavailable`, `user_limit` or `daily_limit`; `WeatherError` is `no_home_city`, `unavailable`, `user_limit` or `daily_limit`. `replies.ts` maps each to plain-language text. Unexpected throws become the "something went wrong" reply plus `outcome: fault`, and the webhook still answers 200. | CLAUDE.md; here |
>
> — `sad.md §8, Error handling, verbatim` · full text: [sad.md](../sad.md)

> **Chosen:** Option 1, D1 tables. It reuses the datastore and test harness the project already has, with no new binding, class or deployment piece. Reserving a slot on the daily counter before the call keeps AC-17 strict enough: two lookups racing within the same instant can push the count past 5,000 by at most a few, which the spec accepts.
>
> — `adr/0001 Decision outcome, abridged` · full text: [adr/0001](../adr/0001-count-lookups-in-d1-tables.md)

> - Read time only through the `Clock` port. Store times as UTC ISO-8601; per-user IANA timezone for display and quiet hours.
>
> — `CLAUDE.md §Conventions, time, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. Reads and writes go through `HomeCityRepo` / `UsageCounter` (T6 ports).

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

### AC-02 — happy (replace)

> **Given** a Bot user whose Home city is Kyiv
> **When** the Bot user sets the city "Lviv"
> **Then** Lviv replaces Kyiv as their only Home city, the reply names Lviv, and the next weather request reports Lviv
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — error (no such place)

> **Given** a Bot user in a private chat
> **When** the Bot user sets a name that matches no populated place (for example "Xyzzyqq"), or a name longer than 100 characters (counted as visible characters, in any alphabet)
> **Then** nothing is stored and the system replies that it couldn't find that place and suggests checking the spelling or adding a country. A name in any alphabet is looked up as typed. A name longer than 100 characters is refused without any lookup and does not count toward the limits in AC-16 and AC-17.
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-04b — error (place lookup unavailable)

> **Given** a Bot user in a private chat, and the place lookup is down or does not answer within 1.5 seconds
> **When** the Bot user sets a city
> **Then** nothing is stored and the system replies that this is temporarily unavailable and to try again in a few minutes, using the AC-10 wording, not the "couldn't find that place" reply. "Couldn't find that place" is used only when the lookup answered and found no match.
>
> — `spec.md §5, AC-04b, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — domain invariant

> **Given** a Bot user whose Home city is Kyiv
> **When** setting a new city fails, because no place matches or because the place lookup is unavailable
> **Then** Kyiv stays their Home city, and the reply says so ("your city is still Kyiv"). Invariant: *a Home city only ever changes to a place that was successfully found.*
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

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

- [ ] `makeSetHomeCity({ repo, counter, lookup, clock })(chatId, text)` returns `Result<{ place: Place; ambiguous: boolean }, SetCityError>`.
- [ ] `SetCityError` = `{ kind: "blank" | "too_long" | "unknown_country" | "user_limit" | "daily_limit" } | { kind: "not_found" | "unavailable"; current?: Place }`.
- [ ] Order: `parseCityQuery`, then `repo.get`, then `counter.counts` and `checkLimits`, then `counter.reserve(chatId, clock.now())`, then `lookup.find`, then `pickBestMatch`, then `repo.save(chatId, place, clock.now())`.
- [ ] `lookup.find` gives `unavailable`, which returns `{ kind: "unavailable", current }`. The reservation stays counted (AC-17: failed lookups count).
- [ ] When `pickBestMatch` returns `undefined`, return `{ kind: "not_found", current }`.
- [ ] Read `clock.now()` once per request, and use it for both the reservation and `updated_at`.
- [ ] Add `set-home-city.test.ts` with fake ports that record calls.

## Edge cases

| Case | Behaviour |
|---|---|
| Blank / too long / unknown country | Returns the parse error with zero calls to `counter` and `lookup` (AC-03, AC-04, AC-16) |
| daily 5,000 and chat 30 | `daily_limit`, with no `reserve` and no `find` (AC-17) |
| Lookup times out | `unavailable` with `current`. `reserve` was called once and `save` never. |
| Candidates are only regions or countries | `not_found` with `current` (AC-05, AC-06) |
| `"Paris, Japan"`: the lookup with `countryCode: "JP"` returns nothing | `not_found`, never a fallback to another country (AC-07) |
| Chat has no Home city and the lookup fails | The error carries `current: undefined` |

## Definition of Done

- [ ] `set-home-city.test.ts` covers every edge row and passes
- [ ] `app` imports only `domain`; typecheck + lint clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
