---
id: T11
title: "Build the Telegram edge: request-log middleware, chat-type split, start, help and group replies"
layer: "ports"
deps: ["T6", "T9"]
blocks: ["T12", "T13"]
acs: ["AC-11", "AC-12", "AC-13", "AC-15"]
files_hint: ["src/adapters/telegram/request-log.ts", "src/adapters/telegram/bot.ts", "src/adapters/telegram/replies.ts", "src/adapters/telegram/commands/start.ts", "src/adapters/telegram/commands/help.ts", "src/adapters/telegram/commands/group.ts", "src/worker.ts", "test/integration/telegram-edge.test.ts", "test/fixtures/telegram-group-command-update.json"]
owner: "Vlad S"
estimate: "M"
context_budget: "M"
status: "todo"
step: ""
---
# T11 — Build the Telegram edge: request-log middleware, chat-type split, start, help and group replies

## Place in the sequence

- **Blocked by:** T6 — Declare the four new ports and the get-home-city use case · T9 — Implement the D1 HomeCityRepo and UsageCounter adapters · **Blocks:** T12 — Add the /city command and its replies · T13 — Add the /weather command and its replies · **Wave:** 4 (after its dependencies).
- **Lane:** shares `src/adapters/telegram/bot.ts` with T12; shares `src/adapters/telegram/bot.ts` with T13; shares `src/worker.ts` with T14 (serialized).

## Why (user story)

> **As a** Bot user opening the bot for the first time, or sending something it doesn't understand
> **I want** a short reply that tells me what to type
> **So that** I can try the bot in seconds without reading docs
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

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

