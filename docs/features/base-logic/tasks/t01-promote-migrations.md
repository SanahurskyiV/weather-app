---
id: T1
title: "Promote the three staged base-logic migrations"
layer: "migration"
deps: []
blocks: ["T9"]
acs: ["AC-02", "AC-14"]
files_hint: ["docs/features/base-logic/migrations/01_create_home_cities.sql", "docs/features/base-logic/migrations/02_create_lookups.sql", "docs/features/base-logic/migrations/03_create_daily_lookup_counts.sql", "test/integration/schema.test.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "M"
status: "todo"
step: ""
---
# T1 — Promote the three staged base-logic migrations

## Place in the sequence

- **Blocked by:** nothing · **Blocks:** T9 — Implement the D1 HomeCityRepo and UsageCounter adapters · **Wave:** 1 (starts immediately).
- **Lane:** `layer: migration` is always serialized (serialized).

## Why (user story)

> **As a** Bot user
> **I want** to set my city by sending its name with one command
> **So that** the bot knows which place to report on
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It gives the Home city a durable place that holds exactly one row per chat, plus the two counter tables the limits need.

## Inlined context

> - Migrations: `migrations/NNNN_snake_name.sql`, forward-only (ADR-0003). Undo with a new migration; never edit an applied one.
>
> — `CLAUDE.md §Conventions, migrations, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> - Wrangler migrations are forward-only, so a rollback is a new forward migration. (`data-model` must follow this, not paired up/down files.)
>
> — `docs/adr/0003 Consequences, negative, verbatim` · full text: [docs/adr/0003](../../../adr/0003-store-state-in-cloudflare-d1.md)

> **Promote-time convention hint:** `wrangler d1 migrations`, `migrations/NNNN_<snake_name>.sql`, sequential and 4-digit. The next value is about `0002`. `implement` assigns the real numbers at promotion, in ordinal order, because another feature may promote first.
>
> — `_audit/data-model-2026-11-06.md §Staged migrations, abridged` · full text: [_audit/data-model-2026-11-06.md](../_audit/data-model-2026-11-06.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

Staged forward-only files (no `.down.sql`, per ADR-0003). Promote them in this order:

| Staged file | Creates | Promotes to (hint) |
|---|---|---|
| `01_create_home_cities.sql` | `home_cities (chat_id INTEGER PK, name TEXT NN, region TEXT NULL, country TEXT NN, latitude REAL NN, longitude REAL NN, timezone TEXT NN, updated_at TEXT NN) STRICT` | `migrations/0002_create_home_cities.sql` |
| `02_create_lookups.sql` | `lookups (id INTEGER PK, chat_id INTEGER NN, looked_up_at TEXT NN) STRICT` + `idx_lookups_chat_id_looked_up_at (chat_id, looked_up_at)` | `migrations/0003_create_lookups.sql` |
| `03_create_daily_lookup_counts.sql` | `daily_lookup_counts (day TEXT PK, lookup_count INTEGER NN) STRICT` | `migrations/0004_create_daily_lookup_counts.sql` |

Rollback is not a file. It is the SQL in `data-model.md` §Rollback, to be written as a new forward migration only if ever needed.

— `data-model.md §Entities + §Migrations (staged), all three tables, abridged` · full text: [data-model.md](../data-model.md)

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

## Checklist

- [ ] Check `migrations/` for the next free `NNNN` (expected `0002`). Another feature may have promoted first.
- [ ] Copy the staged files into `migrations/NNNN_create_home_cities.sql`, `NNNN_create_lookups.sql` and `NNNN_create_daily_lookup_counts.sql`, in ordinal order. Keep the SQL byte-identical and update only the header comment (drop "Staged by…").
- [ ] Run `npm run db:migrate:local`, which must apply cleanly.
- [ ] Add `test/integration/schema.test.ts`. Assert that the three tables and `idx_lookups_chat_id_looked_up_at` exist in `sqlite_master`, and that two `INSERT … ON CONFLICT(chat_id) DO UPDATE` calls for the same `chat_id` leave one row with the second city.

## Edge cases

| Case | Behaviour |
|---|---|
| The next number is already taken | Take the next free one. The ordinal order 01→02→03 is what matters. |
| Migrations are re-applied to a DB that already has the tables | `IF NOT EXISTS` makes them a no-op |
| A non-integer value is written to `chat_id` | Rejected by `STRICT` (`SQLITE_MISMATCH`) |

## Definition of Done

- [ ] `npm test` passes with `schema.test.ts` green (tables, index, one row per chat)
- [ ] The promoted files apply on a fresh local D1 via `npm run db:migrate:local`
- [ ] The staged SQL and the promoted SQL are identical apart from the header comment
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
