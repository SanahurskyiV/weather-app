---
status: Draft
owner: "Vlad S"
updated_at: "2026-11-05"
depth: "medium"
---

# Idea brief — weather-bot

## 1. Raw idea

> i wanna create app, it should be  telegram bot which will send weather for choosen city, will react on changing weather and you can add some imporatnt tiny feature

## 2. Problem

The owner wants a personal project that is both well engineered (clean structure, tests, CI, docs) and a real, working product running live (owner-reported). The product is a Telegram bot. A user picks a city, gets its weather on request, and is proactively warned when notable weather is about to arrive (owner-reported).

Observable desired outcome: anyone can (a) use the live bot in Telegram within seconds, (b) see an alert fire on demand without waiting for real weather, and (c) find a clean, tested codebase in the repo (owner-accepted). No external user problem is claimed; this is the owner's own project.

## 3. Users

- **Bot end users**: anyone who subscribes to a city in Telegram. In practice this is the owner and a few acquaintances (assumption). A first-time user won't wait hours for real weather to see an alert (assumption the owner accepted).
- **Repo visitors**: people reading the code and README on GitHub (assumption).
- **Operator**: the owner, who runs and maintains the live deployment on free hosting (owner-reported).

## 4. Why now

It's the owner's own project; no external trigger or deadline has been established.

## 5. Out of scope

Agreed v1 exclusions (owner-accepted on 2026-11-05), to keep scope small and finishable:
- daily digest or scheduled summaries (alerts only)
- following multiple cities per user
- choosing a location via a Telegram location pin
- "what to wear" or umbrella tips
- languages other than English, i.e. no i18n
- any web UI or dashboard

Owner-required constraints:
- language is **TypeScript / Node**
- hosting must be **free only**, no paid tier
- the delivery channel is **Telegram**

## 6. Risks

1. **Free-only hosting vs. an always-on background checker (weakest assumption).** Alerts need forecasts checked on a schedule, but some free tiers sleep when idle. Render's free web services reportedly spin down after about 15 minutes without inbound traffic and lose local disk. If the hosting choice is wrong, alerts silently stop, which hurts the "ships real products" signal. Serverless free tiers with scheduled triggers look viable, but their limits are tight (reportedly 10 ms CPU per invocation on Cloudflare Workers Free). This is reversible but shapes the architecture, so it's for design to settle.
2. **Weather-data licence and limits.** One free candidate, Open-Meteo, reportedly permits only non-commercial use on its free tier, with about 10,000 calls a day. A personal bot is non-commercial and low-volume, so this is likely fine, but the terms page has not been checked directly.
3. **Alert noise.** Repeated or overnight alerts would make the bot annoying and the demo look sloppy. This is mitigated by de-duplicating alerts and by quiet hours (owner-accepted). The exact alert thresholds are not yet defined.
4. **Secrets in a public repo.** The Telegram bot token and any API keys must never be committed. This is an assumption to enforce in CI and in the docs.
5. **Ongoing upkeep.** A live bot needs someone to keep it running indefinitely; the owner is the sole operator (owner-reported). If it goes down, anyone who tries it sees a dead bot.

Evidence ledger:

| Claim / question | Class | Source / origin | Finding / limit |
|---|---|---|---|
| Goal: equal weight on code quality and a live product | owner-reported | interview 2026-11-05 | — |
| Stack is TypeScript/Node; hosting is free only | owner-reported | interview 2026-11-05 | — |
| Render free web services sleep after 15 min idle | source-indicated (search summary) | https://render.com/docs/free, via web search 2026-11-05 | Page not opened directly; seen only in search-result summary |
| Cloudflare Workers Free: 5 cron triggers per account, 1-min minimum cadence | source-indicated (search summary) | developers.cloudflare.com/workers/platform/limits (preview mirrors), via web search 2026-11-05 | Preview copies, not the live page; the 10 ms CPU figure is second-hand |
| Open-Meteo free tier is non-commercial, ~10k calls/day | source-indicated (search summary) | openmeteo.substack.com, via web search 2026-11-05 | Terms and pricing pages not opened; third-party sources conflict |
| First-time users won't wait hours for an alert | assumption | interviewer reasoning, owner accepted the mitigation | Not measured |

The critique was done inline by the interviewer, not by an independent reviewer. That was enough here because nothing in scope touches sensitive access, user data or a public contract, and every choice is easy to reverse.

## 7. Recommendation

Chosen direction (**owner-accepted**, 2026-11-05):

A TypeScript/Node Telegram bot that runs live on free hosting. In v1:
- A user sets a city and gets its current weather on request.
- Heads-up alerts: a background check warns about notable upcoming weather, such as rain within about an hour or a sharp temperature change, without repeating the same alert.
- Quiet hours: the user sets a window in their own timezone, and alerts are held until it ends. This is the extra small feature.
- `/demo_alert` sends a real alert through the actual pipeline using sample weather data, so anyone can see one in seconds. A README GIF shows the same flow.
- The repo has tests, CI and clear docs.

Intended result: anyone can try the bot, see an alert fire and read clean code, all within a couple of minutes.

Main tradeoff: aiming at both clean engineering and a live product means the most work and ongoing upkeep. The owner accepted that.

Rejected alternatives:
- Daily digest instead of alerts: it's a schedule rather than a reaction to change, and has less engineering depth.
- Alerts plus digest: doubles the scope.
- Location pin, wear tips or multiple cities as the extra feature: quiet hours directly supports the core alert flow.
- A GIF-only or no demo path: most people would never actually see an alert.

Outcome: ready-for-specify

Next action: run `/sdd:specify weather-bot`. Design must then settle free hosting that can run scheduled checks reliably (see §8).

## 8. Open questions

| Unknown | Consequence | Blocking? | Verification action | Owner |
|---|---|---|---|---|
| Which free hosting reliably supports scheduled background checks plus Telegram updates? | Decides the deployment model. Choosing wrong silently breaks alerts. | Nonblocking for specify, blocking for design | Read the current official free-tier pages of the candidate hosts during design | Vlad S |
| Which weather data source, and do its terms fit? | Licence or rate limits could rule a source out | Nonblocking for specify | Open the provider's terms and pricing pages during design | Vlad S |
| What exact thresholds define "notable" weather (rain lead time, size of a temperature jump)? | Decides alert behaviour and test cases | Nonblocking; settled in specify | Define in specify's acceptance criteria | Vlad S |
| Is there a deadline? | Could force a smaller v1 | Nonblocking | Owner to confirm if relevant | Vlad S |
