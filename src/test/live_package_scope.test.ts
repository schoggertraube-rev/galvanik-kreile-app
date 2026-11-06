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
  checkTaB2hScopeForTest,
  checkTaB2iScopeForTest,
  checkTaB2jScopeForTest,
  checkTaB2k1ScopeForTest,
  checkTaB2k1bScopeForTest,
  checkTaB2k2ScopeForTest,
  checkB2iParserChangesForTest,
  checkTaB2fBaselineChangeForTest,
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

describe("P59 TA-B2j: AP-EIN paths and additive migrations", () => {
  const branch = "codex/ta-b2j";
  const baseSha = "27c3435474e5cec4d1241bf75a646a895edc1e91";
  const files = ["scripts/quality/check-live-package-scope.mjs", "src/test/live_package_scope.test.ts",
    "docs/evidence/live-line/b2/TRUST_ANCHOR_B2J.json", "docs/delivery/ABGABE_TA-B2J.md"];
  it("restricts the anchor to its four files, exact branch and main base", () => {
    expect(checkTaB2jScopeForTest({files, mission:b2AnchorMission, branch, baseSha})).toEqual([]);
    expect(checkTaB2jScopeForTest({files:[...files,"src/app/page.tsx"], mission:b2AnchorMission, branch, baseSha})).toContain("TA_B2J_SCOPE:src/app/page.tsx");
    expect(checkTaB2jScopeForTest({files, mission:b2AnchorMission, branch:"codex/other", baseSha})).toContain("TA_B2J_BRANCH_INVALID:codex/other");
    expect(checkTaB2jScopeForTest({files, mission:b2AnchorMission, branch, baseSha:"wrong"})).toContain(`TA_B2J_BASE_INVALID:wrong:${baseSha}`);
  });
  it("covers the inventoried modules, routes and original attachment and quote readers", () => {
    const allowed = ["src/modules/quotes/server/quoteReads.ts", "src/modules/orders/ui/OrderCardView.tsx", "src/modules/werkstatt/ui/WerkstattView.tsx",
      "src/modules/fundament/server/systemSettingsPort.ts", "src/app/nachrichten/page.tsx", "src/app/rein/page.tsx", "src/app/customers/page.tsx", "src/app/orders/page.tsx", "src/app/angebote/page.tsx", "src/app/quotes/page.tsx", "src/app/warendurchlauf/page.tsx", "src/app/settings/page.tsx", "src/app/telefonnotiz/layout.tsx", "src/app/buchhaltung/belege/BelegeClient.tsx", "src/components/warenausgang/WarenausgangQueue.tsx", "src/app/api/eingang-share/route.ts",
      "src/lib/server/commands/quoteCommand.ts", "src/lib/server/commands/__tests__/quoteCommand.test.ts", "src/lib/server/domainAttachment.ts", "src/lib/server/__tests__/domainAttachment.test.ts", "src/lib/server/evidenceRead.ts", "src/lib/server/__tests__/evidenceRead.test.ts", "src/lib/domain/workingDays.ts", "src/components/start/StartScreenClient.tsx"];
    for (const file of allowed) expect(checkSalesStageB2ScopeForTest({files:[file], mission:b2Mission, branch:"kreile/b2-ein-3"}), file).toEqual([]);
    for (const file of ["src/modules/inventory/public.ts", "src/lib/server/other.ts", "src/app/actions/start.other.ts", "src/components/start/StartScreenOther.tsx", ".github/workflows/quality.yml"])
      expect(checkSalesStageB2ScopeForTest({files:[file], mission:b2Mission, branch:"kreile/b2-ein-3"}), file).toContain(`SALES_STAGE_B2_SCOPE:${file}`);
  });
  it("permits multiple new files but rejects modified or invalid migrations", () => {
    const files = ["supabase/migrations/20261104000000_ein3_a.sql", "supabase/migrations/20261104000001_ein3_b.sql", "supabase/migrations/20261104000002_ein3c_original.sql"];
    expect(checkSalesStageB2ScopeForTest({files, entries:files.map(path=>({status:"A",path})), mission:b2Mission, branch:"kreile/b2-ein-3"})).toEqual([]);
    expect(checkSalesStageB2ScopeForTest({files:[files[0]],entries:[{status:"M",path:files[0]}],mission:b2Mission,branch:"kreile/b2-ein-3"})).toContain(`SALES_STAGE_B2_MIGRATION_NOT_NEW:${files[0]}`);
    const invalid = "supabase/migrations/20261104000000_ein7_other.sql";
    expect(checkSalesStageB2ScopeForTest({files:[invalid],entries:[{status:"A",path:invalid}],mission:b2Mission,branch:"kreile/b2-ein-3"})).toContain(`SALES_STAGE_B2_MIGRATION_INVALID:${invalid}`);
  });
  it("accepts the authorized B2 follow-up branch family but rejects malformed branch names", () => {
    const files = ["src/modules/quotes/server/quoteCommands.ts"];
    expect(checkSalesStageB2ScopeForTest({files, mission:b2Mission, branch:"kreile/b2-ein-2b"})).toEqual([]);
    expect(checkSalesStageB2ScopeForTest({files, mission:b2Mission, branch:"kreile/b2-ein-2c"})).toEqual([]);
    expect(checkSalesStageB2ScopeForTest({files, mission:b2Mission, branch:"kreile/b2-ein_2c"})).toContain("SALES_STAGE_BRANCH_INVALID:kreile/b2-ein_2c");
  });
});

