# Tracker — base-logic

> Status of every task in the epic. `implement` updates **Status** and **Step** after every
> subagent it runs (and commits them with the task), so this table shows where the run is right now.
> Status: `todo` · `in_progress` · `blocked` · `review` · `done`.
> Step: `SELECT` · `RED` · `GREEN` · `REFACTOR` · `GATE` · `REVIEW` · `COMMIT` (`—` before the task starts).
> A `blocked` row carries its reason in Step, e.g. `GATE — lint red after 3 retries`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status | Step |
|---|---|---|---|---|---|---|---|
| T1 | [Promote the three staged base-logic migrations](./t01-promote-migrations.md) | migration | Vlad S | S | — | done | COMMIT |
| T2 | [Parse the city query and recognise countries](./t02-parse-city-query.md) | domain | Vlad S | M | — | done | COMMIT |
| T3 | [Pick the best-matching populated place and format its name](./t03-pick-best-place.md) | domain | Vlad S | S | — | done | COMMIT |
| T4 | [Encode the lookup limits and UTC counting keys](./t04-usage-limits.md) | domain | Vlad S | S | — | done | COMMIT |
| T5 | [Describe and round the current weather reading](./t05-describe-weather.md) | domain | Vlad S | S | — | done | COMMIT |
| T6 | [Declare the four new ports and the get-home-city use case](./t06-ports-and-get-home-city.md) | app | Vlad S | S | T3, T5 | done | COMMIT |
| T7 | [Implement the set-home-city use case](./t07-set-home-city-use-case.md) | app | Vlad S | M | T2, T3, T4, T6 | done | COMMIT |
| T8 | [Implement the get-current-weather use case](./t08-get-current-weather-use-case.md) | app | Vlad S | S | T4, T5, T6 | done | COMMIT |
| T9 | [Implement the D1 HomeCityRepo and UsageCounter adapters](./t09-d1-adapters.md) | infra | Vlad S | M | T1, T6 | done | COMMIT |
| T10 | [Implement the Open-Meteo geocoding and forecast adapters](./t10-open-meteo-adapters.md) | infra | Vlad S | M | T6 | done | COMMIT |
| T11 | [Build the Telegram edge: request-log middleware, chat-type split, start, help and group replies](./t11-telegram-edge.md) | ports | Vlad S | M | T6, T9 | done | COMMIT |
| T12 | [Add the /city command and its replies](./t12-city-command.md) | ports | Vlad S | M | T7, T10, T11, T16 | done | COMMIT |
| T13 | [Add the /weather command and its replies](./t13-weather-command.md) | ports | Vlad S | M | T8, T10, T11 | done | COMMIT |
| T14 | [Build the bot once per isolate and verify the per-message budgets end to end](./t14-composition-root.md) | wiring | Vlad S | M | T12, T13 | done | COMMIT |
| T15 | [Update the README for the new commands and the BOT_INFO deploy step](./t15-readme.md) | docs | Vlad S | S | — | done | COMMIT |
| T16 | [Resolve non-Latin set-city queries with a localized search and an English re-fetch](./t16-non-latin-city-names.md) | app | Vlad S | S | T7, T10 | done | COMMIT |
| T17 | [Record the two-lookup non-Latin set-city decision in ADR-0003 and the design docs](./t17-adr-non-latin-lookups.md) | docs | Vlad S | S | T16 | done | COMMIT |
| T18 | [Pin the 1.5 s cutoff and tolerate malformed geocoder entries and unknown timezones](./t18-harden-open-meteo-adapters.md) | infra | Vlad S | S | T10, T16 | done | COMMIT |
| T19 | [Name the current Home city on every "couldn't find that place" reply](./t19-still-city-on-every-not-found.md) | app | Vlad S | S | T7, T12 | done | COMMIT |
| T20 | [Drop forged updates silently and fail closed without a webhook secret](./t20-webhook-secret-fail-closed.md) | wiring | Vlad S | S | T14 | done | COMMIT |
| T21 | [Keep the real outcome when the reply fails, name the fault, and prove no secret is logged](./t21-request-log-reply-failures.md) | ports | Vlad S | M | T11 | done | COMMIT |
| T22 | [Let the get-current-weather use case report its lookups](./t22-weather-lookup-callback.md) | app | Vlad S | S | T8, T13 | done | COMMIT |
| T23 | [Use the real command in the help reply and assert nothing is stored where the plan says so](./t23-help-wording-and-storage-asserts.md) | ports | Vlad S | S | T11, T12 | todo | — |

**Total:** 23 tasks (T17–T23 are review follow-ups), ~16 person-days (S ≈ ½ day, M ≈ 1 day).
