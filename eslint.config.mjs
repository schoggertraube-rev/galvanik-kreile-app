import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * QG-01 App scope — Next.js + React + TypeScript
 *
 * Applies to: src/**\/*.ts, src/**\/*.tsx
 * Run via:    npm run lint:app   (eslint --config eslint.config.mjs src/)
 *
 * Edge Functions → eslint.edge.config.mjs   (Deno runtime)
 * Node Scripts   → eslint.scripts.config.mjs (Node runtime)
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Next.js build artifacts
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Separate runtime scopes — each has its own config
    "supabase/**",
    "scripts/**",
    "*.js",
    "*.mjs",
    "*.cjs",
    // Scratch / legacy one-off files
    "scratch/**",
    "test_legacy.ts",
    "test_station_counts.ts",
  ]),
]);

export default eslintConfig;