describe("P68 TA-B2k1: only the exact Druck- and Nacharbeit paths", () => {
  const branch = "codex/ta-b2k1";
  const baseSha = "ce762422266089d694a12a94fe2129095003e82e";
  const files = ["scripts/quality/check-live-package-scope.mjs", "src/test/live_package_scope.test.ts",
    "docs/evidence/live-line/b2/TRUST_ANCHOR_B2K1.json", "docs/delivery/ABGABE_TA-B2K1.md"];
  const allowedProductPaths = [
    "src/lib/server/commands/__tests__/orderStationCommand.test.ts",
    "src/app/actions/pdf.actions.ts",
    "src/lib/pdf/OrderLabel.tsx",
    "src/lib/pdf/__tests__/w2cB2m5u.orderLabelDateTruth.test.tsx",
    "src/modules/orders/server/reworkOrderCommand.ts",
    "src/modules/orders/server/__tests__/reworkOrderCommand.test.ts",
    "src/modules/orders/server-public.ts",
    "src/modules/orders/orders.manifest.json",
  ];
  it("restricts the anchor to its four files, exact branch and merged #168 base", () => {
    expect(checkTaB2k1ScopeForTest({ files, mission: b2AnchorMission, branch, baseSha })).toEqual([]);
    expect(checkTaB2k1ScopeForTest({ files: [...files, "docs/project/endversion/codex/BAUPLAN.json"], mission: b2AnchorMission, branch, baseSha }))
      .toContain("TA_B2K1_SCOPE:docs/project/endversion/codex/BAUPLAN.json");
    expect(checkTaB2k1ScopeForTest({ files, mission: b2AnchorMission, branch: "codex/other", baseSha }))
      .toContain("TA_B2K1_BRANCH_INVALID:codex/other");
    expect(checkTaB2k1ScopeForTest({ files, mission: b2AnchorMission, branch, baseSha: "wrong" }))
      .toContain(`TA_B2K1_BASE_INVALID:wrong:${baseSha}`);
  });
  it("permits only the P68 follow-up paths and rejects an adjacent order path", () => {
    for (const path of allowedProductPaths) {
      expect(checkSalesStageB2ScopeForTest({ files: [path], mission: b2Mission, branch: "kreile/b2-ein-3" }), path).toEqual([]);
    }
    const adjacent = "src/app/actions/pdf-other.actions.ts";
    expect(checkSalesStageB2ScopeForTest({ files: [adjacent], mission: b2Mission, branch: "kreile/b2-ein-3" }))
      .toContain(`SALES_STAGE_B2_SCOPE:${adjacent}`);
  });
});

