---
status: Accepted
owner: "Vlad S"
reviewers: []
updated_at: "2026-11-05"
feature_size: "n/a (repo foundation)"
ticket: "n/a"
---

# 0003 — Store bot state in Cloudflare D1 with forward-only Wrangler migrations

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Vlad S, with Claude during the `survey` foundation session

## Context

The bot keeps a little state that must survive across invocations:
- each chat's city and timezone
- quiet-hours settings
- a log of sent alerts, used for de-duplication

Workers have no persistent local disk (ADR-0001), so state needs a managed store that's reachable from a Worker and free.

## Decision drivers

- Free plan only (idea brief §5).
- Reachable from Cloudflare Workers with low upkeep (ADR-0001).
- Relational queries suit the access pattern: "all subscribers due for a check, grouped by location".
- Integration-testable locally against a real engine.

## Considered options

1. **Cloudflare D1 (SQLite).** A native Worker binding, free tier (reportedly 5M rows read and 100k rows written per day, 5 GB), SQL, and migrations via `wrangler d1 migrations`. It runs locally in `vitest-pool-workers`.
2. **Workers KV.** A key-value store with eventual consistency, a poor fit for "query all subscribers by location", and the free write quota is small.
3. **External free Postgres (e.g. a hosted free tier).** Full SQL, but it's another vendor and account, adds network latency per query, and free tiers may pause when idle.

## Decision outcome

**Chosen:** Option 1, D1. It's built into the hosting platform, is free at this scale, supports the relational query pattern, and the same engine runs locally in integration tests.

## Consequences

**Positive**
- No extra vendor or credentials, since it's accessed through the `DB` binding.
- Real SQL with versioned migrations checked into `migrations/`.
- Integration tests run against a real local D1.

**Negative**
- Wrangler migrations are forward-only, so a rollback is a new forward migration. (`data-model` must follow this, not paired up/down files.)
- Free-plan queries fail once a daily row read or write limit is hit, so cron reads must be batched and indexed.
- It's SQLite, so there are no server-side features like `LISTEN/NOTIFY` and concurrency is limited. Neither is needed here.

**Neutral**
- Moving to another SQLite-compatible store (e.g. a local file on a VM) is mostly an adapter swap, because SQL stays in `src/adapters/d1/` (ADR-0002).

## Links

- Idea brief: [[../idea-brief.md]] §5
- Architecture map: [[../architecture-map.md]] §Datastores, §Conventions (Migrations)
- Related ADR: [[0001-run-on-cloudflare-workers-with-webhook-and-cron]], [[0002-organize-code-as-ports-and-adapters]]
- Source (as summarized by web search, 2026-11-05): https://developers.cloudflare.com/d1/platform/pricing/
