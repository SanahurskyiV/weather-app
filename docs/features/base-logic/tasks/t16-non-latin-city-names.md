---
id: T16
title: "Resolve non-Latin set-city queries with a localized search and an English re-fetch"
layer: "app"
deps: ["T7", "T10"]
blocks: ["T12"]
acs: ["AC-01", "AC-16", "AC-17"]
files_hint: ["src/domain/city-query.ts", "src/domain/city-query.test.ts", "src/domain/place.ts", "src/domain/place.test.ts", "src/app/ports.ts", "src/app/set-home-city.ts", "src/app/set-home-city.test.ts", "src/adapters/open-meteo/geocoding.ts", "src/adapters/open-meteo/geocoding.test.ts", "test/fixtures/open-meteo-geocoding-kyiv-uk.json", "test/fixtures/open-meteo-get-kyiv.json"]
owner: "Vlad S"
estimate: "S"
context_budget: "M"
status: "done"
step: "COMMIT"
---
# T16 — Resolve non-Latin set-city queries with a localized search and an English re-fetch

## Place in the sequence

- **Blocked by:** T7, T10 · **Blocks:** T12 — Add the /city command and its replies.
- **Lane:** compile-coupled. The `PlaceLookup` port change and its implementer (`geocoding.ts`) and caller (`set-home-city.ts`) land in one commit.
- **Origin:** split out by `implement` on 2026-11-06 (escalation ladder, step 3) after a live check of the weather source.

## Why

AC-01 says the resolved name is always shown in English, whatever alphabet the Bot user typed ("Київ" → "Kyiv, Kyiv City, Ukraine"). Checked live on 2026-11-06: Open-Meteo geocoding matches only names in the requested `language`. `name=Київ&language=en` returns no results, while `language=uk` finds Kyiv (id 703448) with Ukrainian names, and `/v1/get?id=703448&language=en` returns "Kyiv, Kyiv City, Ukraine". A single `language=en` call (SAD §5) therefore cannot satisfy AC-01.

**Owner decision (2026-11-06, during `implement`):** a non-Latin query makes two calls: a search in the query's script language, then a re-fetch of the picked place by id in English. Each call is a lookup, limit-checked and reserved before it is made (AC-16, AC-17 "only lookups actually made count"), so a message makes at most 2 lookups plus 1 reply, which stays within spec §6 "≤ 3 outbound calls". A Latin query is unchanged: one `language=en` search.

## Checklist

- [ ] `domain/city-query.ts`: `searchLanguage(name)` gives `"en"` when every letter is Latin script; otherwise the language of the first non-Latin script (Cyrillic → `uk`, plus a small table for other scripts); an unknown script gives `"en"`.
- [ ] `domain/place.ts`: `PlaceCandidate` gains `id` (the source's place id); `pickBestMatch` returns it as `placeId`.
- [ ] `app/ports.ts`: `PlaceLookup.find(query, language)` and `PlaceLookup.findById(id): Result<Place, "unavailable">` (English names).
- [ ] `adapters/open-meteo/geocoding.ts`: `find` sends the given `language`; `findById` calls `/v1/get?id=&language=en`. Any failure, including an unknown id, is `unavailable`.
- [ ] `app/set-home-city.ts`: before each call, check the limits and reserve; the second call happens only when the localized search picked a place. It reports each lookup to an optional `onLookup` callback, so the request log can record `lookups` (0, 1 or 2).
- [ ] Record `open-meteo-geocoding-kyiv-uk.json` and `open-meteo-get-kyiv.json` from the live API.

## Edge cases

| Case | Behaviour |
|---|---|
| "Kyiv" | One `language=en` search, `lookups = 1` |
| "Київ" | `language=uk` search, then `findById(703448)`; stores "Kyiv, Kyiv City, Ukraine", `lookups = 2` |
| "Київ" and the localized search finds no populated place | `not_found`, no re-fetch, `lookups = 1` |
| "Київ" and the re-fetch fails or times out | `unavailable` with the current Home city; both calls counted, nothing saved |
| "Київ" with the chat at 29 lookups | the search runs (30th); the re-fetch is refused as `user_limit`, nothing saved |
| Mixed "Kyiv Київ" | treated as non-Latin |

## Definition of Done

- [ ] Unit tests for `searchLanguage`, `pickBestMatch().placeId` and every edge row above in `set-home-city.test.ts`
- [ ] Contract tests for `find` with a language and for `findById` (mapping and failures)
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