describe("P78 TA-B2k1b: only the exact shell-smoke path", () => {
  const branch = "codex/ta-b2k1b";
  const baseSha = "5e9d5f4626f88f321982866686b4536ad47377a4";
  const files = ["scripts/quality/check-live-package-scope.mjs", "src/test/live_package_scope.test.ts",
    "docs/evidence/live-line/b2/TRUST_ANCHOR_B2K1B.json", "docs/delivery/ABGABE_TA-B2K1B.md"];
  const allowedProductPath = "e2e/path1-v5-shell-smoke.real.spec.ts";
  it("restricts the anchor to its four files, exact branch and current main base", () => {
    expect(checkTaB2k1bScopeForTest({ files, mission: b2AnchorMission, branch, baseSha })).toEqual([]);
    expect(checkTaB2k1bScopeForTest({ files: [...files, "docs/project/endversion/codex/BAUPLAN.json"], mission: b2AnchorMission, branch, baseSha }))
      .toContain("TA_B2K1B_SCOPE:docs/project/endversion/codex/BAUPLAN.json");
    expect(checkTaB2k1bScopeForTest({ files, mission: b2AnchorMission, branch: "codex/other", baseSha }))
      .toContain("TA_B2K1B_BRANCH_INVALID:codex/other");
    expect(checkTaB2k1bScopeForTest({ files, mission: b2AnchorMission, branch, baseSha: "wrong" }))
      .toContain(`TA_B2K1B_BASE_INVALID:wrong:${baseSha}`);
  });
  it("permits the /nachrichten shell-smoke assertion and rejects its adjacent path", () => {
    expect(checkSalesStageB2ScopeForTest({ files: [allowedProductPath], mission: b2Mission, branch: "kreile/b2-ein-6" })).toEqual([]);
    const adjacent = "e2e/path1-v5-shell-smoke-other.real.spec.ts";
    expect(checkSalesStageB2ScopeForTest({ files: [adjacent], mission: b2Mission, branch: "kreile/b2-ein-6" }))
      .toContain(`SALES_STAGE_B2_SCOPE:${adjacent}`);
  });
});

describe("P76 TA-B2k2: Runde-53 binding and AP-ABS path boundary", () => {
  const branch = "codex/ta-b2k2";
  const baseSha = "4593e8f6eaa3215033898a53d4168581b5bfc4c8";
  const files = [
    "scripts/quality/check-live-package-scope.mjs",
    "src/test/live_package_scope.test.ts",
    "docs/project/arbeitspakete/TRUST_ANCHOR_B2K2.md",
    "docs/evidence/live-line/b2/TRUST_ANCHOR_B2K2.json",
    "docs/delivery/ABGABE_TA-B2K2.md",
    "docs/project/endversion/codex/BAUPLAN.json",
    "e2e/generated/absprache.flow.spec.ts",
  ];

  it("restricts the anchor to the bound source set and provisional Teil-6 base", () => {
    expect(checkTaB2k2ScopeForTest({ files, mission: b2AnchorMission, branch, baseSha })).toEqual([]);
    expect(checkTaB2k2ScopeForTest({
      files: [...files, "src/app/page.tsx"],
      mission: b2AnchorMission,
      branch,
      baseSha,
    })).toContain("TA_B2K2_SCOPE:src/app/page.tsx");
    expect(checkTaB2k2ScopeForTest({ files, mission: b2AnchorMission, branch: "codex/other", baseSha }))
      .toContain("TA_B2K2_BRANCH_INVALID:codex/other");
    expect(checkTaB2k2ScopeForTest({ files, mission: b2AnchorMission, branch, baseSha: "wrong" }))
      .toContain("TA_B2K2_BASE_INVALID:wrong:" + baseSha);
  });

  it("allows only the new AP-ABS reader, migration family and designated b3 branch", () => {
    const migration = "supabase/migrations/20261106013106_abs_absprachen.sql";
    expect(checkSalesStageB2ScopeForTest({
      files: ["src/lib/server/effectiveCustomerAgreementRead.ts", migration],
      entries: [{ status: "A", path: migration }],
      mission: b2Mission,
      branch: "kreile/b3-abs",
    })).toEqual([]);
    expect(checkSalesStageB2ScopeForTest({
      files: ["src/lib/server/effectiveCustomerAgreementWrite.ts"],
      mission: b2Mission,
      branch: "kreile/b3-abs",
    })).toContain("SALES_STAGE_B2_SCOPE:src/lib/server/effectiveCustomerAgreementWrite.ts");
    expect(checkSalesStageB2ScopeForTest({
      files: ["src/lib/server/effectiveCustomerAgreementRead.ts"],
      mission: b2Mission,
      branch: "kreile/b3b-abs",
    })).toContain("SALES_STAGE_BRANCH_INVALID:kreile/b3b-abs");
  });
});

