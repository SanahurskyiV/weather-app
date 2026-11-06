---
id: T20
title: "Drop forged updates silently and fail closed without a webhook secret"
layer: "wiring"
deps: ["T14"]
blocks: []
acs: ["AC-15"]
files_hint: ["src/worker.ts", "test/integration/telegram-edge.test.ts", "test/integration/worker.smoke.test.ts", "docs/features/base-logic/sad.md"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---
# T20 — Drop forged updates silently and fail closed without a webhook secret

## Place in the sequence

- **Blocked by:** T14 · **Blocks:** —
- **Origin:** follow-up from review `_review/review-2026-11-06.md`, findings R-04, R-07 (resolved "Fix now" by the owner, 2026-11-06).

## Checklist

- [ ] Check `X-Telegram-Bot-Api-Secret-Token` in worker.ts before `handleUpdate`.
- [ ] Empty or undefined secret: log `startup_error`, drop every update.
- [ ] Update the 401 assertion at telegram-edge.test.ts:51.

## Definition of Done

- [ ] A wrong or missing secret header gets a bare 200 with no reason text and no bot work; an empty WEBHOOK_SECRET refuses every update (logged `startup_error`) instead of accepting all; SAD flow A wording matches spec §6.1; npm test, lint, typecheck green.
