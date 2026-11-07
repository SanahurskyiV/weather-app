---
id: T19
title: "Name the current Home city on every \"couldn't find that place\" reply"
layer: "app"
deps: ["T7", "T12"]
blocks: []
acs: ["AC-05", "AC-07"]
files_hint: ["src/app/set-home-city.ts", "src/app/set-home-city.test.ts", "src/adapters/telegram/replies.ts", "test/integration/city.test.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---
# T19 — Name the current Home city on every "couldn't find that place" reply

## Place in the sequence

- **Blocked by:** T7, T12 · **Blocks:** —
- **Origin:** follow-up from review `_review/review-2026-11-06.md`, findings R-03 (resolved "Fix now" by the owner, 2026-11-06).

## Checklist

- [ ] `SetCityError`: `too_long` / `unknown_country` join `not_found` / `unavailable` in carrying `current`.
- [ ] `setCityErrorReply`: pass `error.current` for them.
- [ ] e2e: with Kyiv stored, "Paris, Texas" and a 101-character name reply "Your city is still Kyiv".

## Definition of Done

- [ ] `too_long` and `unknown_country` carry the current Home city (one D1 read, still no lookup and no limit read); the reply adds "Your city is still X." when one is set; `blank` is unchanged; npm test, lint, typecheck green.
