---
status: Accepted
owner: "Vlad S"
reviewers: ["Tech Lead"]
updated_at: "2026-11-06"
feature_size: "S"
ticket: "roadmap step 2 (base-logic)"
---

# 0003 — Resolve non-Latin city names with a localized search and an English re-fetch

- **Status:** Accepted
- **Date:** 2026-11-06
- **Deciders:** Vlad S (owner), with Claude during `sdd:implement base-logic` (task T16); recorded post-hoc after
  review finding R-01 (`_review/review-2026-11-06.md`)

## Context

AC-01 says the resolved place is always shown with its full English name, whatever alphabet the Bot user typed
("Київ" → "Kyiv, Kyiv City, Ukraine"). The SAD (§4 choice 1, §5) planned one geocoding search with `language=en` per
set-city. A live check on 2026-11-06 showed that Open-Meteo geocoding matches names only in the requested language:
`name=Київ&language=en` returns no results, `language=uk` finds Kyiv (id 703448) with Ukrainian names, and
`/v1/get?id=703448&language=en` returns the English names. One `language=en` call cannot satisfy AC-01.

## Decision drivers

- AC-01: English name for any input alphabet.
- AC-16 / AC-17: every outbound lookup is limit-checked and reserved before it is made; only lookups actually made count.
- spec §6: at most 3 outbound calls per message (the platform cap is 50).
- No translation table or second data source to maintain (free plan, small CPU budget).

## Considered options

1. **Localized search + English re-fetch.** Pick the search language from the query's script (all Latin → `en`;
   Cyrillic → `uk`; a small table for other scripts; unknown → `en`). If the search picks a place and the language is not
   `en`, re-fetch that place by id with `language=en`.
2. **Search with `language=en` only.** One call, but any non-Latin query is "couldn't find that place" (violates AC-01).
3. **Store the localized name.** One call, but the reply and stored name are not English (violates AC-01).

## Decision outcome

**Chosen:** option 1. A Latin query is unchanged (one `language=en` search). A non-Latin query makes at most two lookups:
the localized search, then the English re-fetch, each checked against both limits and reserved first. The re-fetch runs
only when the search picked a place. Each lookup is reported to the request log, so `lookups` is 0, 1 or 2.

## Consequences

**Positive**
- AC-01 holds for Cyrillic and other scripts with no translation data in the bot.
- Latin queries keep the one-lookup cost.

**Negative**
- A non-Latin set-city costs 2 lookups against the per-user (30/h) and daily (5,000) budgets, and uses 3 outbound calls
  with the reply: the whole §6 budget. A cold start without `BOT_INFO` adds `getMe` (4); `BOT_INFO` is required in
  production (SAD §7).
- A chat at 29 lookups can spend the 30th on the search and then be refused the re-fetch as `user_limit`; nothing is saved.
- **Known limitation:** every Cyrillic query is searched as Ukrainian. A Russian, Belarusian, Bulgarian or Serbian spelling
  that differs from the Ukrainian one ("Харьков", "Београд") is likely "couldn't find that place". A `ru` fallback is open
  as spec §8 OQ-4.

**Neutral**
- `PlaceLookup` gains `find(query, language)` and `findById(id)`; candidates carry the source's place id.

## Links

- Spec: [[../spec.md]] AC-01, AC-16, AC-17, §6, §8 OQ-4
- SAD: [[../sad.md]] §4, §5, §8
- Task: [[../tasks/t16-non-latin-city-names.md]]
- Related ADR: [[0001-count-lookups-in-d1-tables]] (each lookup is reserved), [[0002-emit-one-log-event-per-update-from-middleware]] (the `lookups` field)
