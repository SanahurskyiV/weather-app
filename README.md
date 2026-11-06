# weather-bot

A Telegram bot that tells you the weather for your city and warns you before notable weather arrives,
like rain within the hour or a sharp temperature change, while respecting your quiet hours.

Runs on the Cloudflare Workers free plan: Telegram delivers updates by webhook, and a cron trigger runs
the forecast check every 15 minutes. State lives in Cloudflare D1.

> Status: the bot sets your Home city and shows its current weather. Heads-up alerts, quiet hours and
> `/demo_alert` are on the [roadmap](docs/roadmap.md).

## Commands

The bot works in private chats only; in a group it just points you to a private chat.

- `/start`: how to get started, and your Home city once it is set.
- `/city <name>`: set your Home city, for example `/city Kyiv` or `/city Київ`. When several places share a
  name, the most populous one wins; add a country after a comma to pick another, for example `/city Paris, US`.
- `/weather`: the current conditions in your Home city, in °C and km/h.

Each person can make up to 30 lookups an hour, and the whole bot up to 5,000 a day.

## Stack

TypeScript (strict) · [grammY](https://grammy.dev) · Cloudflare Workers + D1 · [Open-Meteo](https://open-meteo.com)
· Vitest in the Workers runtime · ESLint + Prettier · GitHub Actions.
Architecture and decisions: [docs/architecture-map.md](docs/architecture-map.md), [docs/adr/](docs/adr/).

## Local development

Requires Node 26 LTS (see `.nvmrc`).

```bash
npm install
npm test             # unit + integration tests inside workerd, with a local D1
npm run typecheck
npm run lint
```

To run the bot locally, create a bot with [@BotFather](https://t.me/BotFather), then:

```bash
cp .dev.vars.example .dev.vars   # fill in BOT_TOKEN and WEBHOOK_SECRET (BOT_INFO is optional)
npm run db:migrate:local
npm run dev                      # serves the Worker on http://localhost:8787
```

Telegram can only reach a public HTTPS URL, so expose the local Worker with a tunnel
(for example `cloudflared tunnel --url http://localhost:8787`) and point the webhook at it:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<tunnel-host>/webhook" -d "secret_token=<WEBHOOK_SECRET>"
```

## Deploy

Deployment is the "Bot is live on Cloudflare" step on the [roadmap](docs/roadmap.md). In short:
`wrangler d1 create weather-bot-db` (put the id in `wrangler.toml`), `npm run db:migrate:remote`,
`wrangler secret put BOT_TOKEN`, `wrangler secret put WEBHOOK_SECRET`, `wrangler secret put BOT_INFO`,
`npm run deploy`, then `setWebhook` to `https://<worker>.workers.dev/webhook`.

`BOT_INFO` is required in production: it is the JSON `result` of
`https://api.telegram.org/bot<BOT_TOKEN>/getMe`. Without it the bot calls `getMe` on every cold start, which
costs an extra outbound call and CPU time, and the Worker logs a `startup_warning`. Locally it is optional.

## Weather data

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
