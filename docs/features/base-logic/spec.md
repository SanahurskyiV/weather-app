---
status: Draft
owner: "Vlad S"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-11-05"
feature_size: "S"
---

# Spec — base-logic

<!-- instruction: one-line links to inputs used.
> **Glossary:** [CONTEXT](./CONTEXT.md) (if present)
> **Reference module / docs / channels used:** name the specific paths/queries read in step 5, or «None — only the interview + CONTEXT».
Do not mention competitive-research or ideation scratch work here — those inform §1, they are not inputs to cite. -->

> **Glossary:** [CONTEXT](../../../CONTEXT.md) (repo-root; no feature-level CONTEXT.md)
> **Reference module / docs / channels used:** `docs/idea-brief.md` §3, §5, §6, §7 · `docs/roadmap.md` step 2 · `docs/architecture-map.md` §Constraints & known tech-debt · `CLAUDE.md` §Free-plan limits.

## 1. Context

A Bot user (in practice the owner and a few acquaintances, an assumption per `idea-brief.md` §3) opens the bot and wants to see the weather for their own city right away. Today the bot only greets. Nothing lets a person say where they are or ask what it's like outside. Choosing a city is also the first thing every later feature needs: heads-up alerts read the city's location, and quiet hours read its timezone.

Why now: the project skeleton (roadmap step 1) exists, and this is roadmap step 2, the first real feature. Steps 3 (alerts) and 4 (quiet hours) can't start until a Bot user has a Home city with a location and timezone stored. There is no external deadline (`idea-brief.md` §4).

Committed approach (owner-accepted direction, `idea-brief.md` §7, sharpened in the 2026-11-05 deep-dive): a Bot user sets their Home city with one command that carries the city name. The bot takes the best match (the most populous populated place among the candidates; regions and countries are never chosen, see AC-06), stores it, and replies with the full resolved name and timezone, so a wrong guess is visible at once and can be fixed by adding a country. A second command returns a compact Current weather message for the Home city. The commands are `/city <name>` (called "the set-city command" in §5), `/weather` ("ask for the weather") and `/start` (the greeting). The greeting and help replies use these exact names. The bot works only in private chats, in English, with metric units. Every message is handled on its own, with no back-and-forth conversation to remember. This fits the brief's success criterion, "anyone can use the live bot within seconds" (`idea-brief.md` §2). The independent failure-mode review flagged one sharpest risk: a single chat could use up the shared daily weather-source budget, which step 3's alerts also depend on. That risk is answered by a per-Bot-user request cap (AC-16) plus a hard bot-wide daily budget (AC-17). Competitive research was not re-run, because the brief's accepted direction already settles the approach and this step adds no product bet.

Traceability:
- Owner constraints carried from `idea-brief.md` §5: free hosting only, Telegram only, no i18n. The free-plan limits in `CLAUDE.md` (CPU per request, outbound calls per invocation, daily weather-source quota) bound how much work one message may do.
- Weather-source terms (non-commercial, daily call cap) are source-indicated in `idea-brief.md` §6 and were confirmed on the official terms page per `docs/roadmap.md` §Decisions so far.

## 2. Goals

- A first-time Bot user gets from opening the bot to seeing Current weather for their own city in a couple of messages, without reading docs.
- Every stored Home city is unambiguous (full resolved name, location and timezone), so alerts and quiet hours can build on it without asking the Bot user again.
- Every Bot user request ends in a plain-language reply, including when the city is unknown or the weather source is down. The bot is never silent.

## 3. Non-goals

- **More than one city per Bot user.** It widens the data model and every later feature; excluded for v1 (`idea-brief.md` §5).
- **Choosing a location with a Telegram location pin.** A city name is enough for v1 (`idea-brief.md` §5).
- **Picking among several matches with buttons.** The owner chose best-match plus "add a country to refine" (2026-11-05). It is one message with nothing to remember between messages.
- **Group chats and channels.** The bot serves people one to one, so each Home city belongs to exactly one person (owner decision, 2026-11-05). In a group it only points people to a private chat.
- **Removing a Home city on request ("forget me").** Unsubscribing and data removal belong with alerts (roadmap step 3), where the Bot user first gets something to stop. Tracked in §8 (owner decision, 2026-11-05).
- **Forecasts, a daily digest, unit switching or other languages.** This step shows current conditions only, in metric and English (`idea-brief.md` §5: alerts only, no i18n).

