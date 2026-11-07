---
id: T9
title: "Implement the D1 HomeCityRepo and UsageCounter adapters"
layer: "infra"
deps: ["T1", "T6"]
blocks: ["T11"]
acs: ["AC-02", "AC-14", "AC-16", "AC-17"]
files_hint: ["src/adapters/d1/home-city-repo.ts", "src/adapters/d1/usage-counter.ts", "test/integration/d1-adapters.test.ts", "test/integration/db-fixtures.ts"]
owner: "Vlad S"
estimate: "M"
context_budget: "M"
status: "done"
step: "COMMIT"
---
# T9 — Implement the D1 HomeCityRepo and UsageCounter adapters

## Place in the sequence

- **Blocked by:** T1 — Promote the three staged base-logic migrations · T6 — Declare the four new ports and the get-home-city use case · **Blocks:** T11 — Build the Telegram edge: request-log middleware, chat-type split, start, help and group replies · **Wave:** 3 (after its dependencies).
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

It makes the Home city and both lookup counts durable and shared across every Worker isolate.

## Inlined context

> - D1 access only in `src/adapters/d1/`, with prepared statements and bound parameters. No logic in SQL.
>
> — `CLAUDE.md §Conventions, D1, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Chosen:** Option 1, D1 tables. It reuses the datastore and test harness the project already has, with no new binding, class or deployment piece. Reserving a slot on the daily counter before the call keeps AC-17 strict enough: two lookups racing within the same instant can push the count past 5,000 by at most a few, which the spec accepts.
>
> — `adr/0001 Decision outcome, abridged` · full text: [adr/0001](../adr/0001-count-lookups-in-d1-tables.md)

> - Load by chat (`/start`, `/city`, `/weather`) → PK `chat_id`.
> - Replace by chat (`INSERT … ON CONFLICT(chat_id) DO UPDATE SET …`) → PK `chat_id`.
> - Count this chat's lookups in the window: `COUNT(*) … WHERE chat_id = ? AND looked_up_at > ?`, with `? = now − 60 min` → `idx_lookups_chat_id_looked_up_at`.
> - Prune this chat's old rows on reserve: `DELETE … WHERE chat_id = ? AND looked_up_at <= ?` → `idx_lookups_chat_id_looked_up_at`.
> - Read today's count: `SELECT lookup_count … WHERE day = ?` → PK `day`. A missing row means 0.
> - Reserve: `INSERT (day, lookup_count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET lookup_count = lookup_count + 1` → PK `day`.
>
> — `data-model.md §Entities, access patterns, abridged` · full text: [data-model.md](../data-model.md)

> **Reserve as one batch.** The adapter runs the two reserve writes plus the prune (`daily_lookup_counts` upsert, `lookups` insert, `lookups` prune) in one `DB.batch([...])`. That is one round-trip, applied atomically. The limit read before it is a separate step, which is the race ADR-0001 accepts.
>
> — `data-model.md §Entities, reserve, verbatim` · full text: [data-model.md](../data-model.md)

> - **D1 write cost is likely above ADR-0001's estimate.** … about 5 rows per lookup, or roughly 25k writes a day at the full budget (about 25% of D1 Free's 100k). … If it becomes tight, prune less often (for example only when the window count is ≥ 30) instead of on every reserve. No change was made here.
>
> — `_audit/data-model-2026-11-06.md §Findings, write cost, abridged` · full text: [_audit/data-model-2026-11-06.md](../_audit/data-model-2026-11-06.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

| Table | Columns this task reads/writes | Change |
|---|---|---|
| `home_cities` | all: `chat_id` PK, `name`, `region` (NULL), `country`, `latitude`, `longitude`, `timezone`, `updated_at` | read + upsert |
| `lookups` | `chat_id`, `looked_up_at` (`id` is the rowid) via `idx_lookups_chat_id_looked_up_at` | count, insert, prune |
| `daily_lookup_counts` | `day` PK, `lookup_count` | read + upsert-increment |

Test fixtures to add (`test/integration/db-fixtures.ts`): `seedHomeCity(db, overrides?)` (default `chat_id 100001`, Kyiv / Kyiv City / Ukraine, `50.45, 30.52`, `Europe/Kyiv`), `seedLookups(db, chatId, times[])` and `seedDailyCount(db, day, count)`. Chat ids are synthetic `1000NN`, with no PII.

— `data-model.md §Entities + §Test fixtures, abridged` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

### AC-02 — happy (replace)

> **Given** a Bot user whose Home city is Kyiv
> **When** the Bot user sets the city "Lviv"
> **Then** Lviv replaces Kyiv as their only Home city, the reply names Lviv, and the next weather request reports Lviv
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — authorization (one person's city is theirs alone)

> **Given** Bot user A's Home city is Kyiv and Bot user B's is Lviv
> **When** Bot user B sets the city "Paris"
> **Then** A's Home city is still Kyiv, and nothing in any reply to B reveals A's city
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

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

- [ ] `src/adapters/d1/home-city-repo.ts`: `makeD1HomeCityRepo(db): HomeCityRepo`, using prepared statements with `.bind()`. It maps `region` NULL ↔ `undefined` and writes `updated_at = at.toISOString()`.
- [ ] `src/adapters/d1/usage-counter.ts`: `makeD1UsageCounter(db): UsageCounter`.
  - `counts` makes the two reads (or one `batch`), with `utcDayKey` / `windowStart` from T4.
  - `reserve` is one `db.batch([upsert day, insert lookup, prune chat <= windowStart])`.
- [ ] Add `test/integration/db-fixtures.ts` with the three seed helpers.
- [ ] Add `test/integration/d1-adapters.test.ts`, exercising both adapters against the migrated local D1.

## Edge cases

| Case | Behaviour |
|---|---|
| save Kyiv then Lviv for chat 100001 | One row, now Lviv (AC-02) |
| Chat 100002 saves Paris | Chat 100001's row is unchanged (AC-14) |
| Place without a region | Stored as NULL, read back as `region: undefined` |
| No `daily_lookup_counts` row today | `daily = 0` |
| Lookups at now−60:00 and now−59:59 | Only the second counts. The first is pruned on the next reserve. |
| 30 seeded rows in the window | `chatLastHour = 30`, so the caller gets `user_limit` (AC-16) |

## Definition of Done

- [ ] `d1-adapters.test.ts` covers every edge row and passes on the local D1
- [ ] Every statement uses bound parameters, with no string-built SQL
- [ ] lint + typecheck clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
