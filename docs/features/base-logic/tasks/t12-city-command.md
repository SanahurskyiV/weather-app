---
id: T12
title: "Add the /city command and its replies"
layer: "ports"
deps: ["T7", "T10", "T11", "T16"]
blocks: ["T14"]
acs: ["AC-01", "AC-03", "AC-04", "AC-04b", "AC-05", "AC-06", "AC-07", "AC-16", "AC-17"]
files_hint: ["src/adapters/telegram/commands/city.ts", "src/adapters/telegram/bot.ts", "src/adapters/telegram/replies.ts", "src/worker.ts", "test/integration/city.test.ts"]
owner: "Vlad S"
estimate: "M"
context_budget: "M"
status: "todo"
step: ""
---
# T12 — Add the /city command and its replies

## Place in the sequence

- **Blocked by:** T7 — Implement the set-home-city use case · T10 — Implement the Open-Meteo geocoding and forecast adapters · T11 — Build the Telegram edge: request-log middleware, chat-type split, start, help and group replies · **Blocks:** T14 — Build the bot once per isolate and verify the per-message budgets end to end · **Wave:** 5 (after its dependencies).
- **Lane:** shares `src/adapters/telegram/bot.ts` with T11; shares `src/adapters/telegram/bot.ts` with T13; shares `src/worker.ts` with T14 (serialized).

## Why (user story)

> **As a** Bot user
> **I want** to set my city by sending its name with one command
> **So that** the bot knows which place to report on
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

> **As a** Bot user
> **I want** to see exactly which place the bot matched, and narrow it down by adding a country
> **So that** I end up with the right city when several places share a name
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

It is the Bot user's way in to setting a Home city: one command and one plain-language reply for every outcome.

## Inlined context

> Committed approach (owner-accepted direction, `idea-brief.md` §7, sharpened in the 2026-11-05 deep-dive): a Bot user sets their Home city with one command that carries the city name. The bot takes the best match (the most populous populated place among the candidates; regions and countries are never chosen, see AC-06), stores it, and replies with the full resolved name and timezone, so a wrong guess is visible at once and can be fixed by adding a country.
>
> — `spec.md §1, committed approach, abridged` · full text: [spec.md](../spec.md)

> | Error handling | Use cases return `Result`. `SetCityError` failures `not_found` and `unavailable` carry the current Home city (or none) so the reply can say "your city is still …" (AC-05). `SetCityError` is `blank`, `too_long`, `unknown_country`, `not_found`, `unavailable`, `user_limit` or `daily_limit`; `WeatherError` is `no_home_city`, `unavailable`, `user_limit` or `daily_limit`. `replies.ts` maps each to plain-language text. Unexpected throws become the "something went wrong" reply plus `outcome: fault`, and the webhook still answers 200. | CLAUDE.md; here |
>
> — `sad.md §8, Error handling, verbatim` · full text: [sad.md](../sad.md)

> | Text safety | Replies are plain text (no `parse_mode`). Echoed names come from the geocoder's resolved place, not from the raw query. | spec §6.1 |
>
> — `sad.md §8, Text safety, verbatim` · full text: [sad.md](../sad.md)

