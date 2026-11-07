---
id: T26
title: "Spell out secret_token in the README deploy step"
layer: "docs"
deps: ["T15"]
blocks: []
acs: []
files_hint: ["README.md"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---
# T26 — Spell out secret_token in the README deploy step

## Place in the sequence

- **Blocked by:** T15 · **Blocks:** —
- **Origin:** follow-up from review `_review/review-2026-11-07.md`, finding R3-04 (resolved "Fix now" by the owner, 2026-11-07). Spec §6.1, SAD §8 Authentication.

## Checklist

- [x] Replace "then `setWebhook` to `https://<worker>.workers.dev/webhook`" with the full curl, including `-d "secret_token=<WEBHOOK_SECRET>"` (the same as the local recipe).

## Definition of Done

- [x] The deploy step's `setWebhook` command carries `secret_token`. `prettier --check` green. Docs only, no test (no behaviour changes).
