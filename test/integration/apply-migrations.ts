import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Brings the local D1 to the latest schema before each test file.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
