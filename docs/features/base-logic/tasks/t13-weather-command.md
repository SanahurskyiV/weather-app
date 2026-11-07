---
id: T13
title: "Add the /weather command and its replies"
layer: "ports"
deps: ["T8", "T10", "T11"]
blocks: ["T14"]
acs: ["AC-08", "AC-09", "AC-10", "AC-16", "AC-17"]
files_hint: ["src/adapters/telegram/commands/weather.ts", "src/adapters/telegram/bot.ts", "src/adapters/telegram/replies.ts", "src/worker.ts", "test/integration/weather.test.ts"]
owner: "Vlad S"
estimate: "M"
context_budget: "M"
status: "done"
step: "COMMIT"
---
# T13 — Add the /weather command and its replies

## Place in the sequence

- **Blocked by:** T8 — Implement the get-current-weather use case · T10 — Implement the Open-Meteo geocoding and forecast adapters · T11 — Build the Telegram edge: request-log middleware, chat-type split, start, help and group replies · **Blocks:** T14 — Build the bot once per isolate and verify the per-message budgets end to end · **Wave:** 5 (after its dependencies).
- **Lane:** shares `src/adapters/telegram/bot.ts` with T11; shares `src/adapters/telegram/bot.ts` with T12; shares `src/worker.ts` with T14 (serialized).

## Why (user story)

> **As a** Bot user
> **I want** to ask for the Current weather in my Home city
> **So that** I know what it's like outside without opening another app
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It answers "what's it like outside" in one compact message, or says plainly why it can't.

## Inlined context

> | Error handling | Use cases return `Result`. `SetCityError` failures `not_found` and `unavailable` carry the current Home city (or none) so the reply can say "your city is still …" (AC-05). `SetCityError` is `blank`, `too_long`, `unknown_country`, `not_found`, `unavailable`, `user_limit` or `daily_limit`; `WeatherError` is `no_home_city`, `unavailable`, `user_limit` or `daily_limit`. `replies.ts` maps each to plain-language text. Unexpected throws become the "something went wrong" reply plus `outcome: fault`, and the webhook still answers 200. | CLAUDE.md; here |
>
> — `sad.md §8, Error handling, verbatim` · full text: [sad.md](../sad.md)

> | Text safety | Replies are plain text (no `parse_mode`). Echoed names come from the geocoder's resolved place, not from the raw query. | spec §6.1 |
>
> — `sad.md §8, Text safety, verbatim` · full text: [sad.md](../sad.md)

> | Logging | … `lookups` (0 or 1), `duration_ms`, `reading_time` (weather only), `replied` (bool). … | ADR-0002; here |
>
> — `sad.md §8, Logging, abridged` · full text: [sad.md](../sad.md)

> | Freshness of the reading shown | ≤ 30 min old, p95. A monitored target only: an older reading is still shown, with its reading time (AC-08). | per-request log event: reply time minus reading time |
>
> — `spec.md §6, freshness, verbatim` · full text: [spec.md](../spec.md)

**Fallback:** if a slice is insufficient or contradicted by the code, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (Telegram commands are the user surface; there is no `contracts/openapi.yaml` for this feature, since `api` was skipped on the quick route.)

## Acceptance criteria

### AC-08 — happy

> **Given** a Bot user whose Home city is Kyiv
> **When** the Bot user asks for the weather
> **Then** the system replies with: the Home city's name; the time of the reading in Kyiv local time; the conditions in words ("unknown conditions" when the source reports a condition the bot does not recognise); the temperature in °C; the feels-like temperature in °C; the wind speed in kilometres per hour; and the humidity in percent. All four numbers are rounded to the nearest whole number (for example "3 °C, feels like -1 °C, wind 14 kilometres per hour, humidity 81%").
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — cross-context

> **Given** a Bot user who has no Home city
> **When** the Bot user asks for the weather
> **Then** the system replies that no city is set yet and how to set one, with an example, and makes no weather lookup
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — error (source unavailable)

> **Given** a Bot user whose Home city is Kyiv, and the weather source is down or does not answer within 1.5 seconds
> **When** the Bot user asks for the weather
> **Then** the system replies that the weather is temporarily unavailable and to try again in a few minutes. The wording is different from the "couldn't find that place" reply.
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

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

- [ ] `commands/weather.ts`: `bot.command("weather", …)` in the private composer. It calls `getCurrentWeather(ctx.chat.id)`.
- [ ] It sets `command = "weather"`, `outcome`, `lookups = 1` exactly when the outcome is `ok` or `unavailable`, and `reading_time = weather.readingTime.toISOString()` on ok.
- [ ] `replies.ts`: the weather message (city name; `formatLocalTime(readingTime, timezone)`; `describeConditions`; rounded °C, feels-like °C, wind in "kilometres per hour", humidity %); "no city set yet" with a `/city Kyiv` example; "temporarily unavailable" (the same wording as T12); and reuse of the limit replies from T12.
- [ ] `bot.ts` registers the command. `src/worker.ts` builds `getCurrentWeather` with the forecast adapter.
- [ ] Add `test/integration/weather.test.ts` with the Kyiv forecast fixture.

## Edge cases

| Case | Behaviour |
|---|---|
| Home city Kyiv, fixture 2.6 °C / feels -1.4 / wind 13.7 / humidity 80.6 | "3 °C, feels like -1 °C, wind 14 kilometres per hour, humidity 81%" (AC-08) |
| Unknown weather code | "unknown conditions" (AC-08) |
| Reading 3 h old | Still shown, with its local reading time (spec §6 freshness) |
| No Home city | The "no city set" reply, no fetch, `lookups: 0` (AC-09) |
| Forecast 503 / hangs > 1.5 s | "temporarily unavailable", `lookups: 1` (AC-10, AC-17) |

## Definition of Done

- [ ] `weather.test.ts` covers every listed AC and edge row and passes
- [ ] Each scenario makes ≤ 1 Open-Meteo call + 1 `sendMessage`
- [ ] lint + typecheck clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
