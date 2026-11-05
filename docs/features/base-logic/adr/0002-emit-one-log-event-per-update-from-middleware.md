---
status: Accepted
owner: "Vlad S"
reviewers: ["Tech Lead"]
updated_at: "2026-11-05"
feature_size: "S"
ticket: "roadmap step 2 (base-logic)"
---

# 0002 — Emit one log event per update from a request-scoped middleware collector

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Vlad S (owner), with Claude during `sdd:design base-logic`

## Context

AC-15 requires exactly one log event for every request, successful or failed. The event carries the update id, an edit marker, the outcome or failure kind, chat, command, lookup count, duration and reading time. Every §6 measurement and §7 KPI is counted from these events. Today `log(event, fields)` is called ad hoc (`webhook_error` in `src/worker.ts`). This is the first feature with several commands and failure paths, so the pattern chosen here becomes the precedent for every later command.

## Decision drivers

- spec AC-15: "Every request, successful or failed, produces exactly one log event."
- spec §6: reply time, reply rate, freshness and per-chat lookup counts are all measured from "the per-request log event".
- CLAUDE.md: "The webhook answers 200 even when a handler fails". A crashed handler still has to produce its event.

## Considered options

1. **Middleware collector.** An outermost grammY middleware starts a timer and an empty event object on the update context. Handlers and use-case results add fields to it, and the middleware writes exactly one `log("update", …)` in `finally`, including after an unexpected throw. Handlers never call `log()` directly.
2. **Handlers log at the end.** Each command handler logs its own outcome, and the outer catch logs crashes.

## Decision outcome

**Chosen:** Option 1, the middleware collector. "Exactly one" then holds by construction: a single `finally` writes the event, so no branch can leave a request with zero events or two. Duration is measured in one place, from update received to reply sent.

## Consequences

**Positive**
- AC-15's "exactly one" can be checked with one integration assertion per scenario.
- New commands get logging for free, and the event shape is defined once (SAD §8).

**Negative**
- Handlers must write their outcome into a context field rather than return it straight to the user. That is one more indirection to learn.
- Faults raised outside grammY (before `webhookCallback` runs, e.g. a forged update failing the secret check) are not covered. Forged updates stay unlogged, silent and unanswered on purpose (spec §6.1).

**Neutral**
- The event is named `update`. The `webhook_error` log in `src/worker.ts` stays only for faults outside the bot pipeline.

## Links

- Spec: [[../spec.md]] AC-15, US-06, §6, §7
- SAD: [[../sad.md]] §4, §8
- Related ADR: [[0001-count-lookups-in-d1-tables]] (the lookup count field)