## 4. User stories

<!-- instruction: ≥5 user stories, no upper cap. Enough to cover every role in the CONTEXT glossary + every goal in §2. Format:

### US-NN: <3–6 word action title>
**As a** <role from CONTEXT glossary>
**I want** <action>
**So that** <observable benefit>

Roles ONLY from the glossary (no invented `user`/`admin`). Each US is covered by ≥1 AC in §5. -->

### US-01: Set my Home city

**As a** Bot user
**I want** to set my city by sending its name with one command
**So that** the bot knows which place to report on

### US-02: See the weather now

**As a** Bot user
**I want** to ask for the Current weather in my Home city
**So that** I know what it's like outside without opening another app

### US-03: Correct a wrong match

**As a** Bot user
**I want** to see exactly which place the bot matched, and narrow it down by adding a country
**So that** I end up with the right city when several places share a name

### US-04: Find my way in

**As a** Bot user opening the bot for the first time, or sending something it doesn't understand
**I want** a short reply that tells me what to type
**So that** I can try the bot in seconds without reading docs

### US-05: Told where the bot works

**As a** Bot user who adds the bot to a group
**I want** a clear pointer to a private chat
**So that** I know where the bot works, and nobody in the group can change anyone's Home city

### US-06: Diagnose a failed request

**As an** Operator
**I want** every failed Bot user request recorded as one structured log event (failure kind and chat, no secrets)
**So that** I can see why someone got an error reply

## 5. Acceptance criteria

<!-- instruction: ≥1 AC of EACH of the 5 coverage types, no upper cap. Format:

### AC-NN (US-XX) — <coverage type>
**Given** <business preconditions: actor role, state of their domain objects, prior events>
**When** <business action from the actor's perspective>
**Then** <observable business outcome: actor sees X / system blocks Y and explains Z / system records W>

AC = business-observable outcome from the actor's perspective. NOT how the system does it.

FORBIDDEN in AC text (zero tolerance — critic F6 + pre-write regex):
- HTTP verbs (GET/POST/PUT/PATCH/DELETE)
- URL paths (/things, /things/{id}, /api/v1/...)
- status-code numerics in the body (200/201/400/401/403/404/409/5xx)
- error-code strings matching `[a-z_]+\.[a-z_]+` (e.g. order.not_owner)
- JSON fragments / payload bodies ({field: "value"})
- SQL / DB constructs (UNIQUE, FK, raw INSERT/SELECT/UPDATE, constraint names)
The technical mapping for these lives in `api` + `decide-adr`. Here: only what the actor observes.

Allowed: glossary roles, domain-invariant NAMES as natural-language phrases («no published lessons», «unique sequence per course»), glossary domain objects.

The 5 mandatory coverage types (≥1 each):
1. happy — actor does the main flow → system records the outcome and confirms.
2. error — actor submits invalid input → system blocks it and explains the reason in plain language.
3. authorization — actor lacks permission → system denies access OR hides existence (rationale in business terms).
4. domain invariant — actor violates a named invariant → system blocks and names the invariant plainly.
5. cross-context — actor's action depends on state in another bounded context → system enforces the cross-context rule.

Tag each AC with its US-NN. Concurrent edge → add as AC-NNb, still in business language. -->

### AC-01 (US-01) — happy

**Given** a Bot user in a private chat who has no Home city yet
**When** the Bot user sends the set-city command with the name "Kyiv"
**Then** the system stores the best match as their Home city and replies with its full resolved name (city, region, country) and its timezone, plus how to ask for the weather. The resolved name is always shown in English, whatever alphabet the Bot user typed ("Київ" → "Kyiv, Kyiv City, Ukraine"). When the place has no region, that part is left out.

### AC-02 (US-01) — happy (replace)

**Given** a Bot user whose Home city is Kyiv
**When** the Bot user sets the city "Lviv"
**Then** Lviv replaces Kyiv as their only Home city, the reply names Lviv, and the next weather request reports Lviv

### AC-03 (US-01) — error (missing name)

**Given** a Bot user in a private chat
**When** the Bot user sends the set-city command with no name, or only spaces
**Then** nothing changes and the system replies with how to use the command, with an example

### AC-04 (US-01) — error (no such place)

