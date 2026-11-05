import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Layer rules from ADR-0002: domain is pure, app depends only on domain and its ports.
const platformImports = ["grammy", "grammy/*", "cloudflare:*"];

export default tseslint.config(
  { ignores: ["node_modules/", "dist/", ".wrangler/", "worker-configuration.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ["src/domain/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/app/**", "**/adapters/**", "**/worker"],
              message: "domain must not depend on app, adapters or the entry point.",
            },
            { group: platformImports, message: "domain must stay free of platform and library I/O." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/adapters/**", "**/worker"], message: "app talks to adapters only through ports." },
            { group: platformImports, message: "app must not import platform libraries; add a port instead." },
          ],
        },
      ],
    },
  },
  {
    files: ["*.config.{js,ts}"],
    ...tseslint.configs.disableTypeChecked,
  },
);
