---
id: T25
title: "Move the composition out of the main module so it exports only the handler"
layer: "wiring"
deps: ["T14", "T20", "T24"]
blocks: []
acs: ["AC-15"]
files_hint: ["src/worker.ts", "src/composition.ts", "test/integration/worker.smoke.test.ts", "test/integration/telegram-edge.test.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---
# T25 — Move the composition out of the main module so it exports only the handler

## Place in the sequence

- **Blocked by:** T14, T20, T24 (they touch the same file) · **Blocks:** —
- **Origin:** follow-up from review `_review/review-2026-11-07.md`, finding R3-02 (resolved "Fix now" by the owner, 2026-11-07); first follow-up of `_fixes/2026-11-07-worker-string-export.md`.

## Checklist

- [x] RED: tighten the main-module test in `worker.smoke.test.ts` to `expect(Object.keys(mainModule)).toEqual(["default"])`.
- [x] Move `App`, `buildApp`, `getApp` and the cached app into `src/composition.ts` and point the tests that use `buildApp` at it. `src/worker.ts` keeps only routing plus `export default`.

## Definition of Done

- [x] `src/worker.ts` exports only `default` (asserted). The composition is still built once per isolate. `wrangler dev` starts and `/health` → 200. npm test, lint, typecheck, build green.
