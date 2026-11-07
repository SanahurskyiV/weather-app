---
id: T23
title: "Use the real command in the help reply and assert nothing is stored where the plan says so"
layer: "ports"
deps: ["T11", "T12"]
blocks: []
acs: ["AC-12", "AC-04b", "AC-17"]
files_hint: ["src/adapters/telegram/replies.ts", "test/integration/telegram-edge.test.ts", "test/integration/city.test.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---
# T23 — Use the real command in the help reply and assert nothing is stored where the plan says so

## Place in the sequence

- **Blocked by:** T11, T12 · **Blocks:** —
- **Origin:** follow-up from review `_review/review-2026-11-06.md`, findings R-10, R-12 (resolved "Fix now" by the owner, 2026-11-06).

## Checklist

- [ ] Help test asserts the exact `/city` wording.
- [ ] Add Home-city assertions to the edit (telegram-edge), lookup-hang and daily-limit (city) tests.

## Definition of Done

- [ ] The help reply says "send /city followed by the city name" (asserted); the edit, lookup-hang and daily-limit tests assert the Home city is unchanged; npm test, lint, typecheck green.