**Given** a Bot user in a private chat
**When** the Bot user sets a name that matches no populated place (for example "Xyzzyqq"), or a name longer than 100 characters (counted as visible characters, in any alphabet)
**Then** nothing is stored and the system replies that it couldn't find that place and suggests checking the spelling or adding a country. A name in any alphabet is looked up as typed. A name longer than 100 characters is refused without any lookup and does not count toward the limits in AC-16 and AC-17.

### AC-04b (US-01) — error (place lookup unavailable)

**Given** a Bot user in a private chat, and the place lookup is down or does not answer within 1.5 seconds
**When** the Bot user sets a city
**Then** nothing is stored and the system replies that this is temporarily unavailable and to try again in a few minutes, using the AC-10 wording, not the "couldn't find that place" reply. "Couldn't find that place" is used only when the lookup answered and found no match.

### AC-05 (US-01) — domain invariant

**Given** a Bot user whose Home city is Kyiv
**When** setting a new city fails, because no place matches or because the place lookup is unavailable
**Then** Kyiv stays their Home city, and the reply says so ("your city is still Kyiv"). Invariant: *a Home city only ever changes to a place that was successfully found.*

### AC-06 (US-03) — happy (ambiguous name)

**Given** a Bot user, and the name "Paris" matches several populated places
**When** the Bot user sets the city "Paris"
**Then** the system stores the most populous populated place named Paris (never a region or a country), and replies with its full name and timezone plus a hint that adding a country picks another one, for example "Paris, US"

### AC-07 (US-03) — happy (refine with a country)

**Given** a Bot user whose Home city is Paris, France
**When** the Bot user sets the city "Paris, US"
**Then** the system stores the most populous Paris in the United States and replies with its full name and timezone. Only text after a comma is read as a country. If the country is not recognised ("Paris, XX"), or has no place of that name ("Paris, Japan"), or the text after the comma is not a country ("Paris, Texas"), the system gives the "couldn't find that place" reply (AC-04) and the Home city does not change. It never quietly falls back to a match in another country.

### AC-08 (US-02) — happy

**Given** a Bot user whose Home city is Kyiv
**When** the Bot user asks for the weather
**Then** the system replies with: the Home city's name; the time of the reading in Kyiv local time; the conditions in words ("unknown conditions" when the source reports a condition the bot does not recognise); the temperature in °C; the feels-like temperature in °C; the wind speed in kilometres per hour; and the humidity in percent. All four numbers are rounded to the nearest whole number (for example "3 °C, feels like -1 °C, wind 14 kilometres per hour, humidity 81%").

### AC-09 (US-02) — cross-context

**Given** a Bot user who has no Home city
**When** the Bot user asks for the weather
**Then** the system replies that no city is set yet and how to set one, with an example, and makes no weather lookup

### AC-10 (US-02) — error (source unavailable)

**Given** a Bot user whose Home city is Kyiv, and the weather source is down or does not answer within 1.5 seconds
**When** the Bot user asks for the weather
**Then** the system replies that the weather is temporarily unavailable and to try again in a few minutes. The wording is different from the "couldn't find that place" reply.

### AC-11 (US-04) — happy

**Given** a Bot user, new or returning
**When** the Bot user starts the bot
**Then** the greeting explains in a few lines how to set a city and how to ask for the weather, each with an example; a returning Bot user who has a Home city also sees it named

### AC-12 (US-04) — error (not understood)

**Given** a Bot user in a private chat
**When** the Bot user sends plain text, a command the bot does not know, or anything else it can't use (a sticker, photo, voice note or location pin)
**Then** the system replies with a short list of what it understands, including "send the set-city command followed by the city name", and stores nothing. Edits to messages already sent get no reply.

### AC-13 (US-05) — authorization (not a private chat)

**Given** the bot has been added to a group
**When** any Bot user sends one of the bot's commands there
**Then** nothing is stored or changed, and the system answers each such command with one reply saying the bot only works in a private chat. This applies only to the bot's own commands meant for this bot, not commands addressed to another bot. Other group messages get no reply, being added to a group triggers no message, and the bot never posts in channels.

### AC-14 (US-05) — authorization (one person's city is theirs alone)

**Given** Bot user A's Home city is Kyiv and Bot user B's is Lviv
**When** Bot user B sets the city "Paris"
**Then** A's Home city is still Kyiv, and nothing in any reply to B reveals A's city

### AC-15 (US-06) — error (failure is visible to the Operator)

