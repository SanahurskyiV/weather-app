---
id: T5
title: "Describe and round the current weather reading"
layer: "domain"
deps: []
blocks: ["T6", "T8"]
acs: ["AC-08"]
files_hint: ["src/domain/weather.ts", "src/domain/weather.test.ts"]
owner: "Vlad S"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---
# T5 — Describe and round the current weather reading

## Place in the sequence

- **Blocked by:** nothing · **Blocks:** T6 — Declare the four new ports and the get-home-city use case · T8 — Implement the get-current-weather use case · **Wave:** 1 (starts immediately).
- **Lane:** own lane.

## Why (user story)

> **As a** Bot user
> **I want** to ask for the Current weather in my Home city
> **So that** I know what it's like outside without opening another app
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It turns a raw reading into the words, whole numbers and local time the weather reply shows.

## Inlined context

> │   └── weather.ts          CurrentWeather type; WMO code → words ("unknown conditions" fallback); whole-number rounding
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> | Units | Metric: °C and km/h from the source, humidity in %. Values rounded to whole numbers in `domain/weather.ts`. | spec AC-08 |
>
> — `sad.md §8, Units, verbatim` · full text: [sad.md](../sad.md)

> | Time | `Clock` port only. Counters use UTC (day key `YYYY-MM-DD`, window `now − 60 min`). The reading time is shown in the Home city's IANA timezone via `Intl.DateTimeFormat`. | CLAUDE.md |
>
> — `sad.md §8, Time, verbatim` · full text: [sad.md](../sad.md)

> - `src/domain/`: pure logic (alert rules, quiet hours, time). No I/O, no `grammy`, no `cloudflare:*`.
> - `src/app/`: use cases plus the port interfaces they need (`src/app/ports.ts`). Imports only `domain`.
>
> — `CLAUDE.md §Layers, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

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

## Checklist

- [ ] `CurrentWeather { readingTime: Date; weatherCode: number; temperatureC; feelsLikeC; windKmh; humidityPct }`.
- [ ] `describeConditions(code)`: the WMO weather-interpretation table (0 clear sky, 1–3 mainly clear / partly cloudy / overcast, 45/48 fog, 51–57 drizzle, 61–67 rain, 71–77 snow, 80–82 rain showers, 85–86 snow showers, 95–99 thunderstorm). Anything else gives `"unknown conditions"`.
- [ ] `roundReading(w)`: `Math.round` on all four numbers, normalising `-0` to `0`.
- [ ] `formatLocalTime(date, timezone)`: `Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" })`.
- [ ] Write `weather.test.ts` from the edge table.

## Edge cases

| Case | Behaviour |
|---|---|
| code 3 | `"overcast"` |
| code 100 / -1 | `"unknown conditions"` (AC-08) |
| temperature 2.5 / -0.4 / -1.5 | 3 / 0 (not "-0") / -1 |
| reading `2026-11-06T22:30Z`, `Europe/Kyiv` | `"00:30"`, local time, not UTC |

## Definition of Done

- [ ] `weather.test.ts` covers every edge row and passes
- [ ] domain-only imports; lint + typecheck clean
- [ ] every Hard Rule inlined above still holds
- [ ] lint + typecheck clean (`npm run lint`, `npm run typecheck`) and `npm test` green
