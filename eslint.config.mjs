import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";

// ── Module-boundary import rules (APP-STRUCTURE-001) ──────────────
// These rules enforce zero-violation boundaries from OWNERSHIP_MAP.md.
// Only boundaries with 0 existing violations are enforced as errors.
// See docs/project/OWNERSHIP_MAP.md for the full map and tech debt.

const authMustNotImport = [
  "@/lib/orders", "@/lib/orders/*",
  "@/lib/customers", "@/lib/customers/*",
  "@/lib/buchhaltung", "@/lib/buchhaltung/*",
  "@/lib/erfassung", "@/lib/erfassung/*",
  "@/lib/marketing", "@/lib/marketing/*",
];

const ordersMustNotImport = [
  "@/lib/customers", "@/lib/customers/*",
  "@/lib/buchhaltung", "@/lib/buchhaltung/*",
];

const buchhaltungMustNotImport = [
  "@/lib/orders", "@/lib/orders/*",
  "@/lib/customers", "@/lib/customers/*",
];

const erfassungMustNotImport = [
  "@/lib/buchhaltung", "@/lib/buchhaltung/*",
  "@/lib/marketing", "@/lib/marketing/*",
];

function boundaryRule(forbidden, message) {
  return {
    "no-restricted-imports": ["error", {
      patterns: forbidden.map(group => ({ group: [group], message })),
    }],
  };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "unused-imports/no-unused-imports": "error",
    },
  },
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
    },
  },
  // ── Domain isolation: auth must not depend on business domains ──
  {
    files: ["src/lib/auth/**/*.ts", "src/lib/auth/**/*.tsx"],
    rules: boundaryRule(authMustNotImport,
      "auth/ must not import business domains (see OWNERSHIP_MAP.md)"),
  },
  // ── Domain isolation: orders ──
  {
    files: ["src/lib/orders/**/*.ts", "src/lib/orders/**/*.tsx"],
    rules: boundaryRule(ordersMustNotImport,
      "orders/ must not import customers or buchhaltung (see OWNERSHIP_MAP.md)"),
  },
  // ── Domain isolation: buchhaltung ──
  {
    files: ["src/lib/buchhaltung/**/*.ts", "src/lib/buchhaltung/**/*.tsx"],
    rules: boundaryRule(buchhaltungMustNotImport,
      "buchhaltung/ must not import orders or customers (see OWNERSHIP_MAP.md)"),
  },
  // ── Domain isolation: erfassung ──
  {
    files: ["src/lib/erfassung/**/*.ts", "src/lib/erfassung/**/*.tsx"],
    rules: boundaryRule(erfassungMustNotImport,
      "erfassung/ must not import buchhaltung or marketing (see OWNERSHIP_MAP.md)"),
  },
  // ── Layer isolation: features must not import server actions ──
  {
    files: ["src/features/**/*.ts", "src/features/**/*.tsx"],
    rules: boundaryRule(
      ["@/app/actions", "@/app/actions/*"],
      "features/ must not import app/actions/ (see OWNERSHIP_MAP.md)"),
  },
  // ── Layer isolation: db/ is a leaf dependency ──
  {
    files: ["src/db/**/*.ts", "src/db/**/*.tsx"],
    rules: boundaryRule(
      ["@/app", "@/app/*", "@/lib", "@/lib/*"],
      "db/ must not import from app/ or lib/ — schema is a leaf dependency"),
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone maintenance and local verification CLIs; none are part of the Next.js build.
    "create_migrate.js",
    "enrich.js",
    "init_marketing_db.js",
    "rewrite.js",
    "run_audit.js",
    "seed_channels.js",
    "seed_segments.js",
    "test-routes.js",
    "verify.js",
  ]),
]);

export default eslintConfig;
