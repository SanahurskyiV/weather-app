---
id: T4
title: "Encode the lookup limits and UTC counting keys"
layer: "domain"
deps: []
blocks: ["T7", "T8"]
acs: ["AC-16", "AC-17"]
files_hint: ["src/domain/usage-limits.ts", "src/domain/usage-limits.test.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "todo"
step: ""
---
# T4 — Encode the lookup limits and UTC counting keys

## Place in the sequence

- **Blocked by:** nothing · **Blocks:** T7 — Implement the set-home-city use case · T8 — Implement the get-current-weather use case · **Wave:** 1 (starts immediately).
- **Lane:** own lane.

## Why (user story)

> **As a** Bot user
> **I want** to ask for the Current weather in my Home city
> **So that** I know what it's like outside without opening another app
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It holds the two caps and the order they are checked in, so both use cases block a request before any lookup the same way.

## Inlined context

> │   ├── usage-limits.ts     DAILY_LOOKUP_BUDGET = 5000, USER_LOOKUPS_PER_HOUR = 30; checkLimits(daily, user) → ok | daily_limit | user_limit
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> | Request pipeline (order of checks) | 1. Parse the input (`blank`, `too_long`, `unknown_country`), or for `/weather` load the Home city (`no_home_city`). No lookup and no counting at this step. 2. Daily budget (`daily_limit` wins when both limits are hit). 3. Per-chat rolling 60 min (`user_limit`). 4. Reserve: increment the day counter and insert the chat log row. 5. One outbound lookup with a 1.5 s timeout. | spec AC-16/AC-17; here |
>
> — `sad.md §8, Request pipeline, verbatim` · full text: [sad.md](../sad.md)

> | Time | `Clock` port only. Counters use UTC (day key `YYYY-MM-DD`, window `now − 60 min`). The reading time is shown in the Home city's IANA timezone via `Intl.DateTimeFormat`. | CLAUDE.md |
>
> — `sad.md §8, Time, verbatim` · full text: [sad.md](../sad.md)

> - `src/domain/`: pure logic (alert rules, quiet hours, time). No I/O, no `grammy`, no `cloudflare:*`.
> - `src/app/`: use cases plus the port interfaces they need (`src/app/ports.ts`). Imports only `domain`.
>
> — `CLAUDE.md §Layers, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The day key and window start are the values T9 binds against `daily_lookup_counts.day` and `lookups.looked_up_at`.

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

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

- [ ] Export `DAILY_LOOKUP_BUDGET = 5000` and `USER_LOOKUPS_PER_HOUR = 30`.
- [ ] `checkLimits(dailyCount, chatCountLastHour): "ok" | "daily_limit" | "user_limit"`. Check the daily budget first: `>= 5000` gives `daily_limit`, then `>= 30` gives `user_limit`.
- [ ] `utcDayKey(now: Date): string` gives `YYYY-MM-DD` in UTC.
- [ ] `windowStart(now: Date): string` gives `new Date(now − 60 min).toISOString()`. A row counts when `looked_up_at > windowStart`.
- [ ] Write `usage-limits.test.ts` from the edge table.

## Edge cases

| Case | Behaviour |
|---|---|
| daily 4,999, chat 0 | `ok` |
| daily 5,000 | `daily_limit` (AC-17) |
| chat 29 | `ok`. This is the 30th lookup, which is allowed. |
| chat 30 | `user_limit` (AC-16) |
| daily 5,000 and chat 30 | `daily_limit`, because the daily reply wins (AC-17) |
| `now` = `2026-11-06T23:59:59.999Z` / `2026-11-07T00:00:00.000Z` | `2026-11-06` / `2026-11-07` |
| A row exactly 60 min old | Outside the window (strict `>`), so the rolling window slides |

## Definition of Done

- [ ] `usage-limits.test.ts` covers every edge row and passes
- [ ] domain-only imports; lint + typecheck clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
