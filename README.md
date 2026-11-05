# weather-bot

A Telegram bot that tells you the weather for your city and warns you before notable weather arrives,
like rain within the hour or a sharp temperature change, while respecting your quiet hours.

Runs on the Cloudflare Workers free plan: Telegram delivers updates by webhook, and a cron trigger runs
the forecast check every 15 minutes. State lives in Cloudflare D1.

> Status: project skeleton. The bot answers `/start`; weather, alerts, quiet hours and `/demo_alert`
> are on the [roadmap](docs/roadmap.md).

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
cp .dev.vars.example .dev.vars   # fill in BOT_TOKEN and WEBHOOK_SECRET
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
`wrangler secret put BOT_TOKEN`, `wrangler secret put WEBHOOK_SECRET`, `npm run deploy`, then `setWebhook`
to `https://<worker>.workers.dev/webhook`.

## Weather data

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
