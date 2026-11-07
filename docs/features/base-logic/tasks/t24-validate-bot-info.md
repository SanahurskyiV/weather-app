---
id: T24
title: "Check BOT_INFO and fall back to getMe when it is invalid"
layer: "wiring"
deps: ["T14"]
blocks: ["T25"]
acs: ["AC-13", "AC-15"]
files_hint: ["src/worker.ts", "test/integration/telegram-edge.test.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---
# T24 — Check BOT_INFO and fall back to getMe when it is invalid

## Place in the sequence

- **Blocked by:** T14 · **Blocks:** T25
- **Origin:** follow-up from review `_review/review-2026-11-07.md`, finding R3-01 (resolved "Fix now" by the owner, 2026-11-07).

## Checklist

- [x] RED: a `BOT_INFO` that isn't JSON and one with the full `{"ok":true,"result":{…}}` `getMe` response each log `startup_warning` with reason `BOT_INFO invalid`, and the bot still answers (a stubbed `getMe`).
- [x] `parseBotInfo` checks `id` (number), `username` (string) and `is_bot === true`. An invalid value → `undefined`, so grammY calls `getMe`. No throw.

## Definition of Done

- [x] An invalid `BOT_INFO` never throws from `buildApp`. It logs `startup_warning {reason: "BOT_INFO invalid"}` once per isolate and falls back to `getMe`. The group pointer names the real username (asserted). npm test, lint, typecheck green.
