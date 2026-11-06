---
id: T14
title: "Build the bot once per isolate and verify the per-message budgets end to end"
layer: "wiring"
deps: ["T12", "T13"]
blocks: []
acs: ["AC-14", "AC-15"]
files_hint: ["src/worker.ts", "test/integration/worker.smoke.test.ts", "test/integration/e2e.test.ts"]
owner: "Vlad S"
estimate: "M"
context_budget: "M"
status: "done"
step: "COMMIT"
---
# T14 — Build the bot once per isolate and verify the per-message budgets end to end

## Place in the sequence

- **Blocked by:** T12 — Add the /city command and its replies · T13 — Add the /weather command and its replies · **Blocks:** nothing · **Wave:** 6 (after its dependencies).
- **Lane:** shares `src/worker.ts` with T11; shares `src/worker.ts` with T12; shares `src/worker.ts` with T13 (serialized).

## Why (user story)

> **As a** Bot user who adds the bot to a group
> **I want** a clear pointer to a private chat
> **So that** I know where the bot works, and nobody in the group can change anyone's Home city
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

> **As an** Operator
> **I want** every failed Bot user request recorded as one structured log event (failure kind and chat, no secrets)
> **So that** I can see why someone got an error reply
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It wires everything together so setup doesn't repeat per update, and proves the whole bot keeps one person's city to themselves while staying inside the free-plan budgets.

## Inlined context

> The composition root builds everything once per isolate: on the first update it builds the adapters, use cases and grammY `Bot` from `env`, which doesn't change within an isolate, and caches them at module scope. Command handlers close over those use cases. Only the update itself and the `Clock` reading are per request, so setup doesn't repeat on every update.
>
> — `sad.md §5, composition, verbatim` · full text: [sad.md](../sad.md)

> - Decision override: `BOT_INFO` is required for production deploys, while it stays optional in code and in CLAUDE.md. Rationale: without it, every cold start makes an extra `getMe` subrequest and spends CPU, which threatens QG-3. It stays optional in `src/env.d.ts`, so local dev and tests run without it. Enforcement is the deploy checklist plus a startup warning log, not a hard failure (§7, §11).
>
> — `sad.md §1, decision override, verbatim` · full text: [sad.md](../sad.md)

> | Outbound calls per message | ≤ 3 (one lookup, one reply, one spare; the platform cap is 50) | integration tests count the stubbed outbound calls |
>
> — `spec.md §6, outbound calls, verbatim` · full text: [spec.md](../spec.md)

> | CPU per message | ≤ 10 ms p99 (Workers Free hard limit; an overrun kills the request before it can reply) | Workers analytics, CPU time per invocation |
>
> — `spec.md §6, CPU, verbatim` · full text: [spec.md](../spec.md)

> - **How verify:** integration tests count the stubbed outbound calls per scenario (at most 1 lookup + 1 reply). Workers analytics CPU time p99 after launch. `BOT_INFO` is set, so there is no `getMe` call on cold start.
>
> — `sad.md §10, QG-3, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

### AC-14 — authorization (one person's city is theirs alone)

> **Given** Bot user A's Home city is Kyiv and Bot user B's is Lviv
> **When** Bot user B sets the city "Paris"
> **Then** A's Home city is still Kyiv, and nothing in any reply to B reveals A's city
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — error (failure is visible to the Operator)

> **Given** a Bot user request fails: the place isn't found, the weather source is unavailable, or an unexpected fault occurs
> **When** the failure happens
> **Then** the Bot user still gets a plain-language reply ("something went wrong, please try again" for an unexpected fault), and the Operator can find exactly one log event for that request naming the failure kind and the chat. It never contains the bot token or the webhook secret.
>
> Every request, successful or failed, produces exactly one log event. It records the outcome (or the failure kind), the chat, the command, how many lookups were made, how long the request took, and the time of the reading shown when there is one. Every §6 measurement and §7 KPI is counted from these events.
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `src/worker.ts`: a module-scope `let app: { handle } | undefined`. On the first `fetch`, build the D1 adapters, Open-Meteo adapters, `systemClock`, the use cases, `createBot` and `webhookCallback` once, then reuse them. Never store per-request data at module scope.
- [ ] When `env.BOT_INFO` is absent, `log("startup_warning", { reason: "BOT_INFO missing" })` once per isolate. It must not be a hard failure.
- [ ] Keep `/health`, the 404 path and the `webhook_error` catch unchanged.
- [ ] `test/integration/e2e.test.ts`: for set-city, weather, start, fallback and group, count `fetch` calls by host (≤ 1 Open-Meteo, 1 `api.telegram.org`) and `update` events (exactly 1).
- [ ] Two chats: A = Kyiv, B sets Paris. A is unchanged, and no reply to B contains "Kyiv".
- [ ] A stubbed source that never resolves until it is aborted still gets the "temporarily unavailable" reply.
- [ ] Keep `worker.smoke.test.ts` green.

## Edge cases

| Case | Behaviour |
|---|---|
| Second update in the same isolate | No adapter or Bot rebuild (assert the factory is called once) |
| `BOT_INFO` unset | One `startup_warning` event and the bot still works |
| B's reply after A set Kyiv | Never contains A's city (AC-14) |
| Unexpected throw inside a use case | Fault reply, one `update` event with `outcome: fault`, HTTP 200 (AC-15) |

## Definition of Done

- [ ] `e2e.test.ts` and `worker.smoke.test.ts` pass
- [ ] Each scenario makes ≤ 3 outbound calls (spec §6)
- [ ] `npm run build` succeeds
- [ ] lint + typecheck clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
