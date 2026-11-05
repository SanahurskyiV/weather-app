import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Every test runs inside workerd with the bindings from wrangler.toml and a local D1.
export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            BOT_TOKEN: "123456:test-token",
            WEBHOOK_SECRET: "test-secret",
            BOT_INFO: JSON.stringify({
              id: 123456,
              is_bot: true,
              first_name: "Weather Bot",
              username: "weather_test_bot",
              can_join_groups: true,
              can_read_all_group_messages: false,
              supports_inline_queries: false,
              can_connect_to_business: false,
              has_main_web_app: false,
            }),
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/integration/apply-migrations.ts"],
    },
  };
});
