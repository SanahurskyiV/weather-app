# Changelog — base-logic

## base-logic — pick a Home city and get the current weather for it

**What:** A Bot user can now tell the bot where they live and ask what it's like outside. `/city <name>`
looks up the place and stores it as their Home city. The bot always replies with the full resolved name in
English and the place's timezone, so a wrong guess shows up at once. `/weather` gives a compact Current
weather message for that city in metric units: conditions, temperature, feels-like, wind and humidity, with
the time of the reading. `/start` explains both commands. The bot works in private chats only. In a group
it answers its own commands with a pointer to a private chat. Every request ends in a plain-language
reply, even when the place isn't found or the weather source is down.

**Why:** Before this the bot could only greet. Every later step needs a stored Home city with a location and
timezone: heads-up alerts read the location and quiet hours read the timezone ([spec](../spec.md) §1, §2).
This is roadmap step 2. Key decisions:

- Lookups are counted in D1 tables. Each Bot user may make 30 lookups in any rolling 60 minutes (AC-16).
  The whole bot stops at 5,000 a day, counted in UTC (AC-17). This keeps half of Open-Meteo's free daily
  allowance for alerts → [ADR-0001](../adr/0001-count-lookups-in-d1-tables.md).
- Each update writes exactly one structured `update` log event from the outermost middleware. It records
  the outcome or failure kind, the chat, the command, the lookup count, the duration and the reading time,
  and never a secret (AC-15). Every §6 NFR and §7 KPI is counted from these events
  → [ADR-0002](../adr/0002-emit-one-log-event-per-update-from-middleware.md).
- A city name typed in a non-Latin alphabet ("Київ") is first searched in its own language, then
  re-fetched in English for the reply. A set-city like this uses two lookups instead of one
  → [ADR-0003](../adr/0003-resolve-non-latin-names-with-a-localized-search.md).

**How to use:** In a private chat with the bot:

- `/city Kyiv` (or `/city Київ`) → "Kyiv, Kyiv City, Ukraine", timezone Europe/Kyiv.
- `/city Paris` → the most populous Paris (France), plus a hint that adding a country picks another one.
- `/city Paris, US` → the most populous Paris in the United States. A country can be a two-letter code,
  an English name, or USA / UK. If the country is unknown, or has no place by that name, the reply is
  "couldn't find that place" and the Home city stays as it was.
- `/weather` → for example "3 °C, feels like -1 °C, wind 14 kilometres per hour, humidity 81%", with the
  reading time in the city's local time.

**Operational notes:**

- Migration: adds `0002_create_home_cities`, `0003_create_lookups` and `0004_create_daily_lookup_counts`.
  These are three new tables, nothing existing changes. Apply them before deploying the new Worker:
  `wrangler d1 migrations apply weather-bot-db --remote`. They are forward-only (project ADR-0003): to
  undo the schema, write a new migration that drops the tables. Never edit or revert an applied one.
- Feature flag / config: no flag. Secrets come from `wrangler secret put`: `BOT_TOKEN`, `WEBHOOK_SECRET`
  (required) and `BOT_INFO` (the `getMe` JSON). `BOT_INFO` is needed in production, because without a
  valid one the bot calls `getMe` on every cold start. A missing or invalid `BOT_INFO` logs a
  `startup_warning`. A missing `WEBHOOK_SECRET` makes the bot drop every update (fail closed). Register
  the webhook with `secret_token` as the README deploy step shows.
- Rollback: redeploy the previous Worker version (`wrangler rollback`). An older Worker never reads the
  three new tables, so they can stay. Stored Home cities survive a roll-forward.
- Before release (spec OQ-5): CI does not boot the bundled Worker yet. Start `wrangler dev` and check that
  `/health` answers before each release.

**Acceptance criteria delivered:** AC-01 – AC-17 and AC-04b. Set, replace and refine a Home city. Blank,
unknown, over-long and unavailable lookups are refused, and the Home city never changes on a failure. The
current weather is shown with rounded metric values. The bot explains "no city yet" without a lookup. It
greets, and gives help for anything it can't use. It works only in private chats, and one Bot user's city
is theirs alone. Every request writes one secret-free log event. The per-user and bot-wide lookup limits
are enforced.

**Known limitations (deferred):** No "forget me" or city removal yet (OQ-2, due with alerts). A Cyrillic
name is searched only in Ukrainian, with no Russian retry (OQ-4). CI has no Worker boot check (OQ-5).
Redelivered updates are not de-duplicated; they can be spotted by a repeated `update_id` in the log (SAD §11).
