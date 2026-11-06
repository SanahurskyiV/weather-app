---
id: T21
title: "Keep the real outcome when the reply fails, name the fault, and prove no secret is logged"
layer: "ports"
deps: ["T11"]
blocks: []
acs: ["AC-15"]
files_hint: ["src/adapters/telegram/request-log.ts", "src/adapters/telegram/request-log.test.ts", "src/adapters/telegram/context.ts", "test/integration/telegram-edge.test.ts", "test/integration/e2e.test.ts"]
owner: "Vlad S"
estimate: "M"
context_budget: "S"
status: "todo"
step: "—"
---
# T21 — Keep the real outcome when the reply fails, name the fault, and prove no secret is logged

## Place in the sequence

- **Blocked by:** T11 · **Blocks:** —
- **Origin:** follow-up from review `_review/review-2026-11-06.md`, findings R-06, R-08, R-09 (resolved "Fix now" by the owner, 2026-11-06).

## Checklist

- [ ] `UpdateEvent`: `reply_failed?: boolean`, `fault_kind?: string`.
- [ ] Wrapped `ctx.reply` marks reply failures; the catch skips the fault reply for them.
- [ ] `request-log.test.ts` unit test; secrets-in-logs integration test.

## Definition of Done

- [ ] A failing sendMessage sets `reply_failed: true`, keeps the handler's outcome and sends no second reply; a handler fault logs `fault` plus a secret-free `fault_kind`; a unit test of the collector covers ok, expected failure, fault and reply failure; an integration test over not_found, unavailable and storage fault asserts neither BOT_TOKEN nor WEBHOOK_SECRET in any log line; npm test, lint, typecheck green.
