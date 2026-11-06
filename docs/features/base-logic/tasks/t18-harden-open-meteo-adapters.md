---
id: T18
title: "Pin the 1.5 s cutoff and tolerate malformed geocoder entries and unknown timezones"
layer: "infra"
deps: ["T10", "T16"]
blocks: []
acs: ["AC-04b", "AC-10", "AC-08"]
files_hint: ["src/adapters/open-meteo/http.ts", "src/adapters/open-meteo/geocoding.ts", "src/adapters/open-meteo/geocoding.test.ts", "src/adapters/open-meteo/forecast.test.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---
# T18 — Pin the 1.5 s cutoff and tolerate malformed geocoder entries and unknown timezones

## Place in the sequence

- **Blocked by:** T10, T16 · **Blocks:** —
- **Origin:** follow-up from review `_review/review-2026-11-06.md`, findings R-02, R-05, R-14 (resolved "Fix now" by the owner, 2026-11-06).

## Checklist

- [ ] Contract test: spy on `AbortSignal.timeout`, expect 1500 for find, findById and current.
- [ ] `find`: one bad entry among good ones gives the good ones; all bad gives `unavailable`.
- [ ] `toCandidate`: drop a candidate whose `timezone` throws in `new Intl.DateTimeFormat("en", { timeZone })`.

## Definition of Done

- [ ] A test asserts every outbound call uses AbortSignal.timeout(1500); `find` skips malformed entries and entries whose timezone Intl rejects, keeping the valid ones, and is `unavailable` only when the body/results are malformed or every entry is bad; `findById` with an unknown timezone is `unavailable`; npm test, lint, typecheck green.