describe("P55 TA-B2i: only the specified migration pairs and XML dependency", () => {
  const branch = "codex/ta-b2i";
  const baseSha = "7c475a72a582b412a95d73224e5a94581aa7b377";
  const files = ["scripts/quality/check-live-package-scope.mjs", "src/test/live_package_scope.test.ts",
    "docs/evidence/live-line/b2/TRUST_ANCHOR_B2I.json", "docs/delivery/ABGABE_TA-B2I.md"];
  const scope = (paths: string[]) => checkSalesStageB2ScopeForTest({
    files: paths, entries: paths.map((path) => ({ status: "A", path })), mission: b2Mission, branch: "kreile/b2-ein-6",
  });
  it("restricts the anchor to its exact files, branch and base", () => {
    expect(checkTaB2iScopeForTest({ files, mission: b2AnchorMission, branch, baseSha })).toEqual([]);
    expect(checkTaB2iScopeForTest({ files: [...files, "package.json"], mission: b2AnchorMission, branch, baseSha })).toContain("TA_B2I_SCOPE:package.json");
    expect(checkTaB2iScopeForTest({ files, mission: b2AnchorMission, branch: "codex/other", baseSha })).toContain("TA_B2I_BRANCH_INVALID:codex/other");
    expect(checkTaB2iScopeForTest({ files, mission: b2AnchorMission, branch, baseSha: "wrong" })).toContain(`TA_B2I_BASE_INVALID:wrong:${baseSha}`);
  });
  it("accepts additive AP-EIN migrations under the later P59 authorization", () => {
    const m = (name: string) => `supabase/migrations/20261104000000_${name}.sql`;
    expect(scope([m("ein2_main"), m("ein2_fotoart"), m("ein4_main"), m("ein4_rechte")])).toEqual([]);
    expect(scope([m("ein2_main"), m("ein2_other")])).toEqual([]);
    expect(scope([m("ein4_main"), m("ein4_other")])).toEqual([]);
    expect(scope([m("ein4_main"), m("ein4_rechte"), m("ein4_third")])).toEqual([]);
    expect(scope([m("ein3_main"), m("ein3_other")])).toEqual([]);
  });
  it("allows exactly the two P56 PIN-reset paths without neighboring paths", () => {
    for (const rel of ["src/app/actions/start.actions.ts", "src/app/actions/__tests__/publicStartActions.test.ts"]) expect(scope([rel])).toEqual([]);
    for (const rel of ["src/app/actions/start.other.ts", "src/app/actions/__tests__/publicStartActions.other.test.ts"]) expect(scope([rel])).toContain(`SALES_STAGE_B2_SCOPE:${rel}`);
  });
  it("allows only an exact pinned parser and its lockfile dependency closure", () => {
    const beforePackage = { name: "example", dependencies: { existing: "1.0.0" } };
    const afterPackage = { name: "example", dependencies: { existing: "1.0.0", "fast-xml-parser": "5.12.0" } };
    const beforeLock = { lockfileVersion: 3, packages: { "": { dependencies: { existing: "1.0.0" } }, "node_modules/existing": { version: "1.0.0" } } };
    const afterLock = { lockfileVersion: 3, packages: { "": { dependencies: { existing: "1.0.0", "fast-xml-parser": "5.12.0" } },
      "node_modules/existing": { version: "1.0.0" }, "node_modules/fast-xml-parser": { version: "5.12.0", dependencies: { child: "1.0.0" } },
      "node_modules/child": { version: "1.0.0" } } };
    const input = { beforePackage, afterPackage, beforeLock, afterLock };
    expect(checkB2iParserChangesForTest(input)).toEqual([]);
    expect(checkB2iParserChangesForTest({ ...input, afterPackage: { ...afterPackage, dependencies: { ...afterPackage.dependencies, evil: "1.0.0" } } })).toContain("B2I_PACKAGE_UNRELATED_CHANGE");
    expect(checkB2iParserChangesForTest({ ...input, afterPackage: { ...afterPackage, dependencies: { ...afterPackage.dependencies, "fast-xml-parser": "^5.12.0" } } })).toContain("B2I_XML_VERSION_NOT_PINNED");
    expect(checkB2iParserChangesForTest({ ...input, afterLock: { ...afterLock, packages: { ...afterLock.packages, "node_modules/evil": { version: "1.0.0" } } } })).toContain("B2I_LOCK_UNRELATED_ADDITION:node_modules/evil");
  });
});