**Given** a Bot user request fails: the place isn't found, the weather source is unavailable, or an unexpected fault occurs
**When** the failure happens
**Then** the Bot user still gets a plain-language reply ("something went wrong, please try again" for an unexpected fault), and the Operator can find exactly one log event for that request naming the failure kind and the chat. It never contains the bot token or the webhook secret.

Every request, successful or failed, produces exactly one log event. It records the outcome (or the failure kind), the chat, the command, how many lookups were made, how long the request took, and the time of the reading shown when there is one. Every §6 measurement and §7 KPI is counted from these events.

### AC-16 (US-02) — error (too many requests)

**Given** a Bot user for whom the bot has already made 30 place or weather lookups within the past 60 minutes (a rolling window)
**When** the Bot user sets a city or asks for the weather again
**Then** no lookup is made, their Home city is unchanged, and the system replies that they are sending too many requests and to try again later. Only lookups actually made count, whether or not a place was found. Requests blocked by this cap or by AC-17, blank names (AC-03), names that are too long (AC-04) and weather requests with no Home city (AC-09) do not count, so retrying while blocked never extends the block.

### AC-17 (US-02) — error (bot-wide daily budget used up)

**Given** the bot has already made 5,000 place or weather lookups for Bot user requests during the current day (counted in UTC)
**When** any Bot user sets a city or asks for the weather
**Then** no lookup is made, their Home city is unchanged, and the system replies that the bot has reached its daily limit and to try again tomorrow. This keeps the rest of the weather source's free daily allowance for alerts. Every place and weather lookup the bot makes counts, including ones that fail or time out, because both kinds draw on the same daily allowance. Requests that arrive at the same moment may push the count past 5,000 by a few lookups. When a Bot user hits both this budget and their own limit (AC-16), they get this "daily limit" reply.

## 6. Non-functional requirements

<!-- instruction: table, recommended floor (not a cap). Targets are NUMERIC (≤250ms, ≥30 req/s, 99.9%) — no adjectives («fast», «high»). Measurement = a concrete production metric. Unknown number → TBD with owner+due in §8, never «fast». -->

| Aspect | Target | Measurement |
|---|---|---|
| Reply time p95, set-city and weather | ≤ 2 s from receiving the message to sending the reply | duration field on the per-request log event, weekly p95 |
| CPU per message | ≤ 10 ms p99 (Workers Free hard limit; an overrun kills the request before it can reply) | Workers analytics, CPU time per invocation |
| Outbound calls per message | ≤ 3 (one lookup, one reply, one spare; the platform cap is 50) | integration tests count the stubbed outbound calls |
| Weather-source calls from this step | ≤ 5,000 a day in total, enforced (AC-17; half the free cap, leaving the rest for step 3 alerts) | daily sum of the lookup counts on the per-request log events; integration test at the boundary |
| Freshness of the reading shown | ≤ 30 min old, p95. A monitored target only: an older reading is still shown, with its reading time (AC-08). | per-request log event: reply time minus reading time |
| Reply rate | ≥ 99% of new private-chat messages, of any kind (edits excluded), get exactly one reply (catches a killed request getting none and a redelivery getting two) | log events: messages received vs. replies sent, monthly |
| Per-Bot-user request cap | ≤ 30 lookups per Bot user in any rolling 60 minutes (AC-16) | integration test at the boundary; lookup counts on the per-request log events, per chat, over 60 minutes |

## 6.1 Security / privacy

