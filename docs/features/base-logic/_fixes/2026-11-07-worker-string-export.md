---
slug: base-logic
date: 2026-11-07
triage: regression
acs: [AC-15]
commit: d631525
recurrence_of: none
---

# Fix: the Worker fails to start in workerd because the main module exports a string

## Symptom

Running `wrangler dev` (as `sdd:ship` did during final verification), expected the Worker to start and answer
`GET /health` with 200. Got a runtime start failure:

```
service core:user:weather-bot: Uncaught TypeError: Incorrect type for map entry 'WEBHOOK_PATH':
the provided value is not of type 'function or ExportedHandler'.
The Workers runtime failed to start.
```

Scope: every user and every request. A deploy would fail the same way, because no update reaches the bot. The bug has been
there since `WEBHOOK_PATH` was exported from `src/worker.ts`. It was never released: there is no remote and nothing is deployed.

## Root cause

`src/worker.ts` (the `main` in `wrangler.toml`) had `export const WEBHOOK_PATH = "/webhook"` so the tests could build
webhook URLs. workerd treats every named export of the main module as an entry point and only accepts a function or an
`ExportedHandler` object, so it refused the string at startup. The tests missed it because the vitest Workers pool imports
the module as an ordinary ES module (`exports.default.fetch`, direct imports) and never applies workerd's entry-point
check. `npm run build` (`wrangler deploy --dry-run`) only bundles and does not start the runtime.

## The pinning test

`test/integration/worker.smoke.test.ts` › "exports only entry points from the main module, so workerd can start it"
(integration, in the workerd pool). It maps every export of `src/worker.ts` to `"entry point"` (function or non-null
object) or its `typeof`, and asserts that every export is an entry point. RED run before the fix:

```
AssertionError: expected { WEBHOOK_PATH: 'string', …(3) } to deeply equal { WEBHOOK_PATH: 'entry point', …(3) }
-   "WEBHOOK_PATH": "entry point",
+   "WEBHOOK_PATH": "string",
```

GOOD red. After the fix: 310/310 tests pass, typecheck, lint and build are clean, and `wrangler dev` prints
`Ready on http://127.0.0.1:8799`, with `/health` → 200 `ok` and a forged webhook POST → bare 200.

Fix: `WEBHOOK_PATH` moved to `src/adapters/telegram/webhook-path.ts`, which `src/worker.ts` and both test helpers now import.

## Spec patch

None. The spec was right, and AC-15 was re-verified: every request must end in a reply and one log event, with the webhook
answering success. A Worker that cannot start breaks that for every request. The wording allows no other reading.

## Follow-ups

- `src/worker.ts` still exports `buildApp` and `getApp` for the tests. workerd accepts functions at startup, but it may treat
  them as entry points. Consider moving the composition into its own module so the main module exports only `default`.
- The pinning test is a proxy for workerd's rule. A real boot check (`wrangler dev` or Miniflare starting `dist/worker.js` and
  probing `/health`) as a CI step would catch the whole class of start-up failures that the pool cannot see.
