import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";
import h16Plugin from "./scripts/quality/eslint-h16-plugin.mjs";

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

// H16c Bestand: Jede Datei ist einzeln gebunden; diese Listen duerfen nur schrumpfen.
const h16SilentErrorBaselineFiles = [
  "src/app/finanzen/FinanzenDashboardClient.tsx", // H16c Bestand: leerer catch.
  "src/components/layout/SessionWarningBanner.tsx", // H16c Bestand: leerer catch.
  "src/hooks/useAutosaveDraft.ts", // H16c Bestand: leere catch-Fallbacks.
  "src/lib/diagnostics/DiagnosticsContext.tsx", // H16c Bestand: leere catch-Fallbacks.
  "src/lib/hardware/printQueue.ts", // H16c Bestand: leerer catch.
  "src/lib/hardware/registry.ts", // H16c Bestand: leerer catch.
  "src/lib/offline/idbSync.ts", // H16c Bestand: leere catch-Fallbacks.
  "src/lib/search/recent.ts", // H16c Bestand: leere catch-Fallbacks.
  "src/lib/supabase/server.ts", // H16c Bestand: leerer catch.
  "src/lib/warendurchlaufIconResolver.ts", // H16c Bestand: leerer catch.
  "src/lib/warnings/store.ts", // H16c Bestand: leerer catch.
  "src/proxy.ts", // H16c Bestand: leerer catch.
];

const h16AlertBaselineFiles = [
  "src/app/marketing/MarketingStudioClient.tsx", // H16c Bestand: alert.
  "src/components/buchhaltung/MassenzuordnungModal.tsx", // H16c Bestand: alert.
  "src/components/entities/OrderFocusView.tsx", // H16c Bestand: alert.
  "src/components/kommunikation/ContextAnalysisOverlay.tsx", // H16c Bestand: alert.
  "src/components/warenausgang/WarenausgangQueue.tsx", // H16c Bestand: alert.
];

