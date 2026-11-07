---
id: T22
title: "Let the get-current-weather use case report its lookups"
layer: "app"
deps: ["T8", "T13"]
blocks: []
acs: ["AC-15"]
files_hint: ["src/app/get-current-weather.ts", "src/app/get-current-weather.test.ts", "src/adapters/telegram/commands/weather.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---
# T22 — Let the get-current-weather use case report its lookups

## Place in the sequence

- **Blocked by:** T8, T13 · **Blocks:** —
- **Origin:** follow-up from review `_review/review-2026-11-06.md`, findings R-13 (resolved "Fix now" by the owner, 2026-11-06).

## Checklist

- [ ] Unit test: onLookup called once on ok and on unavailable, never on no_home_city or a limit.
- [ ] Handler increments `ctx.event.lookups` in the callback.

## Definition of Done

- [ ] `getCurrentWeather(chatId, onLookup)` calls `onLookup` once per reserved lookup; the /weather handler counts through it instead of hard-coding; npm test, lint, typecheck green.
