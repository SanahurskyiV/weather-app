declare namespace Cloudflare {
  interface Env {
    /** Injected by vitest.config.ts from ./migrations. Test-only. */
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
