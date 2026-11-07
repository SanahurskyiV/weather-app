---
status: Accepted
owner: "Vlad S"
reviewers: []
updated_at: "2026-11-05"
feature_size: "n/a (repo foundation)"
ticket: "n/a"
---

# 0002 — Organize code as ports and adapters with a pure domain layer

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Vlad S, with Claude during the `survey` foundation session

## Context

The bot's interesting logic is the alert rules, de-duplication and quiet hours across timezones. It is pure computation over forecast data and time. Clean, well-tested code is a stated goal (idea brief §2), and the hosting choice (ADR-0001) carries a CPU-limit risk that could force a move later. The code layout should keep that logic testable and independent of the platform.

## Decision drivers

- Clean, readable, well-tested code is a goal (idea brief §2).
- Alert and quiet-hours logic must be easy to test with a controlled clock and forecast data.
- Hosting may change if the Workers free limits fail (ADR-0001), so isolate the platform code.
- Keep it small: one deployable and no framework ceremony.

## Considered options

1. **Ports and adapters (lite).** `src/domain` (pure), `src/app` (use cases and port interfaces), `src/adapters` (Telegram, Open-Meteo, D1, clock), and `src/worker.ts` as the composition root. Wiring is by hand.
2. **Flat, by feature.** grammY handlers call fetch and D1 directly. Fastest to write, but logic gets tangled with I/O and is hard to test.
3. **Full DI framework / NestJS-style modules.** Heavy for a Worker, adds bundle size and CPU at start-up, and is ceremony for a small bot.

## Decision outcome

**Chosen:** Option 1. Rules become pure functions with table-driven tests, and use cases are tested with fake ports. The Workers-specific code is confined to `src/worker.ts` and the adapters, so hosting can change without touching the logic. With no framework, it stays light enough for the free CPU budget.

## Consequences

**Positive**
- Fast, deterministic unit tests for the core logic, through the `Clock` port and forecast fixtures.
- Hosting or weather-provider swaps stay inside the adapters.
- A layout that's easy to read and explain.

**Negative**
- A bit more indirection (port interfaces) than a flat bot.
- Layer boundaries need enforcing (ESLint import rules), or they erode.

**Neutral**
- Becoming a feature-sliced layout later is a mechanical refactor.

## Notes

- 2026-11-07: the composition root moved from `src/worker.ts` to `src/composition.ts` (base-logic review R3-02, task T25), because workerd treats every named export of the main module as an entry point. `src/worker.ts` now only routes. The decision above is unchanged.

## Links

- Idea brief: [[../idea-brief.md]] §2
- Architecture map: [[../architecture-map.md]] §Module inventory, §Conventions
- Related ADR: [[0001-run-on-cloudflare-workers-with-webhook-and-cron]]