> | Logging | … `outcome` (`ok` or a failure kind …), `lookups` (0 or 1) … | ADR-0002; here |
>
> — `sad.md §8, Logging, abridged` · full text: [sad.md](../sad.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. Reads and writes go through `setHomeCity` (T7) and the D1 adapters (T9).

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

### AC-01 — happy

> **Given** a Bot user in a private chat who has no Home city yet
> **When** the Bot user sends the set-city command with the name "Kyiv"
> **Then** the system stores the best match as their Home city and replies with its full resolved name (city, region, country) and its timezone, plus how to ask for the weather. The resolved name is always shown in English, whatever alphabet the Bot user typed ("Київ" → "Kyiv, Kyiv City, Ukraine"). When the place has no region, that part is left out.
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — error (missing name)

> **Given** a Bot user in a private chat
> **When** the Bot user sends the set-city command with no name, or only spaces
> **Then** nothing changes and the system replies with how to use the command, with an example
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — error (no such place)

> **Given** a Bot user in a private chat
> **When** the Bot user sets a name that matches no populated place (for example "Xyzzyqq"), or a name longer than 100 characters (counted as visible characters, in any alphabet)
> **Then** nothing is stored and the system replies that it couldn't find that place and suggests checking the spelling or adding a country. A name in any alphabet is looked up as typed. A name longer than 100 characters is refused without any lookup and does not count toward the limits in AC-16 and AC-17.
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-04b — error (place lookup unavailable)

> **Given** a Bot user in a private chat, and the place lookup is down or does not answer within 1.5 seconds
> **When** the Bot user sets a city
> **Then** nothing is stored and the system replies that this is temporarily unavailable and to try again in a few minutes, using the AC-10 wording, not the "couldn't find that place" reply. "Couldn't find that place" is used only when the lookup answered and found no match.
>
> — `spec.md §5, AC-04b, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — domain invariant

> **Given** a Bot user whose Home city is Kyiv
> **When** setting a new city fails, because no place matches or because the place lookup is unavailable
> **Then** Kyiv stays their Home city, and the reply says so ("your city is still Kyiv"). Invariant: *a Home city only ever changes to a place that was successfully found.*
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — happy (ambiguous name)

> **Given** a Bot user, and the name "Paris" matches several populated places
> **When** the Bot user sets the city "Paris"
> **Then** the system stores the most populous populated place named Paris (never a region or a country), and replies with its full name and timezone plus a hint that adding a country picks another one, for example "Paris, US"
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — happy (refine with a country)

> **Given** a Bot user whose Home city is Paris, France
> **When** the Bot user sets the city "Paris, US"
> **Then** the system stores the most populous Paris in the United States and replies with its full name and timezone. Only text after a comma is read as a country. If the country is not recognised ("Paris, XX"), or has no place of that name ("Paris, Japan"), or the text after the comma is not a country ("Paris, Texas"), the system gives the "couldn't find that place" reply (AC-04) and the Home city does not change. It never quietly falls back to a match in another country.
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-16 — error (too many requests)

> **Given** a Bot user for whom the bot has already made 30 place or weather lookups within the past 60 minutes (a rolling window)
> **When** the Bot user sets a city or asks for the weather again
> **Then** no lookup is made, their Home city is unchanged, and the system replies that they are sending too many requests and to try again later. Only lookups actually made count, whether or not a place was found. Requests blocked by this cap or by AC-17, blank names (AC-03), names that are too long (AC-04) and weather requests with no Home city (AC-09) do not count, so retrying while blocked never extends the block.
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — error (bot-wide daily budget used up)

> **Given** the bot has already made 5,000 place or weather lookups for Bot user requests during the current day (counted in UTC)
> **When** any Bot user sets a city or asks for the weather
> **Then** no lookup is made, their Home city is unchanged, and the system replies that the bot has reached its daily limit and to try again tomorrow. This keeps the rest of the weather source's free daily allowance for alerts. Every place and weather lookup the bot makes counts, including ones that fail or time out, because both kinds draw on the same daily allowance. Requests that arrive at the same moment may push the count past 5,000 by a few lookups. When a Bot user hits both this budget and their own limit (AC-16), they get this "daily limit" reply.
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `commands/city.ts`: `bot.command("city", …)` in the private composer. It calls `setHomeCity(ctx.chat.id, ctx.match)` and maps the result to a reply from `replies.ts`.
- [ ] It sets `ctx.event.command = "city"` and `outcome` (`ok` or the error kind), and `lookups = 1` exactly when the outcome is `ok`, `not_found` or `unavailable`.
- [ ] `replies.ts`:
  - success: `formatPlaceName(place)` + timezone + how to ask for the weather, plus the "add a country, for example \"Paris, US\"" hint when `ambiguous`
  - usage with an example (`blank`)
  - "couldn't find that place, check the spelling or add a country" (`too_long`, `unknown_country`, `not_found`), plus "your city is still X" when `current` is set
  - "temporarily unavailable, try again in a few minutes" (AC-10 wording), plus "still X"
  - "too many requests" (`user_limit`) and "daily limit, try again tomorrow" (`daily_limit`)
- [ ] `bot.ts` registers the command. `src/worker.ts` builds `setHomeCity` from the D1 repo and counter, the geocoding adapter and `systemClock`.
- [ ] Add `test/integration/city.test.ts`, using the T10 fixtures and the T9 seed helpers.

## Edge cases

| Case | Behaviour |
|---|---|
| `/city Київ` | "Kyiv, Kyiv City, Ukraine" + `Europe/Kyiv` (AC-01) |
| `/city` / `/city    ` | The usage reply, nothing stored, `lookups: 0` (AC-03) |
| `/city <101 chars>` | "couldn't find", no fetch, `lookups: 0` (AC-04) |
| Home city Kyiv, `/city Xyzzyqq` | "couldn't find … your city is still Kyiv", `lookups: 1` (AC-05) |
| Geocoding hangs > 1.5 s | "temporarily unavailable … still Kyiv", not "couldn't find" (AC-04b) |
| Name with `<b>` or control characters | Plain text. Only the geocoder's resolved name is echoed back (spec §6.1). |
| 30 lookups seeded in the last hour | "too many requests", no fetch, `lookups: 0` (AC-16) |
| Day count 5,000 and 30 per chat | "daily limit" (AC-17) |

## Definition of Done

- [ ] `city.test.ts` covers every listed AC and edge row and passes
- [ ] Each scenario makes ≤ 1 Open-Meteo call + 1 `sendMessage`
- [ ] lint + typecheck clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
