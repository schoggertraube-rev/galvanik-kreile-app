import { describe, expect, it } from "vitest";

import {
  checkSalesStageB2ScopeForTest,
  checkTaB2bScopeForTest,
  checkTaB2c2ScopeForTest,
  checkTaB2c3ScopeForTest,
  checkTaB2cScopeForTest,
  checkTaB2d2ScopeForTest,
  checkTaB2eScopeForTest,
  checkTaB2fScopeForTest,
  runSelftest,
} from "../../scripts/quality/check-live-package-scope.mjs";

const b2Mission = {
  active_block: "B2",
  branch: "kreile/b2-eingang",
};

const b2AnchorMission = {
  ...b2Mission,
  phase: "WRITING",
  started_from_sha: "ae79c12fb6bea83b8ac68fa065af4671f4bf09b5",
  desktop_due_at: "2026-11-08",
  tablet_mobile_due_at: "2026-11-08",
  handoff_path: "docs/delivery/ABGABE_B2.md",
  next_block: "B3",
};

const b2cAnchorMission = {
  ...b2AnchorMission,
};

const ap01ExactPaths = [
  "docs/delivery/ABGABE_AP-01.md",
  "docs/evidence/f1/F1_R0_CAPABILITY_REGISTRY.json",
  "e2e/f1-4-immutable-invoice.real.spec.ts",
  "e2e/path1-ui-convergence-v5-global-create.spec.ts",
  "e2e/path1-ui-convergence-v5-p3.real.spec.ts",
  "scripts/quality/h18-server-actions.json",
  "src/app/GlobalCreateAppAdapter.tsx",
  "src/app/actions/eingang.actions.ts",
  "src/app/actions/intakeDraft.actions.ts",
  "src/app/orders/OrdersAppAdapter.tsx",
  "src/app/warendurchlauf/__tests__/w2cB2m5j.unavailable.realRender.test.tsx",
  "src/components/home/OfficeHome.tsx",
  "src/components/home/OfficeHomeClient.tsx",
  "src/components/home/__tests__/RolfHome.realRender.test.tsx",
  "src/components/layout/GlobalCreateFlow.tsx",
  "src/components/layout/KreileHeader.tsx",
  "src/components/layout/MoreMenu.tsx",
  "src/components/layout/TargetShell.module.css",
  "src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx",
  "src/components/layout/__tests__/w2cHeaderTruth.realRender.test.tsx",
  "src/components/layout/globalCreateRequest.ts",
  "src/lib/auth/authorizationContract.ts",
  "src/lib/server/commands/orderIntakeCommand.ts",
  "src/lib/server/commands/__tests__/orderIntakeCommand.test.ts",
  "src/lib/server/intakeDraft.ts",
  "src/lib/server/todayDashboard.ts",
  "src/modules/fundament/featureCatalog.ts",
  "src/modules/suche/ui/SearchDialog.tsx",
  "src/modules/werkstatt/ui/WerkstattView.singleProjection.test.tsx",
  "src/modules/werkstatt/ui/WerkstattView.tsx",
  "src/test/acceptance/ap01_eingang_paket_persoenlich.integration.test.ts",
  "src/ui/kr/AppShell.tsx",
  "src/ui/kr/GlobalesPlus.tsx",
  "supabase/migrations/20261031212320_ap01_intake_item.sql",
] as const;

const apgAprExactPaths = [
  ".github/workflows/agentur-gate.yml",
  "e2e/generated/_erwartet_rot.json",
  "e2e/generated/_harness.ts",
  "e2e/generated/_model.ts",
  "e2e/generated/_seed.sql",
  "e2e/generated/eingang.flow.spec.ts",
  "e2e/generated/kundebearbeiten.flow.spec.ts",
  "e2e/generated/kundeneu.flow.spec.ts",
  "e2e/generated/playwright.config.ts",
  "scripts/spec/generate-flow-tests.mjs",
  "src/components/layout/KreileAppShell.tsx",
  "src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx",
  "src/lib/server/commands/__tests__/orderIntakeCommand.test.ts",
  "src/lib/server/commands/__tests__/orderIntakeCommand.test.ts",
  "src/modules/eingang/GlobalCreateFlow.tsx",
  "src/modules/eingang/requestGlobalCreate.ts",
  "src/ui/kr/Dialog.tsx",
  "src/ui/kr/GlobalesPlus.tsx",
] as const;

