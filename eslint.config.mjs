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

// ── Positive Fassade (D-ARCH-008 Naht 2 / S1): Fremdmodul nur ueber public.ts ──
// Editor-Feedback; die verbindliche Pruefung (auch relative Tiefimporte, dynamic
// import, vi.mock, eigenes Modul nur relativ) ist scripts/quality/check-module-gates.mjs.
// Flat config: ein spaeterer no-restricted-imports-Block ERSETZT die Optionen eines
// frueheren. Darum haengt boundaryRule() dieses Pattern an JEDE Domaenen-Regel an, und
// der globale src/**-Block steht VOR den Domaenen-Bloecken.
const modulesFacadePattern = {
  group: ["@/modules/*/*", "!@/modules/*/public"],
  message: "Tiefimport in ein Modul. Fremdmodule nur ueber @/modules/<fach>/public (ARCHITEKTUR_MODULE_PATH1.md Naht 2, S1).",
};

function boundaryRule(forbidden, message) {
  return {
    "no-restricted-imports": ["error", {
      patterns: [...forbidden.map(group => ({ group: [group], message })), modulesFacadePattern],
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
  // ── S1 Naht 2 fuer alle src-Dateien ohne eigene Domaenen-Regel ──
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: { "no-restricted-imports": ["error", { patterns: [modulesFacadePattern] }] },
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
  // ── Tenant-Literal-Verbot (D-ARCH-007 / S0): kein 'galvanik-kreile' im Code ──
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "Literal[value='galvanik-kreile']",
        message: "Kein Tenant-Literal 'galvanik-kreile'. Nutze KREILE_TENANT_SLUG aus @/lib/tenant (D-ARCH-007, S0).",
      }],
    },
  },
  {
    // Einzige erlaubte Stelle + noch nicht migrierte db/ (SQL/Seed, TODO S0-Rest)
    // + byte-gepinnte Evidence-Tests: quality.yml prueft deren Blob-Hash exakt
    //   (W4_TEST_BLOB), sie duerfen NICHT migriert/veraendert werden.
    files: [
      "src/lib/tenant.ts",
      "src/db/**/*.ts",
      "src/db/**/*.tsx",
      "src/test/w4_order_station_attachment.integration.test.ts",
    ],
    rules: { "no-restricted-syntax": "off" },
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
