---
id: T17
title: "Record the two-lookup non-Latin set-city decision in ADR-0003 and the design docs"
layer: "docs"
deps: ["T16"]
blocks: []
acs: ["AC-01", "AC-16", "AC-17"]
files_hint: ["docs/features/base-logic/adr/0003-resolve-non-latin-names-with-a-localized-search.md", "docs/features/base-logic/sad.md", "docs/features/base-logic/spec.md"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---
# T17 — Record the two-lookup non-Latin set-city decision in ADR-0003 and the design docs

## Place in the sequence

- **Blocked by:** T16 · **Blocks:** —
- **Origin:** follow-up from review `_review/review-2026-11-06.md`, findings R-01, R-11 (limitation) (resolved "Fix now" by the owner, 2026-11-06).
- **TDD:** docs-only task, no RED step.

## Checklist

- [ ] Write `adr/0003-…md` (MADR, Accepted, 2026-11-06) from `tasks/t16-non-latin-city-names.md`.
- [ ] `sad.md` §4 choice 1, §5 geocoding line, §8 Logging `lookups (0, 1 or 2)`, each linking ADR-0003.
- [ ] `spec.md` test-plan edge row "Outbound budget per message": at most two lookups and one reply.

## Definition of Done

- [ ] Feature ADR-0003 (Accepted) records the localized search + English re-fetch, its cost (at most 2 lookups + 1 reply) and the Ukrainian-only Cyrillic limitation (OQ-4); sad.md §4/§5/§8 and the spec test-plan edge row say at most 2 lookups; prettier clean.
