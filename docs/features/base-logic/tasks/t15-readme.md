---
id: T15
title: "Update the README for the new commands and the BOT_INFO deploy step"
layer: "docs"
deps: []
blocks: []
acs: []
files_hint: ["README.md"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "todo"
step: ""
---
# T15 — Update the README for the new commands and the BOT_INFO deploy step

## Place in the sequence

- **Blocked by:** nothing · **Blocks:** nothing · **Wave:** 1 (starts immediately).
- **Lane:** own lane.

## Why (user story)

> **As a** Bot user opening the bot for the first time, or sending something it doesn't understand
> **I want** a short reply that tells me what to type
> **So that** I can try the bot in seconds without reading docs
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It tells the Operator and new Bot users what the bot now does and how to deploy it without the cold-start `getMe` cost.

## Inlined context

> No new deployment units. The feature ships inside the existing `weather-bot` Worker and its D1 database. It adds one or more forward migrations (staged by `sdd:data-model`) and no new bindings or secrets. `BOT_INFO` becomes required for production deploys (deploy checklist plus a startup warning; it stays optional in code, see §1 ¶4): without it, grammY calls `getMe` on every cold start, which uses an extra subrequest and CPU.
>
> — `sad.md §7, verbatim` · full text: [sad.md](../sad.md)

> - Open-Meteo terms: non-commercial use, CC-BY 4.0 attribution in the README.
>
> — `sad.md §2, regulatory, verbatim` · full text: [sad.md](../sad.md)

> The commands are `/city <name>` (called "the set-city command" in §5), `/weather` ("ask for the weather") and `/start` (the greeting).
>
> — `spec.md §1, committed approach, abridged` · full text: [spec.md](../spec.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

None of spec §5. This is a docs task. Its checks are the Definition of Done below, which serve the §1 command names and the SAD §7 deploy rule inlined above.

## Checklist

- [ ] Status line: the bot sets a Home city and shows the current weather. Alerts, quiet hours and `/demo_alert` remain on the roadmap.
- [ ] Add a "Commands" section: `/start`, `/city <name>` (e.g. `/city Kyiv`, `/city Paris, US`) and `/weather`. Note that it works in private chats only.
- [ ] Deploy: add `wrangler secret put BOT_INFO` (the JSON from `getMe`) as required for production, and say why (no `getMe` per cold start).
- [ ] Keep the Open-Meteo CC BY 4.0 attribution section as it is.
- [ ] Run `npx prettier --check README.md`.

## Edge cases

| Case | Behaviour |
|---|---|
| A reader runs locally without `BOT_INFO` | Works. It is optional in code, and the README says so. |

## Definition of Done

- [ ] README sections updated as listed
- [ ] `prettier --check README.md` passes
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