describe("P44/P47/P52 TA-B2h: exact Web-Share, messages and What is new paths", () => {
  const branch = "codex/ta-b2h";
  const baseSha = "b6d94bccad812883cddaefa1d050c1506c722d8b";
  const files = ["scripts/quality/check-live-package-scope.mjs", "src/test/live_package_scope.test.ts",
    "docs/evidence/live-line/b2/TRUST_ANCHOR_B2H.json", "docs/delivery/ABGABE_TA-B2H.md"];

  it("allows the four anchor files on exactly the approved main and branch", () => {
    expect(checkTaB2hScopeForTest({files,mission:b2AnchorMission,branch,baseSha})).toEqual([]);
    expect(checkTaB2hScopeForTest({files,mission:b2AnchorMission,branch:"codex/ta-b2h-other",baseSha}))
      .toContain("TA_B2H_BRANCH_INVALID:codex/ta-b2h-other");
    expect(checkTaB2hScopeForTest({files,mission:b2AnchorMission,branch,baseSha:"wrong"}))
      .toContain("TA_B2H_BASE_INVALID:wrong:" + baseSha);
    expect(checkTaB2hScopeForTest({files,mission:{...b2AnchorMission,active_block:"B3"},branch,baseSha}))
      .toContain("TA_B2H_MISSION_INVALID");
  });

  it("never carries product, migration, provider, workflow or baseline changes in the anchor", () => {
    for(const path of ["src/app/api/eingang-share/route.ts", "src/app/nachrichten/page.tsx", "src/test/nachrichten_page.integration.test.ts", "src/app/page.tsx", "quality/eslint-baseline.json",
      ".github/workflows/quality.yml", "docs/project/endversion/codex/BAUPLAN.json", "supabase/migrations/20261104000000_ein3_extra.sql"]){
      expect(checkTaB2hScopeForTest({files:[...files,path],mission:b2AnchorMission,branch,baseSha}),path)
        .toContain("TA_B2H_SCOPE:" + path);
    }
  });

  it("allows each exact P52 file but denies neighboring content, authentication and containment paths", () => {
    for(const path of ["src/lib/server/authBootstrap.ts","src/lib/server/__tests__/authBootstrap.test.ts","src/components/layout/WasIstNeu.tsx","src/components/layout/__tests__/WasIstNeu.test.tsx","src/content/was-ist-neu.json","src/app/buchhaltung/__tests__/w2c.activeRouteContainment.test.tsx"]){
      expect(checkSalesStageB2ScopeForTest({files:[path],mission:b2Mission,branch:"kreile/b2-ein-0"}),path).toEqual([]);
    }
    for(const path of ["src/content/other.json","src/components/layout/WasIstNeuOther.tsx","src/components/layout/__tests__/WasIstNeuOther.test.tsx","src/lib/server/otherBootstrap.ts","src/lib/server/__tests__/otherBootstrap.test.ts","src/app/buchhaltung/__tests__/otherContainment.test.tsx"]){
      expect(checkSalesStageB2ScopeForTest({files:[path],mission:b2Mission,branch:"kreile/b2-ein-0"}),path).toContain("SALES_STAGE_B2_SCOPE:"+path);
    }
  });

  it("allows the P59 route directories while rejecting neighboring routes and tests", () => {
    for(const path of ["src/app/api/eingang-share/route.ts", "src/test/eingang_share.integration.test.ts", "src/app/nachrichten/page.tsx", "src/test/nachrichten_page.integration.test.ts"]){
      expect(checkSalesStageB2ScopeForTest({files:[path],mission:b2Mission,branch:"kreile/b2-ein-3"}),path).toEqual([]);
    }
    for(const path of ["src/app/api/eingang-share-extra/route.ts", "src/test/eingang_share_extra.integration.test.ts", "src/app/nachrichten-extra/page.tsx", "src/test/nachrichten_page_extra.integration.test.ts"]){
      expect(checkSalesStageB2ScopeForTest({files:[path],mission:b2Mission,branch:"kreile/b2-ein-3"}),path)
        .toContain("SALES_STAGE_B2_SCOPE:" + path);
    }
  });
});

