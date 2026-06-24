import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * QG-01 Scripts scope — Node.js CommonJS + ESM
 *
 * Applies to:
 *   - scripts/**\/*.{js,mjs,cjs,ts}  (maintenance scripts directory)
 *   - *.js in project root             (CJS utility scripts: create_migrate.js, verify.js, …)
 *   - migrate.mjs                      (ESM migration script)
 *
 * Run via: npm run lint:scripts
 *   (eslint --config eslint.scripts.config.mjs scripts/ *.js migrate.mjs)
 *
 * NO React, NO Next.js, NO Deno globals.
 *
 * App scope  → eslint.config.mjs        (Next.js/React/TS)
 * Edge scope → eslint.edge.config.mjs   (Deno/TS)
 */
export default defineConfig([
  // ── TypeScript scripts (ESM) ────────────────────────────────────────────
  // scripts/*.ts use @/aliases (Next.js path mapping) — only syntactic checks,
  // no type-aware rules (no parserOptions.project needed).
  {
    files: ["scripts/**/*.ts", "scripts/**/*.mjs", "migrate.mjs"],
    languageOptions: {
      globals: globals.node,
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Scripts may legitimately use require() in TypeScript wrappers —
      // do not enforce no-require-imports here (unlike edge scope).
    },
  },

  // ── CommonJS scripts (.js and .cjs) ─────────────────────────────────────
  // Root-level .js scripts (create_migrate.js, verify.js, enrich.js, …) use
  // require()/module.exports. scripts/**/*.{js,cjs} are also CommonJS.
  {
    files: ["scripts/**/*.js", "scripts/**/*.cjs", "*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
      parserOptions: {
        sourceType: "commonjs",
      },
    },
    rules: {
      "no-undef": "error",
    },
  },
]);