It builds the pipeline every message runs through (one log event, the right chat type, and a reply for whatever the bot doesn't understand), so the commands in T12 and T13 only fill in fields.

## Inlined context

> **Chosen:** Option 1, the middleware collector. "Exactly one" then holds by construction: a single `finally` writes the event, so no branch can leave a request with zero events or two. Duration is measured in one place, from update received to reply sent.
>
> — `adr/0002 Decision outcome, verbatim` · full text: [adr/0002](../adr/0002-emit-one-log-event-per-update-from-middleware.md)

> | Logging | Exactly one `log("update", {...})` per update, written in `finally` by the request-log middleware. Fields: `update_id`, `is_edit` (bool), `chat`, `chat_type`, `command`, `outcome` (`ok` or a failure kind: `blank`, `too_long`, `not_found`, `unknown_country`, `unavailable`, `user_limit`, `daily_limit`, `no_home_city`, `not_understood`, `group_pointer`, `fault`), `lookups` (0 or 1), `duration_ms`, `reading_time` (weather only), `replied` (bool). Never the token, the secret or message text. | ADR-0002; here |
>
> — `sad.md §8, Logging, verbatim` · full text: [sad.md](../sad.md)

> 4. **Stateless, private-only edge.** Every update is handled on its own, with no conversation state. Chat-type filtering happens at the bot edge: the private composer serves the commands, the group composer answers the bot's own commands with the "private chat only" pointer, and everything else is ignored. Use cases never see a non-private chat.
>
> — `sad.md §4, choice 4, verbatim` · full text: [sad.md](../sad.md)

> else edited message
>         S->>S: writes one update log event marked as an edit
>         S-->>C: acknowledges with no reply
>     else unexpected fault in any handler
>             S->>C: sends "something went wrong, please try again"
>             S->>S: records failure kind fault on the event
>
> — `sad.md §6, flow A, abridged` · full text: [sad.md](../sad.md)

> | Text safety | Replies are plain text (no `parse_mode`). Echoed names come from the geocoder's resolved place, not from the raw query. | spec §6.1 |
>
> — `sad.md §8, Text safety, verbatim` · full text: [sad.md](../sad.md)

> - The webhook answers 200 even when a handler fails, so Telegram does not redeliver forever.
>
> — `CLAUDE.md §Conventions, webhook, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. `/start` reads the Home city through `getHomeCity` (T6), backed by the D1 repo (T9).

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

### AC-11 — happy

> **Given** a Bot user, new or returning
> **When** the Bot user starts the bot
> **Then** the greeting explains in a few lines how to set a city and how to ask for the weather, each with an example; a returning Bot user who has a Home city also sees it named
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — error (not understood)

> **Given** a Bot user in a private chat
> **When** the Bot user sends plain text, a command the bot does not know, or anything else it can't use (a sticker, photo, voice note or location pin)
> **Then** the system replies with a short list of what it understands, including "send the set-city command followed by the city name", and stores nothing. Edits to messages already sent get no reply.
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — authorization (not a private chat)

> **Given** the bot has been added to a group
> **When** any Bot user sends one of the bot's commands there
> **Then** nothing is stored or changed, and the system answers each such command with one reply saying the bot only works in a private chat. This applies only to the bot's own commands meant for this bot, not commands addressed to another bot. Other group messages get no reply, being added to a group triggers no message, and the bot never posts in channels.
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — error (failure is visible to the Operator)

> **Given** a Bot user request fails: the place isn't found, the weather source is unavailable, or an unexpected fault occurs
> **When** the failure happens
> **Then** the Bot user still gets a plain-language reply ("something went wrong, please try again" for an unexpected fault), and the Operator can find exactly one log event for that request naming the failure kind and the chat. It never contains the bot token or the webhook secret.
>
> Every request, successful or failed, produces exactly one log event. It records the outcome (or the failure kind), the chat, the command, how many lookups were made, how long the request took, and the time of the reading shown when there is one. Every §6 measurement and §7 KPI is counted from these events.
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `request-log.ts`: the outermost middleware. It puts `ctx.event = { update_id, is_edit, chat, chat_type, command, outcome, lookups: 0, replied: false }` on the context, starts the timer from the update, and writes `log("update", { …event, duration_ms })` in `finally`. In `catch` it replies "something went wrong, please try again", sets `outcome: "fault"` and swallows the error so the webhook answers 200. Wrap `ctx.reply` (or use an API transformer) to set `replied: true`.
- [ ] `replies.ts`: all user-facing text as plain-text builders: greeting (with or without a Home city), help list (including "send the set-city command followed by the city name" using `/city <name>`), the private-chat pointer, and the fault reply. Never set `parse_mode`.
- [ ] `bot.ts`: `createBot(token, botInfo, deps)` composes request-log, then `chatType("private")` (commands, then the fallback), then `chatType(["group", "supergroup"])` (the bot's own commands get the pointer). Channels get nothing. `edited_message` sets `is_edit` and gets no reply.
- [ ] `commands/start.ts` (greeting via `getHomeCity`), `commands/help.ts` (fallback for text, unknown commands, stickers, photos, voice and location, outcome `not_understood`) and `commands/group.ts` (outcome `group_pointer`).
- [ ] `src/worker.ts`: pass `{ getHomeCity }` built from `makeD1HomeCityRepo(env.DB)`. Full per-isolate caching is T14.
- [ ] Add `test/integration/telegram-edge.test.ts`. Capture `console.log` and assert one `update` event per scenario, with no token or secret in it.
- [ ] Update `worker.smoke.test.ts` for the new `START_MESSAGE`.

## Edge cases

| Case | Behaviour |
|---|---|
| Forged update (wrong secret) | Rejected by grammY `secretToken`. No reply and no log event (flow A). |
| Edited message | One event with `is_edit: true`, no reply (AC-12) |
| `/city@other_bot` in a group | No reply. grammY matches only commands addressed to this bot (AC-13). |
| Bot added to a group / plain group text / channel post | No reply, and nothing stored (AC-13) |
| Sticker / photo / voice / location pin in private | Help list, outcome `not_understood` (AC-12) |
| A handler throws | Fault reply, `outcome: fault`, exactly one event, webhook 200 (AC-15) |

## Definition of Done

- [ ] `telegram-edge.test.ts` covers every edge row and passes
- [ ] Every scenario asserts exactly one `update` event and at most one reply
- [ ] The log output never contains `BOT_TOKEN` or `WEBHOOK_SECRET`
- [ ] lint + typecheck clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
