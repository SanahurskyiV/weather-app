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
| T7 | [Implement the set-home-city use case](./t07-set-home-city-use-case.md) | app | Vlad S | M | T2, T3, T4, T6 | todo | — |
| T8 | [Implement the get-current-weather use case](./t08-get-current-weather-use-case.md) | app | Vlad S | S | T4, T5, T6 | todo | — |
| T9 | [Implement the D1 HomeCityRepo and UsageCounter adapters](./t09-d1-adapters.md) | infra | Vlad S | M | T1, T6 | todo | — |
| T10 | [Implement the Open-Meteo geocoding and forecast adapters](./t10-open-meteo-adapters.md) | infra | Vlad S | M | T6 | todo | — |
| T11 | [Build the Telegram edge: request-log middleware, chat-type split, start, help and group replies](./t11-telegram-edge.md) | ports | Vlad S | M | T6, T9 | todo | — |
| T12 | [Add the /city command and its replies](./t12-city-command.md) | ports | Vlad S | M | T7, T10, T11 | todo | — |
| T13 | [Add the /weather command and its replies](./t13-weather-command.md) | ports | Vlad S | M | T8, T10, T11 | todo | — |
| T14 | [Build the bot once per isolate and verify the per-message budgets end to end](./t14-composition-root.md) | wiring | Vlad S | M | T12, T13 | todo | — |
| T15 | [Update the README for the new commands and the BOT_INFO deploy step](./t15-readme.md) | docs | Vlad S | S | — | todo | — |

**Total:** 15 tasks, ~11.5 person-days (S ≈ ½ day, M ≈ 1 day).
