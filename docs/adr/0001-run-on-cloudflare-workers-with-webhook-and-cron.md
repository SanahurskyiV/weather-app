---
status: Accepted
owner: "Vlad S"
reviewers: []
updated_at: "2026-11-05"
feature_size: "n/a (repo foundation)"
ticket: "n/a"
---

# 0001 — Run the bot on Cloudflare Workers with a Telegram webhook and a cron trigger

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Vlad S, with Claude during the `survey` foundation session

## Context

weather-bot must be live around the clock. It answers Telegram commands and checks forecasts in the background to send heads-up alerts. The owner requires free hosting only and TypeScript/Node (idea brief §5). Common free tiers that sleep when idle would silently stop the background checks; Render's free web services reportedly spin down after 15 min without inbound traffic. This is the project's weakest assumption (idea brief §6, risk 1).

## Decision drivers

- Free hosting only (owner-required, idea brief §5).
- Alerts must keep running with no inbound traffic, so nothing that sleeps.
- A live bot reviewers can try in seconds ("ships real products" goal, idea brief §2).
- Low ongoing upkeep for a single owner-operator (idea brief §6, risk 5).
- TypeScript/Node ecosystem (owner-required).

## Considered options

1. **Cloudflare Workers Free with a webhook and a cron trigger.** A serverless function runs on each Telegram update and on a 15-min schedule. grammY has an official Workers guide.
2. **Oracle Cloud Always Free VM.** An always-on Node process doing long polling, with SQLite on disk. No CPU limit, but the owner looks after the server, and signup needs a card.
3. **Render free web service with an external keep-alive ping.** Render's docs say free services spin down after 15 min idle, and keep-alive pings are an unsupported workaround that can get the service suspended.

## Decision outcome

**Chosen:** Option 1, Cloudflare Workers Free. It needs no server upkeep and has nothing that sleeps: Telegram's webhook starts the Worker on demand, and the cron trigger runs the alert check on schedule. That meets the always-live and low-upkeep drivers at no cost. The owner accepted it on 2026-11-05.

## Consequences

**Positive**
- No idle sleep. Alerts run on schedule without keep-alive hacks.
- No server, OS patching or process manager to run, and deploys are a single `wrangler deploy`.
- Free requests (reportedly 100k a day) are far beyond what a portfolio bot needs.

**Negative**
- CPU time per invocation is limited on the free plan. Sources say 10 ms, and one says more, so check the official limits page during design. The alert check has to batch network calls and keep computation small, and may need to process subscribers in chunks across ticks.
- Subrequests per invocation are capped (reportedly 50), which limits fan-out per tick.
- Long polling isn't possible, so local development needs `wrangler dev` plus a tunnel or relies on integration tests.
- Alert latency is bounded by the cron cadence of 15 min.

**Neutral**
- Domain and app code don't import Workers APIs (ADR-0002), so moving to option 2 later means rewriting `src/worker.ts` and the adapters, not the business logic.

## Links

- Idea brief: [[../idea-brief.md]] §5, §6
- Architecture map: [[../architecture-map.md]] §Stack, §Constraints
- Related ADR: [[0002-organize-code-as-ports-and-adapters]], [[0003-store-state-in-cloudflare-d1]]
- Sources (as summarized by web search, 2026-11-05): https://render.com/docs/free, https://grammy.dev/hosting/cloudflare-workers-nodejs, https://developers.cloudflare.com/workers/platform/limits/
