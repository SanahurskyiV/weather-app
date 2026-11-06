# Audit — data-model base-logic (2026-11-06)

**Mode:** greenfield (no feature tables existed; `migrations/0001_init.sql` is an empty `SELECT 1`). Route `quick`, size S.

## Staged migrations

> Migrations are **staged**. They are not yet in the live `migrations/` tree; `implement` promotes them.

| Staged path | Promotes to (hint) |
|---|---|
| `docs/features/base-logic/migrations/01_create_home_cities.sql` | `migrations/0002_create_home_cities.sql` |
| `docs/features/base-logic/migrations/02_create_lookups.sql` | `migrations/0003_create_lookups.sql` |
| `docs/features/base-logic/migrations/03_create_daily_lookup_counts.sql` | `migrations/0004_create_daily_lookup_counts.sql` |

**Promote-time convention hint:** `wrangler d1 migrations`, `migrations/NNNN_<snake_name>.sql`, sequential and 4-digit. The next value is about `0002`. `implement` assigns the real numbers at promotion, in ordinal order, because another feature may promote first. Files may hold several statements. Wrangler applies each file as one unit.

## Convention source and decisions

- **From the architecture:**
  - D1/SQLite with forward-only Wrangler migrations (ADR-0003, architecture-map §Migrations).
  - `chat_id` as the natural key (architecture-map §IDs).
  - UTC ISO-8601 times (CLAUDE.md).
  - Plain storage, with no triggers or logic in SQL (architecture-map §Persistence).
  - Per-chat lookup log plus per-day counter (feature ADR-0001).
- **Confirmed with the owner (greenfield, 2026-11-06):** plural `snake_case` table names; `updated_at` only on `home_cities`; `STRICT` tables with no `CHECK` constraints.

## Deviations from the skill defaults (deliberate)

- **No `.down.sql` files.** The skill defaults to paired up/down migrations. Project ADR-0003 is Accepted and says Wrangler migrations are forward-only, and that "`data-model` must follow this, not paired up/down files". The staged files are forward-only `.sql` (no `.up` suffix, so they match the live naming). The inverse SQL is recorded in `data-model.md` §Rollback as the body of a future forward migration. The self-check below checks reversibility against that section.
- **No UUID v7 bootstrap seed.** There is no bootstrap data and no lookup-table seed. The country list is domain code (OQ-1, SAD §5).

## Verification (run on local D1 via `wrangler d1 execute --local`, throwaway persist dir)

- All three files applied twice in a row with no errors (8 statements), so the DDL is idempotent.
- `STRICT` is enforced: a text value in `chat_id` / `latitude` was rejected with `SQLITE_MISMATCH`.
- The Home city upsert replaced Kyiv with Lviv, with `region` NULL.
- The window count returned 2 of 3 rows, the per-chat prune removed the out-of-window row, and two day-counter upserts gave `2`.
- `EXPLAIN QUERY PLAN` for the window count: `SEARCH lookups USING COVERING INDEX idx_lookups_chat_id_looked_up_at (chat_id=? AND looked_up_at>?)`.
- The §Rollback SQL left no feature tables behind.
- Python's bundled SQLite (3.35) predates `STRICT` (3.37), so it was not used. D1 is the target.

## Self-check (4 mandatory)

| Check | Result |
|---|---|
| Naming matches the repo convention | Pass. Plural `snake_case` tables, `snake_case` columns, `idx_<table>_<cols>` index, staged `NN_<verb>_<entity>.sql` |
| Down reversibility | Pass, adapted to forward-only. Every `CREATE TABLE` (3) and `CREATE INDEX` (1) has a `DROP … IF EXISTS` in §Rollback, and the rollback was executed successfully. |
| FK indexes | Pass, trivially: there are no foreign keys. `lookups.chat_id` → `home_cities` is deliberately not an FK, because a chat is counted before it has a Home city (AC-16). |
| Convention adherence | Pass. No `CHECK` constraints, triggers or DB defaults. Times are TEXT UTC ISO-8601 from `Clock`. The natural `chat_id` key is used. |

## Drift

No domain struct exists yet (`src/domain/` has only `result.ts`; `src/app/ports.ts` has only `Clock`), so no drift is possible and no `_drift/` was written. The planned `Place` → `home_cities` field map is in `data-model.md` §Domain mapping, for `implement` to follow.

## Findings for later stages

- **D1 write cost is likely above ADR-0001's estimate.** ADR-0001 estimates "about 2 rows per lookup" (~10k writes a day at 5,000 lookups). Counted per lookup:
  - `daily_lookup_counts` upsert: 1
  - `lookups` insert: 1, plus 1 for the index entry
  - steady-state prune of about 1 old row: 1, plus 1 for the index entry
  - `home_cities` upsert on set-city: 1

  That is about 5 rows per lookup, or roughly 25k writes a day at the full budget (about 25% of D1 Free's 100k). This assumes D1 counts index updates as extra rows written, as Cloudflare's pricing docs describe. Please verify it. It is still within the free tier. If it becomes tight, prune less often (for example only when the window count is ≥ 30) instead of on every reserve. No change was made here.
- **Stale `lookups` rows of inactive chats.** The prune is per chat (as SAD flow D/E specifies), so a chat that stops sending keeps up to 30 old rows. That is bounded and negligible at the expected handful of users. A global time-based prune would need an index on `looked_up_at` alone, which no current query justifies.
- **Old `daily_lookup_counts` rows** accumulate at one per day. Negligible, with no cleanup planned.
- **Step 3 (alerts)** will add its own tables and indexes, such as subscribers grouped by location, and the OQ-2 "forget me" removal. Neither is modelled here.

## TBDs

None.

## Next stage

`/sdd:api base-logic`. On route `quick`, the api skip condition (no contract change) applies. This feature adds bot commands but no HTTP endpoint, event or public library signature. The webhook already exists. So the next stage is `/sdd:tasks base-logic`.