const apEinInventoryPaths = [
  "src/app/actions/goodsOut.actions.ts",
  "src/app/actions/orders.actions.ts",
  "src/app/settings/SettingsAppAdapter.tsx",
  "src/components/admin/CompanySettingsForm.tsx",
  "src/components/warenausgang/WarenausgangQueue.tsx",
  "src/modules/orders/server/types.ts",
  "src/modules/werkstatt/server/deriveWerkstattView.ts",
  "src/modules/werkstatt/server/types.ts",
  "src/modules/werkstatt/__tests__/deriveWerkstattView.test.ts",
  "src/modules/fundament/public.ts",
  "src/lib/server/commands/recordGoodsOutCommand.ts",
  "src/lib/server/commands/__tests__/recordGoodsOutCommand.test.ts",
  "src/lib/repositories/companySettingsRepository.ts",
  "src/lib/email/deliveryMailTemplate.ts",
  "src/lib/server/__tests__/intakeSuggestions.test.ts",
  "src/test/f1_5_goods_out.integration.test.ts",
  "docs/evidence/f0/W4_CROSS_MODULE_READ_PORT_INVENTORY.json",
  "scripts/quality/f0-verify-http-tests.mjs",
  "src/app/actions/catalog.actions.ts",
  "src/app/actions/search.actions.ts",
  "src/app/api/device-file-changes/route.ts",
  "src/app/orders/OrderCardAppAdapter.tsx",
  "src/app/rein/page.tsx",
  "src/app/settings/SettingsAdminClient.tsx",
  "src/app/settings/__tests__/SettingsAppAdapter.test.tsx",
  "src/app/warendurchlauf/__tests__/f1OrderIntakeActions.test.ts",
  "src/app/warendurchlauf/__tests__/w3StationTenantRead.test.ts",
  "src/components/layout/EntityOverlayStack.tsx",
  "src/lib/orderPositionContract.ts",
  "src/lib/overlayStore.ts",
  "src/lib/server/__tests__/w2cB2m5u.operationalDueTruth.failClosed.test.ts",
  "src/lib/server/authorization.ts",
  "src/lib/server/commands/__tests__/orderContentCommand.test.ts",
  "src/lib/server/commands/orderContentCommand.ts",
  "src/lib/server/orderStationRead.ts",
  "src/modules/katalog/__tests__/catalogServicePort.test.ts",
  "src/modules/katalog/katalog.manifest.json",
  "src/modules/katalog/public.ts",
  "src/modules/katalog/server/catalogServicePort.ts",
  "src/modules/quotes/server/quoteCommands.ts",
  "src/modules/suche/public.ts",
  "src/modules/suche/server/searchTenant.ts",
  "src/modules/suche/suche.manifest.json",
  "src/proxy.ts",
  "src/test/f1_order_intake.integration.test.ts",
  "src/test/h11_action_matrix.integration.test.ts",
  "src/test/h18_masterdata_actions.integration.test.ts",
  "src/test/h18_settings_actions.integration.test.ts",
  "src/test/localReplayStorage.ts",
  "src/ui/kr/Formular.tsx",
  "src/ui/kr/Seitenblatt.tsx",
  "quality/module-gates-baseline.json",
  "src/app/layout.tsx",
  "src/app/telefonnotiz/layout.tsx",
  "src/app/fonts/Inter-latin.woff2",
  "src/modules/orders/__tests__/OrderSurfaces.v8.test.tsx",
  "src/modules/orders/ui/OrderCardView.tsx",
  "e2e/f1-5-goods-out-ui.real.spec.ts",
  "src/lib/pdf/__tests__/ImmutableInvoiceDocument.test.tsx",
  "src/lib/pdf/__tests__/QuoteDocument.test.tsx",
  "src/test/f1_4_immutable_invoice.integration.test.ts",
  "src/test/f1_4_immutable_invoice_contract.integration.test.ts",
  "src/test/f1_5_payment_goods_out_contract.integration.test.ts",
  "src/test/f1_5_set_payment_mode.integration.test.ts",
  "src/test/h18_customer_actions.integration.test.ts",
  "src/test/h18_invoice_actions.integration.test.ts",
  "src/test/h18_order_admin_actions.integration.test.ts",
  "src/test/h18_quote_actions.integration.test.ts",
  "src/test/h18_workshop_actions.integration.test.ts",
  "src/test/search_tenant.integration.test.ts",
  "public/manifest.webmanifest",
  "public/icons/icon-192.png",
  "src/app/actions/communications.actions.ts",
  "src/app/actions/complaints.actions.ts",
  "src/app/actions/customers.actions.ts",
  "src/app/actions/domainAttachments.actions.ts",
  "src/app/actions/timeline.actions.ts",
  "src/app/customers/CustomerCardAppAdapter.tsx",
  "src/app/warendurchlauf/actions.ts",
  "src/components/attachments/DomainAttachmentPanel.tsx",
  "src/components/communication/CommunicationPanel.tsx",
  "src/components/home/OfficeHomeClient.tsx",
  "src/components/intake/CameraCapture.tsx",
  "src/components/layout/F1SourceDialogs.tsx",
  "src/components/layout/PwaRegister.tsx",
  "src/db/schema.ts",
  "src/db/schema_buchhaltung.ts",
  "src/lib/buchhaltung/erechnung/ERechnungParser.ts",
  "src/lib/intakeSuggestionsContract.ts",
  "src/lib/pdf/ImmutableInvoiceDocument.tsx",
  "src/lib/pdf/QuoteDocument.tsx",
  "src/lib/repositories/complaintsRepository.ts",
  "src/lib/server/azureDocumentIntelligence.ts",
  "src/lib/server/commands/immutableInvoiceCommand.ts",
  "src/lib/server/communicationPort.ts",
  "src/lib/server/customerSummaryRead.ts",
  "src/lib/server/documentIntelligencePort.ts",
  "src/lib/server/intakeSuggestions.ts",
  "src/lib/server/intakeTextRecognition.ts",
  "src/lib/server/microsoftGraph.ts",
  "src/lib/server/orderCardRead.ts",
  "src/lib/server/paymentContract.ts",
  "src/lib/server/todayDashboardPolicy.ts",
  "src/lib/types/customer.ts",
  "src/modules/communications/public.ts",
  "src/modules/complaints/public.ts",
  "src/modules/customers/public.ts",
  "src/modules/eingang/public.ts",
  "src/modules/fundament/server/systemSettingsPort.ts",
  "src/modules/supplier-invoices/public.ts",
  "src/modules/tasks/public.ts",
] as const;