const ap01ExactPaths = [
  "docs/delivery/ABGABE_AP-01.md",
  "docs/evidence/f1/F1_R0_CAPABILITY_REGISTRY.json",
  "e2e/f1-4-immutable-invoice.real.spec.ts",
  "e2e/path1-ui-convergence-v5-global-create.spec.ts",
  "e2e/path1-ui-convergence-v5-p3.real.spec.ts",
  "e2e/path1-v5-shell-smoke.real.spec.ts",
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
    const adjacent = "src/lib/server/commands/unrelatedBillingCommand.ts";
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
    const adjacentOrderUiPath = "src/modules/inventory/ui/InventoryListView.tsx";
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

  it("accepts each exact Runde 52 inventory path and rejects its adjacent file", () => {
    for (const path of [
      "src/app/actions/settings.actions.ts",
      "src/app/warendurchlauf/page.tsx",
      "src/lib/server/commands/orderStationCommand.ts",
      "src/lib/server/goodsReceiptOrderPort.ts",
      "src/lib/server/intakeDraftEvents.ts",
      "src/lib/server/intakeOriginalAudit.ts",
      "src/lib/types/operationalOrder.ts",
      "src/modules/fundament/fundament.manifest.json",
      "src/modules/fundament/server-public.ts",
      "src/modules/quotes/__tests__/quoteCommands.test.ts",
      "src/modules/quotes/server/types.ts",
      "src/test/f1_3_live_card.integration.test.ts"
]) {
      expect(checkSalesStageB2ScopeForTest({files:[path],mission:b2Mission,branch:"kreile/b2-ein-3"}),path).toEqual([]);
      const adjacent = path.replace(/\.tsx?$/, ".outside.ts").replace(/\.json$/, ".outside.json");
      if (path.startsWith("src/app/warendurchlauf/") || path.startsWith("src/modules/quotes/") || path.startsWith("src/modules/fundament/")) {
        expect(checkSalesStageB2ScopeForTest({files:[adjacent],mission:b2Mission,branch:"kreile/b2-ein-3"}),adjacent).toEqual([]);
      } else {
        expect(checkSalesStageB2ScopeForTest({files:[adjacent],mission:b2Mission,branch:"kreile/b2-ein-3"}),adjacent).toContain(`SALES_STAGE_B2_SCOPE:${adjacent}`);
      }
    }
    expect(checkSalesStageB2ScopeForTest({files:["eslint.config.mjs"],mission:b2Mission,branch:"kreile/b2-ein-3"})).toContain("SALES_STAGE_B2_SCOPE:eslint.config.mjs");
  });

  it("allows only the P42 judge hash replacement and rejects every other baseline byte", () => {
    const before = JSON.stringify({ judgeContractHash: "d322170885867420ca489927b5ad52522206e06009c5afb619d5159d4147752b", lintContractHash: "unchanged", issues: [], ignoredCodeFiles: [] }, null, 2) + "\n";
    const after = before.replace("d322170885867420ca489927b5ad52522206e06009c5afb619d5159d4147752b", "f02832e8e3da8367b3604c5f356b6df95fe61310a2c24d04d5b8105b582aab88");
    expect(checkTaB2fBaselineChangeForTest({before,after})).toEqual([]);
    for (const changed of [before, after+"\n", after.replace('"issues": []','"issues": [1]'), after.replace('"ignoredCodeFiles": []','"ignoredCodeFiles": [1]'), after.replace('"lintContractHash": "unchanged"','"lintContractHash": "changed"'), after.replace("{",'{"extra":true,')]) {
      expect(checkTaB2fBaselineChangeForTest({before,after:changed})).toEqual(["TA_B2F_BASELINE_CHANGE_NOT_AUTHORIZED"]);
    }
    expect(checkTaB2fScopeForTest({files:["quality/eslint-baseline.json"],mission:b2cAnchorMission,branch:"codex/ta-b2f",baseSha:"06e56daae267e49a7e23a5c40a70fbbef21b8cb8"})).toEqual([]);
    expect(checkSalesStageB2ScopeForTest({files:["quality/eslint-baseline.json"],mission:b2Mission,branch:"kreile/b2-ein-1"})).toContain("SALES_STAGE_B2_SCOPE:quality/eslint-baseline.json");
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

  it("accepts stacked parts and multiple new migrations in every individual part", () => {
    const files = ["supabase/migrations/20261103020000_b2_kunde_k1.sql",
      ...[0, 1, 2, 3, 4, 5, 6].map(part => "supabase/migrations/20261103030000_ein" + part + "_teil.sql")];
    expect(checkSalesStageB2ScopeForTest({files,entries:files.map(path=>({status:"A",path})),mission:b2Mission,branch:"kreile/b2-ein-5"})).toEqual([]);
    for (const part of [0, 1, 2, 3, 4, 5, 6]) {
      const duplicate = ["supabase/migrations/20261103030001_ein" + part + "_a.sql", "supabase/migrations/20261103030002_ein" + part + "_b.sql"];
      expect(checkSalesStageB2ScopeForTest({files:duplicate,entries:duplicate.map(path=>({status:"A",path})),mission:b2Mission,branch:"kreile/b2-ein-5"})).toEqual([]);
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
      files: ["src/modules/inventory/server/get.ts"],
      mission: b2Mission,
      branch: "kreile/b1-shell",
    })).toEqual(expect.arrayContaining([
      "SALES_STAGE_BRANCH_INVALID:kreile/b1-shell",
      "SALES_STAGE_B2_SCOPE:src/modules/inventory/server/get.ts",
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
