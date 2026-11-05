---
status: Accepted
owner: "Vlad S"
reviewers: ["Tech Lead"]
updated_at: "2026-11-05"
feature_size: "S"
ticket: "roadmap step 2 (base-logic)"
---

# 0001 — Count lookups in D1 tables (per-chat lookup log + per-day counter)

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Vlad S (owner), with Claude during `sdd:design base-logic`

## Context

The spec caps lookups at two levels: 30 per Bot user in any rolling 60 minutes (AC-16) and 5,000 a day for the whole bot, counted in UTC (AC-17). Every lookup counts, including failed and timed-out ones. Workers isolates are short-lived and many run in parallel, so a counter in memory is neither shared nor durable. Both counts need a store every invocation can see. The daily count also matters beyond this feature: step 3 (alerts) spends the rest of the weather source's shared 10k/day allowance and needs to know what this step used.

## Decision drivers

- spec §6: "≤ 5,000 a day in total, enforced (AC-17; half the free cap, leaving the rest for step 3 alerts)".
- spec §6: "≤ 30 lookups per Bot user in any rolling 60 minutes (AC-16)".
- SAD §2 / ADR-0003 (project): D1 is the project's only datastore. D1 Free allows 100k rows written a day.
- spec §6: "CPU per message ≤ 10 ms p99". Counting must stay a couple of indexed queries.

## Considered options

1. **D1 tables.** A per-chat lookup log (one row per lookup, pruned once older than 60 minutes) gives the rolling count. One counter row per UTC day is incremented before each lookup (reserve-then-call).
2. **A SQLite-backed Durable Object.** A single object (included in Workers Free) holds both counters with strict, serialized updates. Precondition: project ADR-0003 names D1 as the only datastore, so this option would first need that ADR amended to allow a coordination store.

## Decision outcome

**Chosen:** Option 1, D1 tables. It reuses the datastore and test harness the project already has, with no new binding, class or deployment piece. Reserving a slot on the daily counter before the call keeps AC-17 strict enough: two lookups racing within the same instant can push the count past 5,000 by at most a few, which the spec accepts. The write cost is about 2 rows per lookup, so a full day of 5,000 lookups uses roughly 10k of the 100k free writes.

## Consequences

**Positive**
- One datastore, one migration tool, and one integration-test setup (local D1 in workerd).
- Step 3 alerts can read the same daily counter through the same port.

**Negative**
- Each lookup costs about 2 D1 writes plus 1–2 indexed reads. That is a small, permanent share of the D1 daily quota.
- The per-chat check and insert are separate statements, so two simultaneous requests from one chat can both pass at 29. A count briefly reaching 31 is harmless.

**Neutral**
- Moving to a Durable Object later is local to the `UsageCounter` adapter. The port and use cases don't change.

## Links

- Spec: [[../spec.md]] AC-16, AC-17, §6
- SAD: [[../sad.md]] §4, §8
- Related ADR: project [[../../../adr/0003-store-state-in-cloudflare-d1.md]]
