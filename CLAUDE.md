# weather-bot — working rules

Telegram weather bot on Cloudflare Workers. Architecture: [docs/architecture-map.md](docs/architecture-map.md),
decisions: [docs/adr/](docs/adr/), plan: [docs/roadmap.md](docs/roadmap.md).

## Commands

- `npm test`: Vitest, every test runs inside workerd with a local D1 (migrations applied automatically)
- `npm run typecheck`: `tsc --noEmit`
- `npm run lint`: ESLint (strict type-checked + layer rules) and `prettier --check`
- `npm run build`: `wrangler deploy --dry-run --outdir dist`
- `npm run dev`: local Worker with `wrangler dev` (needs `.dev.vars`, see `.dev.vars.example`)
- `npm run cf-typegen`: regenerate `worker-configuration.d.ts` after changing `wrangler.toml`
- `npm run db:migrate:local`: apply D1 migrations to the local database

Node 26 LTS (`.nvmrc`). CI runs typecheck, lint, test and build on every push.

## Layers (ADR-0002, enforced by ESLint)

- `src/domain/`: pure logic (alert rules, quiet hours, time). No I/O, no `grammy`, no `cloudflare:*`.
- `src/app/`: use cases plus the port interfaces they need (`src/app/ports.ts`). Imports only `domain`.
- `src/adapters/`: Telegram (grammY), Open-Meteo, D1, clock, logging. Implements ports.
- `src/composition.ts`: composition root. Builds adapters from `env`, hand-wired, no DI container.
- `src/worker.ts`: Wrangler `main`, routing only. Export nothing but `default` (workerd treats every named export as an entry point).

New bot command: `src/adapters/telegram/commands/<name>.ts`, registered in `src/adapters/telegram/bot.ts`,
calling a use case in `src/app/`.

## Conventions

- Expected failures return `Result<T, E>` from `src/domain/result.ts`; never throw them.
- Read time only through the `Clock` port. Store times as UTC ISO-8601; per-user IANA timezone for display and quiet hours.
- D1 access only in `src/adapters/d1/`, with prepared statements and bound parameters. No logic in SQL.
- Migrations: `migrations/NNNN_snake_name.sql`, forward-only (ADR-0003). Undo with a new migration; never edit an applied one.
- Logging: `log(event, fields)` from `src/adapters/log.ts` (one JSON line per event).
- The webhook answers 200 even when a handler fails, so Telegram does not redeliver forever.
- Tests: unit tests next to the code (`*.test.ts`); integration tests in `test/integration/`.
  Stub outbound HTTP (`vi.spyOn(globalThis, "fetch")`) with JSON fixtures from `test/fixtures/`.

## Free-plan limits to respect (ADR-0001)

Workers Free: 10 ms CPU per request and per Cron Trigger, 50 subrequests per invocation, 100k requests/day.
D1 Free: 5M rows read and 100k rows written per day. Open-Meteo: non-commercial, under 10k calls/day.
Batch outbound calls and keep per-invocation work small.

## Secrets

`BOT_TOKEN`, `WEBHOOK_SECRET` (and optional `BOT_INFO`) come from `wrangler secret put` in production and a
gitignored `.dev.vars` locally. Never put them in `wrangler.toml` or commit them.