const h16PlaceholderTextBaselineFiles = [
  "src/app/actions/customers.actions.ts", // H16c Bestand: Demo-Datenquellenname.
  "src/app/baeder/BaederDashboardClient.tsx", // H16c Bestand: Demo-Text.
  "src/app/betrieb-kvp/BetriebKvpClient.tsx", // H16c Bestand: Mock-/Demo-Text.
  "src/app/buchhaltung/BuchhaltungCockpitClient.tsx", // H16c Bestand: Demo-Text.
  "src/app/finanzen/FinanzenDashboardClient.tsx", // H16c Bestand: Demo-Text.
  "src/app/layout.tsx", // H16c Bestand: historische mock-Stylesheet-Pfade.
  "src/components/admin/AdminDashboard.tsx", // H16c Bestand: Demo-Text.
  "src/components/admin/DataImportCenter.tsx", // H16c Bestand: Demo-Text.
  "src/components/buchhaltung/BelegUploadOverlay.tsx", // H16c Bestand: Demo-Text.
  "src/components/kommunikation/ContextAnalysisOverlay.tsx", // H16c Bestand: Mock-/Demo-Text.
  "src/components/warenausgang/WarenausgangQueue.tsx", // H16c Bestand: Demo-Text.
  "src/lib/buchhaltung/providers/MockBuchhaltungProvider.ts", // H16c Bestand: Mock-Text.
  "src/lib/buchhaltung/stufe2/mocks.ts", // H16c Bestand: Mock-Text.
  "src/lib/demoDataGenerator.ts", // H16c Bestand: Demo-Text.
  "src/lib/server/orderIntakeRead.ts", // H16c Bestand: Demo-Datenquellenname.
  "src/lib/validation/orderSchema.ts", // H16c Bestand: Mock-Datenquellenname.
  "src/modules/werkstatt/ui/WerkstattLoading.tsx", // H16c Bestand: historische mock-Klasse.
  "src/modules/werkstatt/ui/WerkstattView.tsx", // H16c Bestand: WIP-Test-ID.
  "src/ui/kr/WipMenge.tsx", // H16c Bestand: WIP-Klassen.
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

const modulesServerConsumerFacadePattern = {
  group: ["@/modules/*/*", "!@/modules/*/public", "!@/modules/*/server-public"],
  message: "Serverkonsumenten duerfen Module nur ueber public oder server-public verwenden; die fail-closed Verbraucherpruefung liegt im S1-Modul-Gate.",
};

const nonExecutableReferencePattern = {
  group: [
    "**/docs/project/history/**",
    "**/docs/project/linie/ui/designsystem_v1_1/**",
  ],
  message: "Produktcode darf bytegebundene Referenzen oder Historienquellen nicht importieren.",
};

function boundaryRule(forbidden, message) {
  return {
    "no-restricted-imports": ["error", {
      patterns: [
        ...forbidden.map(group => ({ group: [group], message })),
        modulesFacadePattern,
        nonExecutableReferencePattern,
      ],
    }],
  };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "unused-imports": unusedImports,
      h16: h16Plugin,
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
    rules: {
      "h16/no-role-identity-comparison": "error",
      "h16/no-role-permissions": "error",
      "h16/no-person-names": "error",
      "h16/no-silent-errors": "error",
      "h16/no-alert": "error",
      "h16/no-placeholder-text": "error",
      "no-restricted-imports": [
        "error",
        { patterns: [modulesFacadePattern, nonExecutableReferencePattern] },
      ],
    },
  },
  {
    files: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/__tests__/**/*.ts",
      "src/**/__tests__/**/*.tsx",
      "src/test/**/*.ts",
      "src/test/**/*.tsx",
    ],
    rules: {
      "h16/no-role-identity-comparison": "off",
      "h16/no-role-permissions": "off",
      "h16/no-person-names": "off",
      "h16/no-silent-errors": "off",
      "h16/no-alert": "off",
      "h16/no-placeholder-text": "off",
    },
  },
  {
    files: h16SilentErrorBaselineFiles,
    rules: { "h16/no-silent-errors": "off" },
  },
  {
    files: h16AlertBaselineFiles,
    rules: { "h16/no-alert": "off" },
  },
  {
    files: h16PlaceholderTextBaselineFiles,
    rules: { "h16/no-placeholder-text": "off" },
  },
  {
    files: [
      "src/app/settings/SettingsAdminClient.tsx",
      "src/lib/server/appSession.ts",
      "src/lib/server/productActorReadiness.ts",
      "src/lib/server/productActorReadinessCore.ts",
    ],
    linterOptions: {
      noInlineConfig: false,
      reportUnusedDisableDirectives: "error",
    },
  },
  // STAGE_1_PIN_ONLY: Dieser Override pinnt ausschliesslich den kuenftigen ESLint-Vertrag.
  // Der geschuetzte S1-Modul-Checker bleibt bis zur atomaren Folgestufe absichtlich
  // strenger/public-only und blockiert jeden server-public-Verbraucher weiterhin.
  // Client/AppAdapter und alle sonstigen src-Dateien behalten ebenfalls public-only.
  {
    files: ["src/app/actions/*.actions.ts", "src/test/**/*.integration.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [modulesServerConsumerFacadePattern, nonExecutableReferencePattern] },
      ],
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
  {
    // Die ownergebundene V1.1-Komponentenquelle wird bytegleich eingebaut.
    // Ihre beiden zustandsabgleichenden Effekte bleiben deshalb unverändert.
    files: ["src/ui/kr/Befehlspalette.tsx", "src/ui/kr/tastatur.ts"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".playwright-cli/**",
    "supabase/.temp/**",
    // Gebundene Referenzquellen und Historie sind Bauinput/Evidence, nicht Produktcode.
    "docs/project/linie/ui/designsystem_v1_1/**",
    "docs/project/history/**",
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