describe("Kreile live package scope", () => {
  it("keeps the PR154 contract green while proving the B2 scope contract", () => {
    expect(runSelftest()).toBe(true);
  }, 60_000);

  it("accepts the complete AP-01 diff and every exact B2 path individually", () => {
    expect(checkSalesStageB2ScopeForTest({
      files: [
        "src/modules/eingang/index.ts",
        ...ap01ExactPaths,
      ],
      entries: [{ status: "A", path: "supabase/migrations/20261031212320_ap01_intake_item.sql" }],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toEqual([]);
    for (const file of ap01ExactPaths) {
      expect(checkSalesStageB2ScopeForTest({
        files: [file],
        entries: file.startsWith("supabase/migrations/") ? [{ status: "A", path: file }] : [],
        mission: b2Mission,
        branch: "kreile/b2-eingang",
      }), file).toEqual([]);
    }
  });

  it("accepts only the TA-B2b anchor paths on the pinned main base", () => {
    expect(checkTaB2bScopeForTest({
      files: [
        ".github/workflows/agentur-gate.yml",
        "docs/project/arbeitspakete/TRUST_ANCHOR_B2B.md",
        "docs/project/endversion/codex/BAUPLAN.json",
        "docs/evidence/live-line/b2/TRUST_ANCHOR_B2B.json",
      ],
      mission: b2AnchorMission,
      branch: "codex/ta-b2b",
      baseSha: "ac6c1d2a7eb652dc5e64219a24eed8d4065fbc4e",
    })).toEqual([]);
  });

  it("rejects AP-01's H18 inventory mutation from the TA-B2b anchor itself", () => {
    expect(checkTaB2bScopeForTest({
      files: ["scripts/quality/h18-server-actions.json"],
      mission: b2AnchorMission,
      branch: "codex/ta-b2b",
      baseSha: "ac6c1d2a7eb652dc5e64219a24eed8d4065fbc4e",
    })).toContain("TA_B2B_SCOPE:scripts/quality/h18-server-actions.json");
  });

  it("allows only the TA-B2c anchor paths on its pinned main base", () => {
    expect(checkTaB2cScopeForTest({
      files: [
        "docs/project/arbeitspakete/TRUST_ANCHOR_B2C.md",
        "docs/project/endversion/codex/BAUPLAN.json",
        "docs/evidence/live-line/b2/TRUST_ANCHOR_B2C.json",
      ],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2c",
      baseSha: "11091c0be7b2c58ef7b009d4ad5664ad3e9db01d",
    })).toEqual([]);
    expect(checkTaB2cScopeForTest({
      files: ["src/app/page.tsx"],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2c",
      baseSha: "11091c0be7b2c58ef7b009d4ad5664ad3e9db01d",
    })).toContain("TA_B2C_SCOPE:src/app/page.tsx");
  });

  it("allows only the TA-B2c2 anchor paths and its two exact product paths", () => {
    expect(checkTaB2c2ScopeForTest({
      files: [
        "docs/project/arbeitspakete/TRUST_ANCHOR_B2C2.md",
        "docs/evidence/live-line/b2/TRUST_ANCHOR_B2C2.json",
      ],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2c2",
      baseSha: "8e1e03f567278d24d5f3a468f6cbef3729db96b9",
    })).toEqual([]);
    expect(checkTaB2c2ScopeForTest({
      files: ["src/app/page.tsx"],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2c2",
      baseSha: "8e1e03f567278d24d5f3a468f6cbef3729db96b9",
    })).toContain("TA_B2C2_SCOPE:src/app/page.tsx");
    for (const path of [
      "src/lib/server/commands/orderIntakeCommand.ts",
      "src/lib/server/commands/__tests__/orderIntakeCommand.test.ts",
    ]) {
      expect(checkSalesStageB2ScopeForTest({ files: [path], mission: b2Mission, branch: "kreile/b2-eingang" }), path).toEqual([]);
    }
    const adjacent = "src/lib/server/commands/quoteCommand.ts";
    expect(checkSalesStageB2ScopeForTest({ files: [adjacent], mission: b2Mission, branch: "kreile/b2-eingang" }))
      .toContain(`SALES_STAGE_B2_SCOPE:${adjacent}`);
  });

  it("allows only the TA-B2c3 anchor paths and its two exact receipt-read paths", () => {
    expect(checkTaB2c3ScopeForTest({
      files: [
        "docs/project/arbeitspakete/TRUST_ANCHOR_B2C3.md",
        "docs/evidence/live-line/b2/TRUST_ANCHOR_B2C3.json",
      ],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2c3",
      baseSha: "8d5dd1fc7af5509898a317ef4f42087df052685a",
    })).toEqual([]);
    expect(checkTaB2c3ScopeForTest({
      files: ["src/app/page.tsx"],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2c3",
      baseSha: "8d5dd1fc7af5509898a317ef4f42087df052685a",
    })).toContain("TA_B2C3_SCOPE:src/app/page.tsx");
    for (const path of [
      "src/lib/server/orderIntakeRead.ts",
      "src/lib/server/__tests__/orderIntakeRead.test.ts",
    ]) {
      expect(checkSalesStageB2ScopeForTest({ files: [path], mission: b2Mission, branch: "kreile/b2-eingang" }), path).toEqual([]);
    }
    const adjacent = "src/lib/server/quoteRead.ts";
    expect(checkSalesStageB2ScopeForTest({ files: [adjacent], mission: b2Mission, branch: "kreile/b2-eingang" }))
      .toContain(`SALES_STAGE_B2_SCOPE:${adjacent}`);
  });

  it("allows only the TA-B2d2 anchor paths on its pinned main base", () => {
    expect(checkTaB2d2ScopeForTest({
      files: [
        ".github/workflows/agentur-gate.yml",
        "docs/project/arbeitspakete/TRUST_ANCHOR_B2D2.md",
        "docs/project/endversion/codex/BAUPLAN.json",
        "docs/evidence/live-line/b2/TRUST_ANCHOR_B2D2.json",
      ],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2d2",
      baseSha: "b364f569524a636a1aceefac0fb1934f7f24f556",
    })).toEqual([]);
    expect(checkTaB2d2ScopeForTest({
      files: ["src/app/page.tsx"],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2d2",
      baseSha: "b364f569524a636a1aceefac0fb1934f7f24f556",
    })).toContain("TA_B2D2_SCOPE:src/app/page.tsx");
  });

  it("allows only the TA-B2e anchor paths and the exact new AP-R migration", () => {
    expect(checkTaB2eScopeForTest({
      files: [
        "docs/project/arbeitspakete/TRUST_ANCHOR_B2E.md",
        "docs/evidence/live-line/b2/TRUST_ANCHOR_B2E.json",
      ],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2e",
      baseSha: "10be0a0326a2ef003fe4a6d30cdc1f484086ceb3",
    })).toEqual([]);
    expect(checkTaB2eScopeForTest({
      files: ["src/app/page.tsx"],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2e",
      baseSha: "10be0a0326a2ef003fe4a6d30cdc1f484086ceb3",
    })).toContain("TA_B2E_SCOPE:src/app/page.tsx");

    for (const path of [
      "src/lib/server/orderCardRead.ts",
      "src/lib/server/__tests__/orderCardRead.test.ts",
      "src/app/layout.tsx",
      "src/app/telefonnotiz/layout.tsx",
      "src/app/fonts/localFonts.ts",
      "src/app/fonts/fraunces-latin-variable.woff2",
      "quality/module-gates-baseline.json",
      "src/modules/orders/__tests__/OrderSurfaces.v8.test.tsx",
      "src/modules/orders/ui/OrderCardView.tsx",
    ]) {
      expect(checkSalesStageB2ScopeForTest({
        files: [path],
        mission: b2Mission,
        branch: "kreile/b2-eingang",
      }), path).toEqual([]);
    }
    const adjacentOrderCardPath = "src/lib/server/orderCardWrite.ts";
    expect(checkSalesStageB2ScopeForTest({
      files: [adjacentOrderCardPath],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toContain(`SALES_STAGE_B2_SCOPE:${adjacentOrderCardPath}`);
    const adjacentFontPath = "src/app/font-cache/localFonts.ts";
    expect(checkSalesStageB2ScopeForTest({
      files: [adjacentFontPath],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toContain(`SALES_STAGE_B2_SCOPE:${adjacentFontPath}`);
    const adjacentBaselinePath = "quality/other-module-gates-baseline.json";
    expect(checkSalesStageB2ScopeForTest({
      files: [adjacentBaselinePath],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toContain(`SALES_STAGE_B2_SCOPE:${adjacentBaselinePath}`);
    const adjacentOrderUiPath = "src/modules/orders/ui/OrderListView.tsx";
    expect(checkSalesStageB2ScopeForTest({
      files: [adjacentOrderUiPath],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toContain(`SALES_STAGE_B2_SCOPE:${adjacentOrderUiPath}`);

    const migration = "supabase/migrations/20261103010000_ap_r_freitext_einheiten.sql";
    expect(checkSalesStageB2ScopeForTest({
      files: [migration],
      entries: [{ status: "A", path: migration }],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toEqual([]);
    expect(checkSalesStageB2ScopeForTest({
      files: [migration],
      entries: [{ status: "M", path: migration }],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toContain(`SALES_STAGE_B2_MIGRATION_NOT_NEW:${migration}`);
    const adjacent = "supabase/migrations/20261103010000_ap_r_other.sql";
    expect(checkSalesStageB2ScopeForTest({
      files: [adjacent],
      entries: [{ status: "A", path: adjacent }],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toEqual(expect.arrayContaining([
      `SALES_STAGE_B2_SCOPE:${adjacent}`,
      `SALES_STAGE_B2_MIGRATION_INVALID:${adjacent}`,
    ]));
  });

  it("allows only the TA-B2f anchor paths on its pinned main base", () => {
    expect(checkTaB2fScopeForTest({
      files: [
        ".gitattributes",
        ".github/workflows/agentur-gate.yml",
        "docs/project/arbeitspakete/TRUST_ANCHOR_B2F.md",
        ".github/workflows/eslint-ratchet.yml",
        "eslint.config.mjs",
        "scripts/quality/check-authoritative-sources.mjs",
        "scripts/spec/generate-flow-tests.mjs",
        "docs/project/endversion/ui/endversion_design.css",
        "docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json",
        "docs/project/endversion/codex/BAUPLAN.json",
        "docs/evidence/live-line/b2/TRUST_ANCHOR_B2F.json",
      ],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2f",
      baseSha: "06e56daae267e49a7e23a5c40a70fbbef21b8cb8",
    })).toEqual([]);
    expect(checkTaB2fScopeForTest({
      files: ["src/app/page.tsx"],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2f",
      baseSha: "06e56daae267e49a7e23a5c40a70fbbef21b8cb8",
    })).toContain("TA_B2F_SCOPE:src/app/page.tsx");
    expect(checkTaB2fScopeForTest({
      files: ["docs/project/endversion/codex/BAUPLAN.json"],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2f",
      baseSha: "06e56daae267e49a7e23a5c40a70fbbef21b8cb8",
    })).toEqual([]);
    expect(checkSalesStageB2ScopeForTest({
      files: ["docs/project/endversion/codex/BAUPLAN.json"],
      mission: b2Mission,
      branch: "kreile/b2-ein-2",
    })).toContain("SALES_STAGE_B2_SCOPE:docs/project/endversion/codex/BAUPLAN.json");
    expect(checkSalesStageB2ScopeForTest({
      files: [".gitattributes"],
      mission: b2Mission,
      branch: "kreile/b2-ein-2",
    })).toContain("SALES_STAGE_B2_SCOPE:.gitattributes");
  });

  it("accepts the complete AP-EIN inventory and only one additive migration per part", () => {
    for (const file of apEinInventoryPaths) {
      expect(checkSalesStageB2ScopeForTest({
        files: [file],
        mission: b2Mission,
        branch: "kreile/b2-ein-1",
      }), file).toEqual([]);
    }
    for (const file of [
      "supabase/migrations/20261103020000_b2_kunde_k1.sql",
      "supabase/migrations/20261103025000_ein1_kunde_schreibweg.sql",
      "supabase/migrations/20261103030000_ein2_erfassung.sql",
      "supabase/migrations/20261103040000_ein3_ware_original.sql",
      "supabase/migrations/20261103050000_ein4_nachrichten.sql",
      "supabase/migrations/20261103060000_ein5_eingangsrechnungen.sql",
      "supabase/migrations/20261103070000_ein6_korrekturen.sql",
    ]) {
      expect(checkSalesStageB2ScopeForTest({
        files: [file],
        entries: [{ status: "A", path: file }],
        mission: b2Mission,
        branch: "kreile/b2-ein-2",
      }), file).toEqual([]);
    }
    const adjacent = "src/modules/inventory/public.ts";
    expect(checkSalesStageB2ScopeForTest({ files: [adjacent], mission: b2Mission, branch: "kreile/b2-ein-2" }))
      .toContain(`SALES_STAGE_B2_SCOPE:${adjacent}`);
  });

  it("permits the frozen UI foundation paths, but never immutable UI sources in product PRs", () => {
    for (const branch of ["kreile/b2-ein-0b", "kreile/b2-ein-6"]) {
      for (const file of ["src/app/globals.css", "src/styles/tokens.css", "src/styles/mock/mock-kreile-compat.css", "src/ui/kr/Dialog.tsx", "docs/project/endversion/ui/routen.json"]) {
        expect(checkSalesStageB2ScopeForTest({files:[file],mission:b2Mission,branch}), branch + ":" + file).toEqual([]);
      }
      for (const file of ["docs/project/endversion/ui/endversion_design.css", "docs/project/endversion/ui/SICHTVERTRAG.json", "docs/project/endversion/ui/pruefe_sicht.cjs"]) {
        expect(checkSalesStageB2ScopeForTest({files:[file],mission:b2Mission,branch})).toContain("SALES_STAGE_B2_SCOPE:" + file);
      }
    }
  });

  it("accepts stacked parts but rejects a second migration in every individual part", () => {
    const files = ["supabase/migrations/20261103020000_b2_kunde_k1.sql",
      ...[0, 1, 2, 3, 4, 5, 6].map(part => "supabase/migrations/20261103030000_ein" + part + "_teil.sql")];
    expect(checkSalesStageB2ScopeForTest({files,entries:files.map(path=>({status:"A",path})),mission:b2Mission,branch:"kreile/b2-ein-5"})).toEqual([]);
    for (const part of [0, 1, 2, 3, 4, 5, 6]) {
      const duplicate = ["supabase/migrations/20261103030001_ein" + part + "_a.sql", "supabase/migrations/20261103030002_ein" + part + "_b.sql"];
      expect(checkSalesStageB2ScopeForTest({files:duplicate,entries:duplicate.map(path=>({status:"A",path})),mission:b2Mission,branch:"kreile/b2-ein-5"})).toContain("SALES_STAGE_B2_MIGRATION_COUNT:2");
    }
  });

  it("accepts every AP-G/AP-R candidate path and no adjacent product path", () => {
    expect(checkSalesStageB2ScopeForTest({
      files: [...apgAprExactPaths],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toEqual([]);
    for (const file of apgAprExactPaths) {
      expect(checkSalesStageB2ScopeForTest({
        files: [file],
        mission: b2Mission,
        branch: "kreile/b2-eingang",
      }), file).toEqual([]);
    }
    const adjacent = "src/components/layout/UnknownLayout.tsx";
    expect(checkSalesStageB2ScopeForTest({
      files: [adjacent],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toContain(`SALES_STAGE_B2_SCOPE:${adjacent}`);
  });

  it("allows the narrow AP acceptance and delivery patterns only", () => {
    for (const path of [
      "src/test/acceptance/ap01b_eingang_bestandskunde_unvollstaendig.integration.test.ts",
      "docs/delivery/ABGABE_AP-K1.md",
    ]) {
      expect(checkSalesStageB2ScopeForTest({ files: [path], mission: b2Mission, branch: "kreile/b2-eingang" }), path).toEqual([]);
    }
    for (const path of [
      "src/test/acceptance/x.test.ts",
      "src/test/x.integration.test.ts",
      "docs/delivery/ABGABE_B3.md",
      "docs/project/endversion/codex/BAUPLAN.json",
    ]) {
      expect(checkSalesStageB2ScopeForTest({ files: [path], mission: b2Mission, branch: "kreile/b2-eingang" }), path)
        .toContain(`SALES_STAGE_B2_SCOPE:${path}`);
    }
  });

  it("rejects paths outside B2 and the former B1 branch", () => {
    expect(checkSalesStageB2ScopeForTest({
      files: ["src/modules/orders/server/get.ts"],
      mission: b2Mission,
      branch: "kreile/b1-shell",
    })).toEqual(expect.arrayContaining([
      "SALES_STAGE_BRANCH_INVALID:kreile/b1-shell",
      "SALES_STAGE_B2_SCOPE:src/modules/orders/server/get.ts",
    ]));
  });

  it("rejects a second or changed AP-01 migration", () => {
    const first = "supabase/migrations/20261031212320_ap01_intake_item.sql";
    const second = "supabase/migrations/20261102080100_ap01_intake_item.sql";
    expect(checkSalesStageB2ScopeForTest({
      files: [first, second],
      entries: [{ status: "A", path: first }, { status: "A", path: second }],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toContain("SALES_STAGE_B2_MIGRATION_COUNT:2");
    expect(checkSalesStageB2ScopeForTest({
      files: [first],
      entries: [{ status: "M", path: first }],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toContain(`SALES_STAGE_B2_MIGRATION_NOT_NEW:${first}`);
  });
});
