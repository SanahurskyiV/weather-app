// Secrets are not declared in wrangler.toml, so `wrangler types` cannot see them.
// Set them with `wrangler secret put` (production) or `.dev.vars` (local).
declare namespace Cloudflare {
  interface Env {
    BOT_TOKEN: string;
    WEBHOOK_SECRET: string;
    /** Optional JSON from Telegram `getMe`; skips one API call per cold start. */
    BOT_INFO?: string;
  }
}