<!-- instruction:
- Data classification: public / internal / confidential / regulated (one word + 1-sentence rationale).
- Personal data touched: none, OR list new fields with type + sensitivity.
- AuthZ/AuthN impact: which capabilities / permission checks are added, which checks run (e.g. «repo always filters by the caller's org»). Stay surface-neutral — no endpoint/route language here; `design` derives the surfaces and `api` the endpoints.
- Abuse cases (3–5): cross-tenant access, draft/data leak, injection through URL/text fields, spam-create with a rate limit, optional token misuse — each with the business response (deny vs hide-existence; rationale, not status codes).
- Security review verdict: Required (M+ / new authz boundary / new PII) or N/A with a concrete reason. -->

- **Data classification:** internal. It is low-sensitivity personal data: which city a Telegram chat chose, with no names, usernames or message texts stored.
- **Personal data touched:** new, for the first time in the project:
  - Telegram chat identifier (number; identifies a person's chat with the bot; low sensitivity).
  - Home city: resolved name, coordinates of the place (not the person), timezone. Approximate location, low-to-medium sensitivity.
- **AuthZ/AuthN impact:**
  - Every read and write of a Home city is keyed by the chat the message arrived from, so a Bot user can only see or change their own (AC-14).
  - Only private chats can set or read a Home city (AC-13).
  - The bot acts only on messages proven to come from Telegram via the shared webhook secret. Anything else is ignored without a reply and without revealing why.
- **Abuse cases:**
  - Cross-user access, one Bot user trying to read or change another's city: impossible by construction, because there is no way to name another chat. The reply never mentions other Bot users (AC-14).
  - Forged updates, a request to the bot that did not come from Telegram: dropped silently. Nothing is stored and nothing is sent, so a forger learns nothing.
  - Injection through the city name, where the text contains markup or control characters: treated as plain text. It is echoed back only as the place name the lookup resolved, never as raw formatting. A name longer than 100 characters is refused without a lookup (AC-04).
  - Spam that burns the shared weather-source quota: rate limit of 30 lookups per Bot user in any rolling 60 minutes (AC-16), plus a hard bot-wide budget of 5,000 lookups a day; once it is used up, everyone gets the "daily limit reached" reply (AC-17).
  - Out-of-order or redelivered set-city (accepted risk): two quick set-city commands, or a late redelivery of an old one, can leave the earlier city stored. The last set-city processed wins, and the Bot user sees the result in the reply and can simply set the city again. Related to OQ-3.
  - Secret leakage through logs: log events never contain the bot token or the webhook secret (AC-15).
- **Security review:** Required (light), at `sdd:review`. This is the first personal data stored and the first check that the webhook is genuine. Checklist: no secrets in logs or the repo; forged updates ignored; city-name text can't break reply formatting.

## 7. Metrics / KPIs

<!-- instruction: ≥3 KPIs, no upper cap, each baseline → target with a timeframe. baseline=0 OK for a new feature; baseline=TBD requires a measurement plan inline. -->

All four start at baseline 0 (new feature). The clock starts when the bot goes live (roadmap step 6). They are counted from the per-request log events (US-06), so no separate analytics are needed. With a handful of Bot users (an assumption, `idea-brief.md` §3) the percentages are noisy, so read them as signals, not hard gates.

- **Onboarding** — baseline: 0, target: ≥ 80% of Bot users who start the bot have a Home city within 10 min of starting, within 30 days of launch.
- **First-try set-city success** — baseline: 0, target: ≥ 85% of set-city commands store a city rather than "couldn't find that place", within 30 days of launch.
- **Wrong-match signal** — baseline: 0, target: ≤ 15% of successful set-cities are followed by another set-city from the same chat within 5 min, within 30 days of launch. Above 15% is the trigger to revisit the "no picking with buttons" non-goal.
- **Weather error rate** — baseline: 0, target: ≤ 2% of weather requests end in "temporarily unavailable", every week after launch.

## 8. Open questions

<!-- instruction: 2–4 open questions. Format: `- [ ] <question>? Default now: <X>. — owner: <name/role>, due: <date or stage trigger like "before sdd:tasks">`. Every question has an owner + due — a lone «TBD» is an anti-pattern. -->

- [x] OQ-1: Which country forms are accepted when refining a city ("US", "USA", "United States"), and how is a tie broken when candidates have no population figure (AC-06, AC-07)? Default now: a two-letter country code or the English country name; otherwise the first candidate in the source's order. — owner: Vlad S, due: during `sdd:design base-logic` — **Resolved in design (SAD §5 `domain/countries.ts`, 2026-11-05):** country = 2-letter code (any case), English short name, or aliases USA/UK; ties without population → source order.
- [ ] OQ-2: How does a Bot user remove their Home city or stop using the bot (§3 non-goal "forget me")? Default now: no removal in step 2. — owner: Vlad S, due: before `sdd:specify` of roadmap step 3 (alerts)
- [x] OQ-3: Should Telegram's redelivered messages be de-duplicated so each message gets exactly one reply, or is the ≥ 99% reply-rate target (§6) enough? Default now: no de-duplication; keep CPU per message under the limit so redeliveries don't happen. — owner: Vlad S, due: during `sdd:design base-logic` — **Resolved in design (SAD §11, 2026-11-05):** no de-duplication in v1; duplicates are detectable by repeated `update_id` on the log event.
