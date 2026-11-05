import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const PLAN_PATH = "docs/delivery/KREILE_LIVE_PLAN_V1.json";
const MISSION_PATH = "missions/F1_ORDER_TO_CASH_PILOT_001.yml";
const ACTIVATION_BRANCH = "codex/kreile-live-plan-v1-activation";
const CLOSE_BRANCH = "codex/kreile-live-close";
const AMENDMENT_PATTERN = /^docs\/delivery\/amendments\/KR-AMEND-\d{4}\.json$/;
const ACTIVATION_ALLOWLIST = Object.freeze([
  ".claude/**",
  ".gitattributes",
  ".github/workflows/eslint-ratchet.yml",
  ".github/workflows/quality.yml",
  "eslint.config.mjs",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "*.md",
  "package.json",
  "quality/eslint-baseline.json",
  "quality/authoritative-sources.json",
  "scripts/quality/check-authoritative-sources.mjs",
  "scripts/quality/check-delivery-contracts.mjs",
  "scripts/quality/check-f0-doc-truth.mjs",
  "scripts/quality/check-live-package-scope.mjs",
  "scripts/quality/eslint-ratchet-core.ts",
  "scripts/quality/select-live-regression-specs.mjs",
  "scripts/quality/check-module-gates.mjs",
  "scripts/quality/resolve-delivery-trust-anchor.mjs",
  "scripts/quality/check-f0-independent-review-package.mjs",
  "scripts/show-active-live-package.mjs",
  "scripts/advance-live-package.mjs",
  "scripts/close-live-line.mjs",
  "src/test/delivery_contracts.test.ts",
  "src/test/eslint_ratchet_reference_contract.test.ts",
  "src/test/authority_gate.test.ts",
  "src/test/live_package_scope.test.ts",
  "src/test/s1_module_gates.test.ts",
  "missions/**",
  "docs/delivery/**",
  "docs/project/DOCUMENT_AUTHORITY.md",
  "docs/project/MASTERPLAN.md",
  "docs/project/CURRENT_STATE.md",
  "docs/project/linie/00_ABC_INDEX.md",
  "docs/project/linie/00_BIBEL_INDEX.md",
  "docs/project/linie/00_JETZT_UND_LEITPLANKEN.md",
  "docs/project/linie/00_UI_REFERENZEN_PFADE.md",
  "docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md",
  "docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json",
  "docs/project/linie/ui/designsystem_v1_1/**",
  "docs/project/history/controls/2026-10-11/**",
  "docs/project/history/legacy-sources/2026-10-11/**",
  "docs/evidence/live-line/activation/**",
  "docs/*.md",
  "docs/*.sql",
  "docs/module/**",
  "docs/project/*.md",
  "docs/project/*.json",
  "docs/project/linie/*.md",
  "docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md",
]);
const POST_LIVE_CONTROL_PATTERNS = Object.freeze([
  ".claude/**",
  ".github/workflows/**",
  ".gitattributes",
  "AGENTS.md",
  "CLAUDE.md",
  "package.json",
  "quality/authoritative-sources.json",
  "docs/delivery/**",
  "docs/evidence/live-line/**",
  "docs/project/CURRENT_STATE.md",
  "docs/project/DOCUMENT_AUTHORITY.md",
  "docs/project/MASTERPLAN.md",
  "docs/project/linie/00_UI_REFERENZEN_PFADE.md",
  "docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json",
  "docs/project/linie/ui/designsystem_v1_1/**",
  "missions/**",
  "e2e/kr-l*.spec.ts",
  "scripts/advance-live-package.mjs",
  "scripts/close-live-line.mjs",
  "scripts/show-active-live-package.mjs",
  "scripts/quality/check-authoritative-sources.mjs",
  "scripts/quality/check-delivery-contracts.mjs",
  "scripts/quality/check-live-package-scope.mjs",
  "scripts/quality/select-live-regression-specs.mjs",
]);
const SALES_STAGE_B2_BRANCH = "kreile/b2-eingang";
const TA_B2_BRANCH = "codex/ta-b2";
const TA_B2_BASE_SHA = "ae79c12fb6bea83b8ac68fa065af4671f4bf09b5";
const TA_B2_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR.json";
const TA_B2_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-AP01",
  headBranch: SALES_STAGE_B2_BRANCH,
  mainBaseSha: TA_B2_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-10-31",
  scope: "AP-01 laut docs/project/arbeitspakete/WORKQUEUE.json",
});
const TA_B2B_BRANCH = "codex/ta-b2b";
const TA_B2B_BASE_SHA = "ac6c1d2a7eb652dc5e64219a24eed8d4065fbc4e";
const TA_B2B_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR_B2B.json";
const TA_B2B_BAUPLAN = "docs/project/endversion/codex/BAUPLAN.json";
const TA_B2B_BAUPLAN_SHA256 = "6E5E4EA663783F28C7A6ED1A8EF2017FAD1F8DA0458CC8A2670E6F1863453F77";
const TA_B2B_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-AP01-INFRA",
  headBranch: TA_B2B_BRANCH,
  mainBaseSha: TA_B2B_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-10-31",
  scope: "AP-01-Komplettscope, H18-Inventar, Acceptance-Replay und Endversion 5ac4d4b5ea34",
});
const TA_B2C_BRANCH = "codex/ta-b2c";
const TA_B2C_BASE_SHA = "11091c0be7b2c58ef7b009d4ad5664ad3e9db01d";
const TA_B2C_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR_B2C.json";
const TA_B2C_BAUPLAN = "docs/project/endversion/codex/BAUPLAN.json";
const TA_B2C_BAUPLAN_SHA256 = "225B7FB5D3503522D8BC972E535CE53827E4047F75932B18E52E7B905CB35305";
const TA_B2C_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-AP01-F4-ANCHOR",
  headBranch: TA_B2C_BRANCH,
  mainBaseSha: TA_B2C_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-11-01",
  scope: "AP-01 Fassung 4, Bauplan 6b782924134c und enge B2-Folgepfade",
});
const TA_B2C2_BRANCH = "codex/ta-b2c2";
const TA_B2C2_BASE_SHA = "8e1e03f567278d24d5f3a468f6cbef3729db96b9";
const TA_B2C2_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR_B2C2.json";
const TA_B2C2_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-AP01-F43-ANCHOR",
  headBranch: TA_B2C2_BRANCH,
  mainBaseSha: TA_B2C2_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-11-02",
  scope: "AP-01 Fassung 4.3: orderIntakeCommand und zugehoeriger Unit-Test",
  probeCandidateSha: "6bca5f68e1acd8ec262c6ac2373a7bae58094bea",
  probeResult: "PASS",
});
const TA_B2C3_BRANCH = "codex/ta-b2c3";
const TA_B2C3_BASE_SHA = "8d5dd1fc7af5509898a317ef4f42087df052685a";
const TA_B2C3_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR_B2C3.json";
const TA_B2C3_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-AP01-F43-READ-ANCHOR",
  headBranch: TA_B2C3_BRANCH,
  mainBaseSha: TA_B2C3_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-11-02",
  scope: "AP-01 Fassung 4.3: orderIntakeRead und zugehoeriger Unit-Test",
  probeCandidateSha: "2e90f44a373c2ccc025a99bdc845c51cdd2d8d7a",
  probeResult: "PASS",
});
const TA_B2D2_BRANCH = "codex/ta-b2d2";
const TA_B2D2_BASE_SHA = "b364f569524a636a1aceefac0fb1934f7f24f556";
const TA_B2D2_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR_B2D2.json";
const TA_B2D2_BAUPLAN = "docs/project/endversion/codex/BAUPLAN.json";
const TA_B2D2_BAUPLAN_SHA256 = "5E7B880BD9D4B35EAF7BF906F2693011192933E000FA7AEA94222395F34A1F70";
const TA_B2D2_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-APG-APR-ANCHOR",
  headBranch: TA_B2D2_BRANCH,
  mainBaseSha: TA_B2D2_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-11-02",
  scope: "Bauplan a887ece362f4, AP-G-Testmodell, AP-R Neu erfassen und Replay-Wege-Tests",
  bauplanSha256: TA_B2D2_BAUPLAN_SHA256,
  probeCandidateSha: "d5d47a356b42c581fc96ca010b9f82f6b3811584",
  probeResult: "PASS",
});
const TA_B2E_BRANCH = "codex/ta-b2e";
const TA_B2E_BASE_SHA = "10be0a0326a2ef003fe4a6d30cdc1f484086ceb3";
const TA_B2E_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR_B2E.json";
const TA_B2E_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-APR-UNIT-MIGRATION-ANCHOR",
  headBranch: TA_B2E_BRANCH,
  mainBaseSha: TA_B2E_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-11-02",
  scope: "AP-R Pflicht-Einheit je Freitext-Position: View-Migration, kanonischer Auftragskarten-Leser, lokale Webfonts und schrumpfende Modul-Baseline",
  probeCandidateSha: "b3823e11e67dd9ca1b2a194cc8db360e58011d46",
  probeResult: "PASS",
});
const TA_B2F_BRANCH = "codex/ta-b2f";
const TA_B2F_BASE_SHA = "06e56daae267e49a7e23a5c40a70fbbef21b8cb8";
const TA_B2F_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR_B2F.json";
const TA_B2F_BAUPLAN = "docs/project/endversion/codex/BAUPLAN.json";
const TA_B2F_BAUPLAN_SHA256 = "DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4";
const TA_B2F_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-KOMPLETT-ANCHOR",
  headBranch: TA_B2F_BRANCH,
  mainBaseSha: TA_B2F_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-11-03",
  scope: "TA-B2f Runde 52: gebundene Endversion V41 und AP-EIN Teile 0-6",
  bauplanSha256: TA_B2F_BAUPLAN_SHA256,
  probeResult: "PASS",
});
const PR154_REBASELINE_BRANCH = "kreile/s1-p2-eingang";
const TA_B2H_BRANCH = "codex/ta-b2h";
const TA_B2H_BASE_SHA = "b6d94bccad812883cddaefa1d050c1506c722d8b";
const TA_B2H_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR_B2H.json";
const TA_B2H_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-SHARE-ANCHOR",
  headBranch: TA_B2H_BRANCH,
  mainBaseSha: TA_B2H_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-11-04",
  scope: "P52: sechs exakte Pfade fuer Was ist neu und JSON-Testaufloesung; P44/P47 unveraendert",
  probeCandidateSha: "f4d88b8e5024f8311e7533fe3619be010209f1b5",
  probeResult: "PASS",
});
const TA_B2H_ANCHOR_ALLOWLIST = Object.freeze([
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
  TA_B2H_RECEIPT,
  "docs/delivery/ABGABE_TA-B2H.md",
]);
const TA_B2I_BRANCH = "codex/ta-b2i";
const TA_B2I_BASE_SHA = "7c475a72a582b412a95d73224e5a94581aa7b377";
const TA_B2I_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR_B2I.json";
const TA_B2I_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-P55-ANCHOR",
  headBranch: TA_B2I_BRANCH,
  mainBaseSha: TA_B2I_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-11-04",
  scope: "P55/P56: zwei zweite Migrationen, XML-Paketdateien und zwei PIN-Reset-Pfade",
  probeCandidateSha: "984a6caa64a84a89d38317db1deb50faf84a57dd",
  probeResult: "PASS",
});
const TA_B2I_ANCHOR_ALLOWLIST = Object.freeze([
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
  TA_B2I_RECEIPT,
  "docs/delivery/ABGABE_TA-B2I.md",
]);
const TA_B2J_BRANCH = "codex/ta-b2j";
const TA_B2J_BASE_SHA = "27c3435474e5cec4d1241bf75a646a895edc1e91";
const TA_B2J_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR_B2J.json";
const TA_B2J_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-P59-ANCHOR",
  headBranch: TA_B2J_BRANCH,
  mainBaseSha: TA_B2J_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-11-04",
  scope: "P59: AP-EIN, Teil 6 und KV; additive Migrationen ohne Mengenlimit",
  probeCandidateSha: "12b34247feb69e16ebea6c2f85eeaa4018926d1a",
  probeResult: "PASS",
});
const TA_B2J_ANCHOR_ALLOWLIST = Object.freeze([
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
  TA_B2J_RECEIPT,
  "docs/delivery/ABGABE_TA-B2J.md",
]);
const TA_B2K1_BRANCH = "codex/ta-b2k1";
const TA_B2K1_BASE_SHA = "ce762422266089d694a12a94fe2129095003e82e";
const TA_B2K1_RECEIPT = "docs/evidence/live-line/b2/TRUST_ANCHOR_B2K1.json";
const TA_B2K1_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "B2-EINGANG-P68-PATH-ANCHOR",
  headBranch: TA_B2K1_BRANCH,
  mainBaseSha: TA_B2K1_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-11-05",
  scope: "P68: nur Druck- und Nacharbeitspfade fuer offene Runde-52-Teile; keine Runde-53-Bindung",
  probeResult: "PASS",
});
const TA_B2K1_ANCHOR_ALLOWLIST = Object.freeze([
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
  TA_B2K1_RECEIPT,
  "docs/delivery/ABGABE_TA-B2K1.md",
]);
const PR154_REBASELINE_BASE_SHA = "1fa4920d6d06b02413c8c157ae6b739507105846";
const PR154_REBASELINE_RECEIPT = "docs/evidence/live-line/pr154/REBASELINE.json";
const PR154_REBASELINE_VALUES = Object.freeze({
  schemaVersion: 1,
  package: "PR-154-REBASELINE",
  pullRequest: 154,
  headBranch: PR154_REBASELINE_BRANCH,
  mainBaseSha: PR154_REBASELINE_BASE_SHA,
  authorizedBy: "Siglinder",
  authorizedAt: "2026-10-30",
  scopeMode: "CUMULATIVE_REBASELINE_AFTER_RETARGET",
  followingPullRequests: "STRICT_UNCHANGED",
});
const PR154_TRUST_ANCHOR_PINNED_FILES = Object.freeze([
  ".github/workflows/eslint-ratchet.yml",
  "AGENTS.md",
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "quality/authoritative-sources.json",
  "missions/F1_ORDER_TO_CASH_PILOT_001.yml",
  "docs/delivery/KREILE_VERKAUFSSTUFE_1.md",
  "scripts/quality/check-authoritative-sources.mjs",
  "scripts/quality/check-delivery-contracts.mjs",
  "scripts/quality/check-live-package-scope.mjs",
]);
const PR154_TRUST_ANCHOR_BASE_FILES = Object.freeze([
  ...PR154_TRUST_ANCHOR_PINNED_FILES,
  "quality/eslint-baseline.json",
]);
const TA_B2_ANCHOR_ALLOWLIST = Object.freeze([
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/MELDUNG_PLANUNGSCHAT.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/**",
  TA_B2_RECEIPT,
  MISSION_PATH,
  "scripts/quality/check-delivery-contracts.mjs",
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/delivery_contracts.test.ts",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2_REQUIRED_FILES = Object.freeze([
  "docs/project/arbeitspakete/TRUST_ANCHOR_B2.md",
  TA_B2_RECEIPT,
  MISSION_PATH,
  "scripts/quality/check-delivery-contracts.mjs",
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/delivery_contracts.test.ts",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2B_ANCHOR_ALLOWLIST = Object.freeze([
  ".github/workflows/agentur-gate.yml",
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/MELDUNG_PLANUNGSCHAT.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/**",
  TA_B2B_BAUPLAN,
  TA_B2B_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2B_REQUIRED_FILES = Object.freeze([
  ".github/workflows/agentur-gate.yml",
  "_review/AKTUELLE_ANWEISUNG.md",
  "docs/project/arbeitspakete/TRUST_ANCHOR_B2B.md",
  "docs/project/arbeitspakete/WORKQUEUE.json",
  "docs/project/arbeitspakete/AP-01-eingang-geruest-paket-persoenlich/PAKET.md",
  "docs/project/arbeitspakete/AP-01-eingang-geruest-paket-persoenlich/AP-01-eingang-paket-persoenlich.acceptance.test.ts.txt",
  "docs/project/arbeitspakete/AP-01-eingang-geruest-paket-persoenlich/ap01_eingang_paket_persoenlich.integration.test.ts.txt",
  TA_B2B_BAUPLAN,
  TA_B2B_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2C_ANCHOR_ALLOWLIST = Object.freeze([
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/MELDUNG_PLANUNGSCHAT.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/**",
  TA_B2C_BAUPLAN,
  TA_B2C_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2C_REQUIRED_FILES = Object.freeze([
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/TRUST_ANCHOR_B2C.md",
  "docs/project/arbeitspakete/WORKQUEUE.json",
  "docs/project/arbeitspakete/AP-01-eingang-geruest-paket-persoenlich/PAKET.md",
  "docs/project/arbeitspakete/AP-01-eingang-geruest-paket-persoenlich/ap01b_eingang_bestandskunde_unvollstaendig.integration.test.ts.txt",
  "docs/project/arbeitspakete/AP-02-eingang-neukunde/PAKET.md",
  "docs/project/arbeitspakete/AP-02-eingang-neukunde/ap02_eingang_neukunde.integration.test.ts.txt",
  TA_B2C_BAUPLAN,
  TA_B2C_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2C2_ANCHOR_ALLOWLIST = Object.freeze([
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/MELDUNG_PLANUNGSCHAT.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/**",
  TA_B2C2_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2C2_REQUIRED_FILES = Object.freeze([
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/AP-01-eingang-geruest-paket-persoenlich/PAKET.md",
  "docs/project/arbeitspakete/AP-G-testmodell/PAKET.md",
  "docs/project/arbeitspakete/AP-K1-kunde/PAKET.md",
  "docs/project/arbeitspakete/BEFUNDE.md",
  "docs/project/arbeitspakete/TRUST_ANCHOR_B2C2.md",
  "docs/project/arbeitspakete/TRUST_ANCHOR_B2D.md",
  "docs/project/arbeitspakete/WORKQUEUE.json",
  TA_B2C2_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2C3_ANCHOR_ALLOWLIST = Object.freeze([
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/MELDUNG_PLANUNGSCHAT.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/**",
  TA_B2C3_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2C3_REQUIRED_FILES = Object.freeze([
  "docs/project/arbeitspakete/TRUST_ANCHOR_B2C3.md",
  TA_B2C3_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2D2_ANCHOR_ALLOWLIST = Object.freeze([
  ".github/workflows/agentur-gate.yml",
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/MELDUNG_PLANUNGSCHAT.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/**",
  TA_B2D2_BAUPLAN,
  TA_B2D2_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2D2_REQUIRED_FILES = Object.freeze([
  ".github/workflows/agentur-gate.yml",
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/AP-G-testmodell/PAKET.md",
  "docs/project/arbeitspakete/AP-R-neu-erfassen/PAKET.md",
  "docs/project/arbeitspakete/BEFUNDE.md",
  "docs/project/arbeitspakete/TRUST_ANCHOR_B2D.md",
  "docs/project/arbeitspakete/TRUST_ANCHOR_B2D2.md",
  "docs/project/arbeitspakete/WORKQUEUE.json",
  TA_B2D2_BAUPLAN,
  TA_B2D2_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2E_ANCHOR_ALLOWLIST = Object.freeze([
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/MELDUNG_PLANUNGSCHAT.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/**",
  TA_B2E_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2E_REQUIRED_FILES = Object.freeze([
  "docs/project/arbeitspakete/TRUST_ANCHOR_B2E.md",
  TA_B2E_RECEIPT,
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2F_ANCHOR_ALLOWLIST = Object.freeze([
  "quality/eslint-baseline.json",
  ".gitattributes",
  ".github/workflows/agentur-gate.yml",
  ".github/workflows/eslint-ratchet.yml",
  "eslint.config.mjs",
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/MELDUNG_PLANUNGSCHAT.md",
  "_review/MELDUNG_ENDVERSION_CHAT.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/**",
  "docs/project/endversion/ui/**",
  TA_B2F_BAUPLAN,
  "e2e/generated/**",
  "docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json",
  TA_B2F_RECEIPT,
  "scripts/quality/check-authoritative-sources.mjs",
  "scripts/quality/check-live-package-scope.mjs",
  "scripts/spec/generate-flow-tests.mjs",
  "src/test/live_package_scope.test.ts",
]);
const TA_B2F_REQUIRED_FILES = Object.freeze([
  "quality/eslint-baseline.json",
  ".gitattributes",
  ".github/workflows/eslint-ratchet.yml",
  "_review/AKTUELLE_ANWEISUNG.md",
  "_review/OWNER_ENTSCHEIDUNGEN.md",
  "docs/project/arbeitspakete/AP-EIN-eingang-komplett/PAKET.md",
  "docs/project/arbeitspakete/TRUST_ANCHOR_B2F.md",
  "docs/project/arbeitspakete/WORKQUEUE.json",
  "docs/project/endversion/ui/LIESMICH.md",
  "docs/project/endversion/ui/endversion_design.css",
  "docs/project/endversion/ui/SICHTVERTRAG.json",
  "docs/project/endversion/ui/pruefe_sicht.cjs",
  "docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json",
  TA_B2F_BAUPLAN,
  TA_B2F_RECEIPT,
  "scripts/quality/check-authoritative-sources.mjs",
  "scripts/quality/check-live-package-scope.mjs",
  "src/test/live_package_scope.test.ts",
]);
const SALES_STAGE_B2_EXACT_ALLOWLIST = Object.freeze([
  "src/app/actions/settings.actions.ts",
  "src/app/warendurchlauf/page.tsx",
  "src/lib/server/commands/orderStationCommand.ts",
  "src/lib/server/commands/__tests__/orderStationCommand.test.ts",
  "src/lib/server/goodsReceiptOrderPort.ts",
  "src/lib/server/intakeDraftEvents.ts",
  "src/lib/server/intakeOriginalAudit.ts",
  "src/lib/types/operationalOrder.ts",
  "src/modules/fundament/fundament.manifest.json",
  "src/modules/fundament/server-public.ts",
  "src/modules/quotes/__tests__/quoteCommands.test.ts",
  "src/modules/quotes/server/types.ts",
  "src/test/f1_3_live_card.integration.test.ts",
  ".github/workflows/agentur-gate.yml",
  "quality/module-gates-baseline.json",
  "docs/delivery/ABGABE_B2.md",
  "docs/delivery/ABGABE_AP-01.md",
  "docs/evidence/f1/F1_R0_CAPABILITY_REGISTRY.json",
  "e2e/f1-4-immutable-invoice.real.spec.ts",
  "e2e/path1-ui-convergence-v5-global-create.spec.ts",
  "e2e/path1-ui-convergence-v5-p3.real.spec.ts",
  "scripts/quality/h18-server-actions.json",
  "src/app/actions/eingang.actions.ts",
  "src/app/GlobalCreateAppAdapter.tsx",
  "src/app/layout.tsx",
  "src/app/telefonnotiz/layout.tsx",
  "src/app/actions/intakeDraft.actions.ts",
  "src/app/orders/OrdersAppAdapter.tsx",
  "src/app/warendurchlauf/__tests__/w2cB2m5j.unavailable.realRender.test.tsx",
  "src/components/home/OfficeHome.tsx",
  "src/components/home/OfficeHomeClient.tsx",
  "src/components/home/__tests__/RolfHome.realRender.test.tsx",
  "src/components/layout/GlobalCreateFlow.tsx",
  "src/components/layout/KreileHeader.tsx",
  "src/components/layout/MoreMenu.tsx",
  "src/components/layout/KreileAppShell.tsx",
  "src/components/layout/TargetShell.module.css",
  "src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx",
  "src/components/layout/__tests__/w2cHeaderTruth.realRender.test.tsx",
  "src/components/layout/globalCreateRequest.ts",
  "src/lib/auth/authorizationContract.ts",
  "src/lib/server/commands/orderIntakeCommand.ts",
  "src/lib/server/commands/__tests__/orderIntakeCommand.test.ts",
  "src/lib/server/orderIntakeRead.ts",
  "src/lib/server/__tests__/orderIntakeRead.test.ts",
  "src/lib/server/orderCardRead.ts",
  "src/lib/server/__tests__/orderCardRead.test.ts",
  "src/lib/server/intakeDraft.ts",
  "src/lib/server/todayDashboard.ts",
  "src/modules/fundament/featureCatalog.ts",
  "src/modules/orders/__tests__/OrderSurfaces.v8.test.tsx",
  "src/modules/orders/ui/OrderCardView.tsx",
  "src/modules/suche/ui/SearchDialog.tsx",
  "src/modules/werkstatt/ui/WerkstattView.singleProjection.test.tsx",
  "src/modules/werkstatt/ui/WerkstattView.tsx",
  "src/modules/customers/__tests__/orderReadiness.test.ts",
  "src/modules/customers/customers.manifest.json",
  "src/modules/customers/orderReadiness.ts",
  "src/modules/customers/public.ts",
  "src/modules/customers/server-public.ts",
  "src/modules/customers/server/readCustomerOrderReadinessCommand.ts",
  "src/modules/customers/server/types.ts",
  "src/test/acceptance/ap01_eingang_paket_persoenlich.integration.test.ts",
  "src/ui/kr/AppShell.tsx",
  "src/ui/kr/Dialog.tsx",
  "src/ui/kr/GlobalesPlus.tsx",
  "supabase/migrations/20261031212320_ap01_intake_item.sql",
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
  "src/app/actions/communications.actions.ts",
  "src/app/actions/complaints.actions.ts",
  "src/app/actions/customers.actions.ts",
  "src/app/actions/domainAttachments.actions.ts",
  "src/app/actions/timeline.actions.ts",
  "src/app/customers/CustomerCardAppAdapter.tsx",
  "src/app/warendurchlauf/actions.ts",
  "src/components/layout/F1SourceDialogs.tsx",
  "src/components/layout/PwaRegister.tsx",
  "src/components/attachments/DomainAttachmentPanel.module.css",
  "src/components/attachments/DomainAttachmentPanel.tsx",
  "src/components/attachments/__tests__/DomainAttachmentPanel.test.tsx",
  "src/components/communication/CommunicationPanel.module.css",
  "src/components/communication/CommunicationPanel.tsx",
  "src/components/communication/__tests__/CommunicationPanel.test.tsx",
  "src/components/intake/CameraCapture.tsx",
  "src/db/schema.ts",
  "src/db/schema_buchhaltung.ts",
  "src/lib/server/commands/immutableInvoiceCommand.ts",
  "src/lib/server/communicationPort.ts",
  "src/lib/server/customerSummaryRead.ts",
  "src/lib/server/documentIntelligencePort.ts",
  "src/lib/server/azureDocumentIntelligence.ts",
  "src/lib/server/intakeSuggestions.ts",
  "src/lib/server/intakeTextRecognition.ts",
  "src/lib/server/microsoftGraph.ts",
  "src/lib/server/todayDashboardPolicy.ts",
  "src/lib/intakeSuggestionsContract.ts",
  "src/lib/buchhaltung/erechnung/ERechnungParser.ts",
  "src/lib/pdf/ImmutableInvoiceDocument.tsx",
  "src/lib/pdf/QuoteDocument.tsx",
  "src/app/actions/pdf.actions.ts",
  "src/lib/pdf/OrderLabel.tsx",
  "src/lib/pdf/__tests__/w2cB2m5u.orderLabelDateTruth.test.tsx",
  "src/modules/orders/server/reworkOrderCommand.ts",
  "src/modules/orders/server/__tests__/reworkOrderCommand.test.ts",
  "src/modules/orders/server-public.ts",
  "src/modules/orders/orders.manifest.json",
  "src/lib/repositories/complaintsRepository.ts",
  "src/lib/server/paymentContract.ts",
  "src/lib/types/customer.ts",
  "src/modules/fundament/server/systemSettingsPort.ts",
]);
const SALES_STAGE_B2_ALLOWLIST = Object.freeze([
  "package.json",
  "package-lock.json",
  "src/app/actions/start.actions.ts",
  "src/app/actions/__tests__/publicStartActions.test.ts",
  "src/app/buchhaltung/__tests__/w2c.activeRouteContainment.test.tsx",
  "src/lib/server/authBootstrap.ts",
  "src/lib/server/__tests__/authBootstrap.test.ts",
  "src/components/layout/WasIstNeu.tsx",
  "src/components/layout/__tests__/WasIstNeu.test.tsx",
  "src/content/was-ist-neu.json",
  ...SALES_STAGE_B2_EXACT_ALLOWLIST,
  "src/app/api/eingang-share/route.ts",
  "src/test/eingang_share.integration.test.ts",
  "src/app/nachrichten/page.tsx",
  "src/test/nachrichten_page.integration.test.ts",
  "docs/delivery/ABGABE_AP-*.md",
  "e2e/generated/**",
  "scripts/spec/**",
  "src/app/fonts/**",
  "src/modules/eingang/**",
  "src/test/acceptance/*.integration.test.ts",
  "supabase/migrations/*_ap_r_freitext_einheiten.sql",
  "public/icons/**",
  "public/manifest.webmanifest",
  "src/styles/**",
  "src/ui/kr/**",
  "src/app/globals.css",
  "docs/project/endversion/ui/routen.json",
  "src/modules/communications/**",
  "src/modules/complaints/**",
  "src/modules/customers/**",
  "src/modules/supplier-invoices/**",
  "src/modules/tasks/**",
  "src/modules/quotes/**",
  "src/modules/orders/**",
  "src/modules/werkstatt/**",
  "src/modules/fundament/**",
  "src/app/nachrichten/**",
  "src/app/rein/**",
  "src/app/customers/**",
  "src/app/orders/**",
  "src/app/angebote/**",
  "src/app/quotes/**",
  "src/app/warendurchlauf/**",
  "src/app/settings/**",
  "src/app/telefonnotiz/**",
  "src/app/buchhaltung/belege/**",
  "src/components/warenausgang/**",
  "src/app/api/eingang-share/**",
  "src/lib/server/commands/quote*.ts",
  "src/lib/server/commands/__tests__/quote*.test.ts",
  "src/lib/server/domainAttachment.ts",
  "src/lib/server/__tests__/domainAttachment.test.ts",
  "src/lib/server/evidenceRead.ts",
  "src/lib/server/__tests__/evidenceRead.test.ts",
  "src/lib/domain/workingDays.ts",
  "src/components/start/StartScreenClient.tsx",
  "supabase/migrations/*_b2_kunde_k1.sql",
  "supabase/migrations/*_ein[0-6]*_*.sql",
]);

const posix = (value) => value.replaceAll("\\", "/");
const isSha = (value) => /^[0-9a-f]{40}$/i.test(value ?? "");
const hash = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();

function globRegex(pattern) {
  const characterClasses = [];
  let source = posix(pattern).replace(/\[[^\]]+\]/g, (value) => {
    const token = `__CHARACTER_CLASS_${characterClasses.length}__`;
    characterClasses.push(value);
    return token;
  });
  source = source.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  source = source.replaceAll("**", "__DOUBLE_STAR__");
  source = source.replaceAll("*", "[^/]*");
  source = source.replaceAll("__DOUBLE_STAR__", ".*");
  characterClasses.forEach((value, index) => {
    source = source.replaceAll(`__CHARACTER_CLASS_${index}__`, value);
  });
  return new RegExp(`^${source}$`);
}

function covered(rel, patterns) {
  return patterns.some((pattern) => globRegex(pattern).test(posix(rel)));
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitFile(root, revision, rel) {
  return git(root, ["show", `${revision}:${rel}`]);
}

function parseMission(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([a-z][a-z0-9_]*):\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function parseFacts(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*?)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

function changedFiles(root, base, head) {
  const output = git(root, ["diff", "--name-only", "--diff-filter=ACMRD", base, head]);
  return output ? output.split(/\r?\n/).map(posix) : [];
}

function changedEntries(root, base, head) {
  const output = git(root, ["diff", "--name-status", "--diff-filter=ACMRD", base, head]);
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const [rawStatus, ...paths] = line.split("\t");
    return {
      status: rawStatus.slice(0, 1),
      path: posix(paths.at(-1)),
    };
  });
}

function commitFiles(root, commit) {
  const output = git(root, ["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", commit]);
  return output ? output.split(/\r?\n/).map(posix) : [];
}

function commitList(root, base, head) {
  const output = git(root, ["rev-list", "--reverse", `${base}..${head}`]);
  return output ? output.split(/\r?\n/) : [];
}

function resolved(root, revision) {
  return git(root, ["rev-parse", revision]);
}

function checkPr154TrustAnchorBase(root, baseSha, originalBaseSha = PR154_REBASELINE_BASE_SHA) {
  if (baseSha === originalBaseSha) return [];
  const errors = [];
  try {
    git(root, ["merge-base", "--is-ancestor", originalBaseSha, baseSha]);
  } catch {
    return [`PR154_REBASELINE_BASE_INVALID:${baseSha}:${originalBaseSha}`];
  }
  let commits;
  let files;
  try {
    commits = commitList(root, originalBaseSha, baseSha);
    files = changedFiles(root, originalBaseSha, baseSha).sort();
  } catch {
    return [`PR154_REBASELINE_BASE_INVALID:${baseSha}:${originalBaseSha}`];
  }
  if (commits.length !== 1) errors.push(`PR154_TRUST_ANCHOR_COMMIT_COUNT:${commits.length}`);
  const expectedFiles = [...PR154_TRUST_ANCHOR_BASE_FILES].sort();
  if (JSON.stringify(files) !== JSON.stringify(expectedFiles)) {
    errors.push(`PR154_TRUST_ANCHOR_FILES:${files.join(",")}`);
  }
  for (const rel of PR154_TRUST_ANCHOR_PINNED_FILES) {
    try {
      const protectedBlob = git(root, ["rev-parse", `${baseSha}:${rel}`]);
      const candidateBlob = git(root, ["hash-object", "--path", rel, rel]);
      if (candidateBlob !== protectedBlob) errors.push(`PR154_TRUST_ANCHOR_BYTES:${rel}`);
    } catch {
      errors.push(`PR154_TRUST_ANCHOR_BYTES:${rel}`);
    }
  }
  return errors;
}

function checkPr154Rebaseline(root, baseSha, originalBaseSha = PR154_REBASELINE_BASE_SHA) {
  const errors = [];
  errors.push(...checkPr154TrustAnchorBase(root, baseSha, originalBaseSha));
  const full = path.join(root, PR154_REBASELINE_RECEIPT);
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(full, "utf8"));
  } catch {
    errors.push("PR154_REBASELINE_RECEIPT_UNREADABLE");
    return errors;
  }
  const expectedKeys = [...Object.keys(PR154_REBASELINE_VALUES), "reason"].sort();
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(expectedKeys)) {
    errors.push("PR154_REBASELINE_RECEIPT_SCHEMA");
  }
  for (const [key, value] of Object.entries(PR154_REBASELINE_VALUES)) {
    if (receipt[key] !== value) errors.push(`PR154_REBASELINE_RECEIPT_VALUE:${key}`);
  }
  if (typeof receipt.reason !== "string" || receipt.reason.trim().length < 40) {
    errors.push("PR154_REBASELINE_RECEIPT_REASON");
  }
  return errors;
}

function checkTaB2Anchor(root, files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2_BRANCH) errors.push(`TA_B2_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2_BASE_SHA) errors.push(`TA_B2_BASE_INVALID:${baseSha}:${TA_B2_BASE_SHA}`);
  for (const rel of files) {
    if (!covered(rel, TA_B2_ANCHOR_ALLOWLIST)) errors.push(`TA_B2_SCOPE:${rel}`);
  }
  for (const rel of TA_B2_REQUIRED_FILES) {
    if (!files.includes(rel)) errors.push(`TA_B2_REQUIRED_FILE_MISSING:${rel}`);
  }
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") {
    errors.push("TA_B2_MISSION_INVALID");
  }
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(path.join(root, TA_B2_RECEIPT), "utf8"));
  } catch {
    errors.push("TA_B2_RECEIPT_UNREADABLE");
    return errors;
  }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2_VALUES).sort())) {
    errors.push("TA_B2_RECEIPT_SCHEMA");
  }
  for (const [key, value] of Object.entries(TA_B2_VALUES)) {
    if (receipt[key] !== value) errors.push(`TA_B2_RECEIPT_VALUE:${key}`);
  }
  return errors;
}

function checkTaB2bScope(files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2B_BRANCH) errors.push(`TA_B2B_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2B_BASE_SHA) errors.push(`TA_B2B_BASE_INVALID:${baseSha}:${TA_B2B_BASE_SHA}`);
  for (const rel of files) {
    if (!covered(rel, TA_B2B_ANCHOR_ALLOWLIST)) errors.push(`TA_B2B_SCOPE:${rel}`);
  }
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") {
    errors.push("TA_B2B_MISSION_INVALID");
  }
  return errors;
}

function checkTaB2bAnchor(root, files, mission, branch, baseSha) {
  const errors = checkTaB2bScope(files, mission, branch, baseSha);
  for (const rel of TA_B2B_REQUIRED_FILES) {
    if (!files.includes(rel)) errors.push(`TA_B2B_REQUIRED_FILE_MISSING:${rel}`);
  }
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(path.join(root, TA_B2B_RECEIPT), "utf8"));
  } catch {
    errors.push("TA_B2B_RECEIPT_UNREADABLE");
    return errors;
  }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2B_VALUES).sort())) {
    errors.push("TA_B2B_RECEIPT_SCHEMA");
  }
  for (const [key, value] of Object.entries(TA_B2B_VALUES)) {
    if (receipt[key] !== value) errors.push(`TA_B2B_RECEIPT_VALUE:${key}`);
  }
  try {
    const bauplan = readFileSync(path.join(root, TA_B2B_BAUPLAN));
    if (hash(bauplan) !== TA_B2B_BAUPLAN_SHA256) errors.push("TA_B2B_BAUPLAN_HASH");
  } catch {
    errors.push("TA_B2B_BAUPLAN_UNREADABLE");
  }
  return errors;
}

function checkTaB2cScope(files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2C_BRANCH) errors.push(`TA_B2C_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2C_BASE_SHA) errors.push(`TA_B2C_BASE_INVALID:${baseSha}:${TA_B2C_BASE_SHA}`);
  for (const rel of files) {
    if (!covered(rel, TA_B2C_ANCHOR_ALLOWLIST)) errors.push(`TA_B2C_SCOPE:${rel}`);
  }
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") {
    errors.push("TA_B2C_MISSION_INVALID");
  }
  return errors;
}

function checkTaB2cAnchor(root, files, mission, branch, baseSha) {
  const errors = checkTaB2cScope(files, mission, branch, baseSha);
  for (const rel of TA_B2C_REQUIRED_FILES) {
    if (!files.includes(rel)) errors.push(`TA_B2C_REQUIRED_FILE_MISSING:${rel}`);
  }
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(path.join(root, TA_B2C_RECEIPT), "utf8"));
  } catch {
    errors.push("TA_B2C_RECEIPT_UNREADABLE");
    return errors;
  }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2C_VALUES).sort())) {
    errors.push("TA_B2C_RECEIPT_SCHEMA");
  }
  for (const [key, value] of Object.entries(TA_B2C_VALUES)) {
    if (receipt[key] !== value) errors.push(`TA_B2C_RECEIPT_VALUE:${key}`);
  }
  try {
    const bauplan = readFileSync(path.join(root, TA_B2C_BAUPLAN));
    if (hash(bauplan) !== TA_B2C_BAUPLAN_SHA256) errors.push("TA_B2C_BAUPLAN_HASH");
  } catch {
    errors.push("TA_B2C_BAUPLAN_UNREADABLE");
  }
  return errors;
}

function checkTaB2c2Scope(files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2C2_BRANCH) errors.push(`TA_B2C2_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2C2_BASE_SHA) errors.push(`TA_B2C2_BASE_INVALID:${baseSha}:${TA_B2C2_BASE_SHA}`);
  for (const rel of files) {
    if (!covered(rel, TA_B2C2_ANCHOR_ALLOWLIST)) errors.push(`TA_B2C2_SCOPE:${rel}`);
  }
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") {
    errors.push("TA_B2C2_MISSION_INVALID");
  }
  return errors;
}

function checkTaB2c2Anchor(root, files, mission, branch, baseSha) {
  const errors = checkTaB2c2Scope(files, mission, branch, baseSha);
  for (const rel of TA_B2C2_REQUIRED_FILES) {
    if (!files.includes(rel)) errors.push(`TA_B2C2_REQUIRED_FILE_MISSING:${rel}`);
  }
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(path.join(root, TA_B2C2_RECEIPT), "utf8"));
  } catch {
    errors.push("TA_B2C2_RECEIPT_UNREADABLE");
    return errors;
  }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2C2_VALUES).sort())) {
    errors.push("TA_B2C2_RECEIPT_SCHEMA");
  }
  for (const [key, value] of Object.entries(TA_B2C2_VALUES)) {
    if (receipt[key] !== value) errors.push(`TA_B2C2_RECEIPT_VALUE:${key}`);
  }
  return errors;
}

function checkTaB2c3Scope(files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2C3_BRANCH) errors.push(`TA_B2C3_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2C3_BASE_SHA) errors.push(`TA_B2C3_BASE_INVALID:${baseSha}:${TA_B2C3_BASE_SHA}`);
  for (const rel of files) {
    if (!covered(rel, TA_B2C3_ANCHOR_ALLOWLIST)) errors.push(`TA_B2C3_SCOPE:${rel}`);
  }
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") {
    errors.push("TA_B2C3_MISSION_INVALID");
  }
  return errors;
}

function checkTaB2c3Anchor(root, files, mission, branch, baseSha) {
  const errors = checkTaB2c3Scope(files, mission, branch, baseSha);
  for (const rel of TA_B2C3_REQUIRED_FILES) {
    if (!files.includes(rel)) errors.push(`TA_B2C3_REQUIRED_FILE_MISSING:${rel}`);
  }
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(path.join(root, TA_B2C3_RECEIPT), "utf8"));
  } catch {
    errors.push("TA_B2C3_RECEIPT_UNREADABLE");
    return errors;
  }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2C3_VALUES).sort())) {
    errors.push("TA_B2C3_RECEIPT_SCHEMA");
  }
  for (const [key, value] of Object.entries(TA_B2C3_VALUES)) {
    if (receipt[key] !== value) errors.push(`TA_B2C3_RECEIPT_VALUE:${key}`);
  }
  return errors;
}

function checkTaB2d2Scope(files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2D2_BRANCH) errors.push(`TA_B2D2_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2D2_BASE_SHA) errors.push(`TA_B2D2_BASE_INVALID:${baseSha}:${TA_B2D2_BASE_SHA}`);
  for (const rel of files) {
    if (!covered(rel, TA_B2D2_ANCHOR_ALLOWLIST)) errors.push(`TA_B2D2_SCOPE:${rel}`);
  }
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") {
    errors.push("TA_B2D2_MISSION_INVALID");
  }
  return errors;
}

function checkTaB2d2Anchor(root, files, mission, branch, baseSha) {
  const errors = checkTaB2d2Scope(files, mission, branch, baseSha);
  for (const rel of TA_B2D2_REQUIRED_FILES) {
    if (!files.includes(rel)) errors.push(`TA_B2D2_REQUIRED_FILE_MISSING:${rel}`);
  }
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(path.join(root, TA_B2D2_RECEIPT), "utf8"));
  } catch {
    errors.push("TA_B2D2_RECEIPT_UNREADABLE");
    return errors;
  }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2D2_VALUES).sort())) {
    errors.push("TA_B2D2_RECEIPT_SCHEMA");
  }
  for (const [key, value] of Object.entries(TA_B2D2_VALUES)) {
    if (receipt[key] !== value) errors.push(`TA_B2D2_RECEIPT_VALUE:${key}`);
  }
  try {
    const bauplan = readFileSync(path.join(root, TA_B2D2_BAUPLAN));
    if (hash(bauplan) !== TA_B2D2_BAUPLAN_SHA256) errors.push("TA_B2D2_BAUPLAN_HASH");
  } catch {
    errors.push("TA_B2D2_BAUPLAN_UNREADABLE");
  }
  return errors;
}

function checkTaB2eScope(files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2E_BRANCH) errors.push(`TA_B2E_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2E_BASE_SHA) errors.push(`TA_B2E_BASE_INVALID:${baseSha}:${TA_B2E_BASE_SHA}`);
  for (const rel of files) {
    if (!covered(rel, TA_B2E_ANCHOR_ALLOWLIST)) errors.push(`TA_B2E_SCOPE:${rel}`);
  }
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") {
    errors.push("TA_B2E_MISSION_INVALID");
  }
  return errors;
}

function checkTaB2eAnchor(root, files, mission, branch, baseSha) {
  const errors = checkTaB2eScope(files, mission, branch, baseSha);
  for (const rel of TA_B2E_REQUIRED_FILES) {
    if (!files.includes(rel)) errors.push(`TA_B2E_REQUIRED_FILE_MISSING:${rel}`);
  }
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(path.join(root, TA_B2E_RECEIPT), "utf8"));
  } catch {
    errors.push("TA_B2E_RECEIPT_UNREADABLE");
    return errors;
  }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2E_VALUES).sort())) {
    errors.push("TA_B2E_RECEIPT_SCHEMA");
  }
  for (const [key, value] of Object.entries(TA_B2E_VALUES)) {
    if (receipt[key] !== value) errors.push(`TA_B2E_RECEIPT_VALUE:${key}`);
  }
  return errors;
}

function checkTaB2fScope(files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2F_BRANCH) errors.push(`TA_B2F_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2F_BASE_SHA) errors.push(`TA_B2F_BASE_INVALID:${baseSha}:${TA_B2F_BASE_SHA}`);
  for (const rel of files) {
    if (!covered(rel, TA_B2F_ANCHOR_ALLOWLIST)) errors.push(`TA_B2F_SCOPE:${rel}`);
  }
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") {
    errors.push("TA_B2F_MISSION_INVALID");
  }
  return errors;
}

export function checkTaB2fBaselineChangeForTest({ before, after }) {
  const oldField = '"judgeContractHash": "d322170885867420ca489927b5ad52522206e06009c5afb619d5159d4147752b"';
  const newField = '"judgeContractHash": "f02832e8e3da8367b3604c5f356b6df95fe61310a2c24d04d5b8105b582aab88"';
  if (before.split(oldField).length !== 2 || after !== before.replace(oldField, newField)) {
    return ["TA_B2F_BASELINE_CHANGE_NOT_AUTHORIZED"];
  }
  return [];
}

function checkTaB2fAnchor(root, files, mission, branch, baseSha) {
  const errors = checkTaB2fScope(files, mission, branch, baseSha);
  for (const rel of TA_B2F_REQUIRED_FILES) {
    if (!files.includes(rel)) errors.push(`TA_B2F_REQUIRED_FILE_MISSING:${rel}`);
  }
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(path.join(root, TA_B2F_RECEIPT), "utf8"));
  } catch {
    errors.push("TA_B2F_RECEIPT_UNREADABLE");
    return errors;
  }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2F_VALUES).sort())) {
    errors.push("TA_B2F_RECEIPT_SCHEMA");
  }
  for (const [key, value] of Object.entries(TA_B2F_VALUES)) {
    if (receipt[key] !== value) errors.push(`TA_B2F_RECEIPT_VALUE:${key}`);
  }
  try {
    if (hash(readFileSync(path.join(root, TA_B2F_BAUPLAN))) !== TA_B2F_BAUPLAN_SHA256) {
      errors.push("TA_B2F_BAUPLAN_HASH");
    }
  } catch {
    errors.push("TA_B2F_BAUPLAN_UNREADABLE");
  }
  try {
    // P42 permits exactly one field replacement; even whitespace/debt changes fail.
    const before = execFileSync("git", ["-C", root, "show", TA_B2F_BASE_SHA + ":quality/eslint-baseline.json"], { encoding: "utf8", maxBuffer: 8_000_000 });
    const after = readFileSync(path.join(root, "quality/eslint-baseline.json"), "utf8");
    errors.push(...checkTaB2fBaselineChangeForTest({ before, after }));
  } catch {
    errors.push("TA_B2F_BASELINE_UNREADABLE");
  }
  return errors;
}

function checkTaB2hScope(files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2H_BRANCH) errors.push(`TA_B2H_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2H_BASE_SHA) errors.push(`TA_B2H_BASE_INVALID:${baseSha}:${TA_B2H_BASE_SHA}`);
  for (const rel of files) if (!TA_B2H_ANCHOR_ALLOWLIST.includes(rel)) errors.push(`TA_B2H_SCOPE:${rel}`);
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") errors.push("TA_B2H_MISSION_INVALID");
  return errors;
}

function checkTaB2hAnchor(root, files, mission, branch, baseSha) {
  const errors = checkTaB2hScope(files, mission, branch, baseSha);
  for (const rel of TA_B2H_ANCHOR_ALLOWLIST) if (!files.includes(rel)) errors.push(`TA_B2H_REQUIRED_FILE_MISSING:${rel}`);
  let receipt;
  try { receipt = JSON.parse(readFileSync(path.join(root, TA_B2H_RECEIPT), "utf8")); }
  catch { return [...errors, "TA_B2H_RECEIPT_UNREADABLE"]; }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2H_VALUES).sort())) errors.push("TA_B2H_RECEIPT_SCHEMA");
  for (const [key, value] of Object.entries(TA_B2H_VALUES)) if (receipt[key] !== value) errors.push(`TA_B2H_RECEIPT_VALUE:${key}`);
  return errors;
}

export function checkTaB2hScopeForTest({ files, mission, branch, baseSha }) {
  return checkTaB2hScope(files, mission, branch, baseSha);
}

function checkTaB2iScope(files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2I_BRANCH) errors.push(`TA_B2I_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2I_BASE_SHA) errors.push(`TA_B2I_BASE_INVALID:${baseSha}:${TA_B2I_BASE_SHA}`);
  for (const rel of files) if (!TA_B2I_ANCHOR_ALLOWLIST.includes(rel)) errors.push(`TA_B2I_SCOPE:${rel}`);
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") errors.push("TA_B2I_MISSION_INVALID");
  return errors;
}

function checkTaB2iAnchor(root, files, mission, branch, baseSha) {
  const errors = checkTaB2iScope(files, mission, branch, baseSha);
  for (const rel of TA_B2I_ANCHOR_ALLOWLIST) if (!files.includes(rel)) errors.push(`TA_B2I_REQUIRED_FILE_MISSING:${rel}`);
  let receipt;
  try { receipt = JSON.parse(readFileSync(path.join(root, TA_B2I_RECEIPT), "utf8")); }
  catch { return [...errors, "TA_B2I_RECEIPT_UNREADABLE"]; }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2I_VALUES).sort())) errors.push("TA_B2I_RECEIPT_SCHEMA");
  for (const [key, value] of Object.entries(TA_B2I_VALUES)) if (receipt[key] !== value) errors.push(`TA_B2I_RECEIPT_VALUE:${key}`);
  return errors;
}

export function checkTaB2iScopeForTest({ files, mission, branch, baseSha }) {
  return checkTaB2iScope(files, mission, branch, baseSha);
}

function checkTaB2jScope(files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2J_BRANCH) errors.push(`TA_B2J_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2J_BASE_SHA) errors.push(`TA_B2J_BASE_INVALID:${baseSha}:${TA_B2J_BASE_SHA}`);
  for (const rel of files) if (!TA_B2J_ANCHOR_ALLOWLIST.includes(rel)) errors.push(`TA_B2J_SCOPE:${rel}`);
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") errors.push("TA_B2J_MISSION_INVALID");
  return errors;
}

function checkTaB2jAnchor(root, files, mission, branch, baseSha) {
  const errors = checkTaB2jScope(files, mission, branch, baseSha);
  for (const rel of TA_B2J_ANCHOR_ALLOWLIST) if (!files.includes(rel)) errors.push(`TA_B2J_REQUIRED_FILE_MISSING:${rel}`);
  let receipt;
  try { receipt = JSON.parse(readFileSync(path.join(root, TA_B2J_RECEIPT), "utf8")); }
  catch { return [...errors, "TA_B2J_RECEIPT_UNREADABLE"]; }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2J_VALUES).sort())) errors.push("TA_B2J_RECEIPT_SCHEMA");
  for (const [key, value] of Object.entries(TA_B2J_VALUES)) if (receipt[key] !== value) errors.push(`TA_B2J_RECEIPT_VALUE:${key}`);
  return errors;
}

export function checkTaB2jScopeForTest({ files, mission, branch, baseSha }) {
  return checkTaB2jScope(files, mission, branch, baseSha);
}

function checkTaB2k1Scope(files, mission, branch, baseSha) {
  const errors = [];
  if (branch !== TA_B2K1_BRANCH) errors.push(`TA_B2K1_BRANCH_INVALID:${branch}`);
  if (baseSha !== TA_B2K1_BASE_SHA) errors.push(`TA_B2K1_BASE_INVALID:${baseSha}:${TA_B2K1_BASE_SHA}`);
  for (const rel of files) if (!TA_B2K1_ANCHOR_ALLOWLIST.includes(rel)) errors.push(`TA_B2K1_SCOPE:${rel}`);
  if (mission.active_block !== "B2" || mission.phase !== "WRITING" || mission.branch !== SALES_STAGE_B2_BRANCH
      || mission.started_from_sha !== TA_B2_BASE_SHA || mission.desktop_due_at !== "2026-11-08"
      || mission.tablet_mobile_due_at !== "2026-11-08" || mission.handoff_path !== "docs/delivery/ABGABE_B2.md"
      || mission.next_block !== "B3") errors.push("TA_B2K1_MISSION_INVALID");
  return errors;
}

function checkTaB2k1Anchor(root, files, mission, branch, baseSha) {
  const errors = checkTaB2k1Scope(files, mission, branch, baseSha);
  for (const rel of TA_B2K1_ANCHOR_ALLOWLIST) if (!files.includes(rel)) errors.push(`TA_B2K1_REQUIRED_FILE_MISSING:${rel}`);
  let receipt;
  try { receipt = JSON.parse(readFileSync(path.join(root, TA_B2K1_RECEIPT), "utf8")); }
  catch { return [...errors, "TA_B2K1_RECEIPT_UNREADABLE"]; }
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(Object.keys(TA_B2K1_VALUES).sort())) errors.push("TA_B2K1_RECEIPT_SCHEMA");
  for (const [key, value] of Object.entries(TA_B2K1_VALUES)) if (receipt[key] !== value) errors.push(`TA_B2K1_RECEIPT_VALUE:${key}`);
  return errors;
}

export function checkTaB2k1ScopeForTest({ files, mission, branch, baseSha }) {
  return checkTaB2k1Scope(files, mission, branch, baseSha);
}

export function checkB2iParserChangesForTest({ beforePackage, afterPackage, beforeLock, afterLock }) {
  const errors = [];
  const parse = (value) => typeof value === "string" ? JSON.parse(value) : value;
  try {
    const oldPkg = structuredClone(parse(beforePackage));
    const newPkg = structuredClone(parse(afterPackage));
    const oldLock = structuredClone(parse(beforeLock));
    const newLock = structuredClone(parse(afterLock));
    const version = newPkg.dependencies?.["fast-xml-parser"];
    if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) errors.push("B2I_XML_VERSION_NOT_PINNED");
    if (oldPkg.dependencies) delete oldPkg.dependencies["fast-xml-parser"];
    if (newPkg.dependencies) delete newPkg.dependencies["fast-xml-parser"];
    if (JSON.stringify(oldPkg) !== JSON.stringify(newPkg)) errors.push("B2I_PACKAGE_UNRELATED_CHANGE");
    const oldPackages = oldLock.packages, newPackages = newLock.packages;
    if (!oldPackages || !newPackages || !oldPackages[""] || !newPackages[""]) return [...errors, "B2I_LOCK_SHAPE_INVALID"];
    delete oldLock.packages; delete newLock.packages;
    if (JSON.stringify(oldLock) !== JSON.stringify(newLock)) errors.push("B2I_LOCK_METADATA_CHANGED");
    const oldRoot = structuredClone(oldPackages[""]), newRoot = structuredClone(newPackages[""]);
    if (newRoot.dependencies?.["fast-xml-parser"] !== version) errors.push("B2I_LOCK_VERSION_MISMATCH");
    if (oldRoot.dependencies) delete oldRoot.dependencies["fast-xml-parser"];
    if (newRoot.dependencies) delete newRoot.dependencies["fast-xml-parser"];
    if (JSON.stringify(oldRoot) !== JSON.stringify(newRoot)) errors.push("B2I_LOCK_ROOT_UNRELATED_CHANGE");
    const first = "node_modules/fast-xml-parser";
    if (!newPackages[first] || newPackages[first].version !== version) return [...errors, "B2I_LOCK_PARSER_MISSING"];
    const reachable = new Set();
    const pending = [first];
    while (pending.length) {
      const current = pending.pop();
      if (reachable.has(current)) continue;
      reachable.add(current);
      const meta = newPackages[current];
      if (!meta) return [...errors, `B2I_LOCK_DEPENDENCY_MISSING:${current}`];
      const required = meta.dependencies ?? {};
      for (const name of Object.keys({ ...required, ...(meta.optionalDependencies ?? {}) })) {
        let parent = current;
        let found = null;
        for (;;) {
          const candidate = `${parent}/node_modules/${name}`;
          if (newPackages[candidate]) { found = candidate; break; }
          const index = parent.lastIndexOf("/node_modules/");
          if (index < 0) break;
          parent = parent.slice(0, index);
        }
        if (!found && newPackages[`node_modules/${name}`]) found = `node_modules/${name}`;
        if (found) pending.push(found);
        else if (Object.hasOwn(required, name)) errors.push(`B2I_LOCK_DEPENDENCY_MISSING:${name}`);
      }
    }
    for (const name of new Set([...Object.keys(oldPackages), ...Object.keys(newPackages)])) {
      if (name === "") continue;
      const before = oldPackages[name], after = newPackages[name];
      if (!after) { errors.push(`B2I_LOCK_REMOVED:${name}`); continue; }
      if (!before) { if (!reachable.has(name)) errors.push(`B2I_LOCK_UNRELATED_ADDITION:${name}`); continue; }
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      const a = structuredClone(before), b = structuredClone(after);
      if (reachable.has(name)) { delete a.dev; delete b.dev; delete a.devOptional; delete b.devOptional; }
      if (JSON.stringify(a) !== JSON.stringify(b)) errors.push(`B2I_LOCK_UNRELATED_CHANGE:${name}`);
    }
  } catch { errors.push("B2I_PARSER_MANIFEST_INVALID"); }
  return errors;
}

function checkSalesStageB2Scope(files, entries, mission, branch) {
  const errors = [];
  if (branch !== SALES_STAGE_B2_BRANCH && !/^kreile\/b2-ein-(?:[0-6]|0b|2b)$/.test(branch)) {
    errors.push(`SALES_STAGE_BRANCH_INVALID:${branch}`);
  }
  if (mission.active_block !== "B2" || mission.branch !== SALES_STAGE_B2_BRANCH) {
    errors.push("SALES_STAGE_MISSION_MISMATCH");
  }
  for (const rel of files) {
    if (!covered(rel, SALES_STAGE_B2_ALLOWLIST)) errors.push(`SALES_STAGE_B2_SCOPE:${rel}`);
  }
  const migrations = entries.filter((entry) => entry.path.startsWith("supabase/migrations/"));
  const migrationFamilies = new Map();
  for (const entry of migrations) {
    const family = entry.path.match(/_(ap01_intake_item|ap_r_freitext_einheiten|b2_kunde_k1|ein[0-6])(?:_|\.sql)/)?.[1];
    if (family) migrationFamilies.set(family, [...(migrationFamilies.get(family) ?? []), entry.path]);
  }
  for (const [family, paths] of migrationFamilies) {
    const exception = family === "ein2" ? /^supabase\/migrations\/\d{14}_ein2_fotoart\.sql$/
      : family === "ein4" ? /^supabase\/migrations\/\d{14}_ein4_rechte\.sql$/ : null;
    const allowedPair = paths.length === 2 && exception && paths.filter((rel) => exception.test(rel)).length === 1;
    if (!/^ein[0-6]$/.test(family) && paths.length > 1 && !allowedPair) errors.push(`SALES_STAGE_B2_MIGRATION_COUNT:${paths.length}`);
  }
  for (const entry of migrations) {
    if (entry.status !== "A") errors.push(`SALES_STAGE_B2_MIGRATION_NOT_NEW:${entry.path}`);
    if (!/^supabase\/migrations\/\d{14}_(?:ap01_intake_item|ap_r_freitext_einheiten|b2_kunde_k1|ein[0-6][a-z0-9]*_[a-z0-9_]+)\.sql$/.test(entry.path)) {
      errors.push(`SALES_STAGE_B2_MIGRATION_INVALID:${entry.path}`);
    }
  }
  return errors;
}

/**
 * @param {{
 *   files: string[],
 *   entries?: Array<{status: string, path: string}>,
 *   mission: {active_block?: string, branch?: string},
 *   branch: string,
 * }} input
 */
export function checkSalesStageB2ScopeForTest({ files, entries = [], mission, branch }) {
  return checkSalesStageB2Scope(files, entries, mission, branch);
}

export function checkTaB2bScopeForTest({ files, mission, branch, baseSha }) {
  return checkTaB2bScope(files, mission, branch, baseSha);
}

export function checkTaB2cScopeForTest({ files, mission, branch, baseSha }) {
  return checkTaB2cScope(files, mission, branch, baseSha);
}

export function checkTaB2c2ScopeForTest({ files, mission, branch, baseSha }) {
  return checkTaB2c2Scope(files, mission, branch, baseSha);
}

export function checkTaB2c3ScopeForTest({ files, mission, branch, baseSha }) {
  return checkTaB2c3Scope(files, mission, branch, baseSha);
}

export function checkTaB2d2ScopeForTest({ files, mission, branch, baseSha }) {
  return checkTaB2d2Scope(files, mission, branch, baseSha);
}

export function checkTaB2eScopeForTest({ files, mission, branch, baseSha }) {
  return checkTaB2eScope(files, mission, branch, baseSha);
}

export function checkTaB2fScopeForTest({ files, mission, branch, baseSha }) {
  return checkTaB2fScope(files, mission, branch, baseSha);
}

function checkActivation(files, baseSha, plan) {
  const errors = [];
  if (baseSha !== plan.productRepository.initialOriginMain) {
    errors.push(`ACTIVATION_BASE_MOVED:${baseSha}:${plan.productRepository.initialOriginMain}`);
  }
  for (const rel of files) if (!covered(rel, ACTIVATION_ALLOWLIST)) errors.push(`ACTIVATION_SCOPE:${rel}`);
  if (files.some((rel) => rel.startsWith("src/") && !rel.startsWith("src/test/"))) {
    errors.push("ACTIVATION_PRODUCT_CODE_FORBIDDEN");
  }
  return errors;
}

function checkAmendment(root, base, commits, files, plan, mission, item) {
  const errors = [];
  const amendmentFiles = files.filter((rel) => AMENDMENT_PATTERN.test(rel));
  if (!files.includes(PLAN_PATH)) {
    if (amendmentFiles.length > 0) errors.push("AMENDMENT_PLAN_MISSING");
    return { errors, patterns: amendmentFiles, commit: null };
  }
  if (amendmentFiles.length !== 1) {
    errors.push(`AMENDMENT_RECEIPT_COUNT:${amendmentFiles.length}`);
    return { errors, patterns: [PLAN_PATH, "docs/delivery/amendments/*.json"], commit: null };
  }
  let baseRaw;
  let basePlan;
  try {
    baseRaw = gitFile(root, base, PLAN_PATH);
    basePlan = JSON.parse(baseRaw);
  } catch {
    errors.push("AMENDMENT_BASE_PLAN_UNREADABLE");
    return { errors, patterns: [PLAN_PATH, amendmentFiles[0]], commit: null };
  }
  const before = basePlan.packages?.find((entry) => entry.id === item.id);
  const after = plan.packages?.find((entry) => entry.id === item.id);
  if (!before || !after) errors.push("AMENDMENT_ACTIVE_PACKAGE_MISSING");
  const allowed = new Set(["kind", "editablePaths", "maxEditablePaths", "scopeOut", "acceptance", "externalPrerequisite"]);
  const beforeStable = JSON.parse(JSON.stringify(basePlan));
  const afterStable = JSON.parse(JSON.stringify(plan));
  const beforeIndex = beforeStable.packages.findIndex((entry) => entry.id === item.id);
  const afterIndex = afterStable.packages.findIndex((entry) => entry.id === item.id);
  let changedFields = [];
  if (beforeIndex !== afterIndex || beforeIndex < 0) {
    errors.push("AMENDMENT_TOPOLOGY");
  } else {
    changedFields = Object.keys({ ...before, ...after }).filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    );
    for (const key of changedFields) if (!allowed.has(key)) errors.push(`AMENDMENT_FIELD_FORBIDDEN:${key}`);
    if (changedFields.includes("kind") && !(before.kind === "GATE" && after.kind === "BUILD")) {
      errors.push(`AMENDMENT_KIND_TRANSITION:${before.kind}->${after.kind}`);
    }
    beforeStable.packages[beforeIndex] = afterStable.packages[afterIndex];
    if (JSON.stringify(beforeStable) !== JSON.stringify(afterStable)) errors.push("AMENDMENT_OUTSIDE_ACTIVE_PACKAGE");
    let receipt;
    try {
      receipt = JSON.parse(readFileSync(path.join(root, amendmentFiles[0]), "utf8"));
    } catch {
      errors.push("AMENDMENT_RECEIPT_INVALID_JSON");
    }
    if (receipt) {
      const expectedKeys = ["activePackage", "authorizedBy", "basePlanSha256", "changedFields", "reason", "requestedAt"];
      if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(expectedKeys.sort())) errors.push("AMENDMENT_RECEIPT_SCHEMA");
      if (receipt.activePackage !== item.id) errors.push("AMENDMENT_PACKAGE");
      if (receipt.basePlanSha256 !== hash(baseRaw)) errors.push("AMENDMENT_BASE_HASH");
      if (receipt.authorizedBy !== "OWNER_EXPLICIT_CURRENT_TASK") errors.push("AMENDMENT_AUTHORITY");
      if (typeof receipt.reason !== "string" || receipt.reason.trim().length < 20) errors.push("AMENDMENT_REASON");
      if (JSON.stringify([...(receipt.changedFields ?? [])].sort()) !== JSON.stringify(changedFields.sort())) {
        errors.push("AMENDMENT_CHANGED_FIELDS");
      }
      if (Number.isNaN(Date.parse(receipt.requestedAt ?? ""))) errors.push("AMENDMENT_TIMESTAMP");
    }
  }

  const amendmentCommits = commits.filter((commit) => {
    const paths = commitFiles(root, commit);
    return paths.includes(PLAN_PATH) || paths.includes(amendmentFiles[0]);
  });
  const amendmentCommit = amendmentCommits.length === 1 ? amendmentCommits[0] : null;
  if (!amendmentCommit) {
    errors.push(`AMENDMENT_COMMIT_COUNT:${amendmentCommits.length}`);
  } else {
    const amendmentPaths = commitFiles(root, amendmentCommit);
    for (const required of [PLAN_PATH, amendmentFiles[0], MISSION_PATH, item.focusedSpec, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`]) {
      if (!amendmentPaths.includes(required)) errors.push(`AMENDMENT_COMMIT_FILE_MISSING:${required}`);
    }
  }

  const amendmentIndex = amendmentCommit ? commits.indexOf(amendmentCommit) : commits.length;
  const recoveryEvidence = commits.slice(0, amendmentIndex).some((commit) => {
    try {
      const prior = parseMission(gitFile(root, commit, MISSION_PATH));
      return prior.phase === "FAIL_FINAL"
        || (prior.phase === "BLOCKED_PRODUCT_DECISION" && prior.resume_phase === "PREFLIGHT");
    } catch {
      return false;
    }
  });
  if (!recoveryEvidence) errors.push("AMENDMENT_RECOVERY_EVIDENCE_MISSING");
  if (amendmentCommit) {
    try {
      const atAmendment = parseMission(gitFile(root, amendmentCommit, MISSION_PATH));
      const expectedWriterCount = after?.kind === "BUILD" ? "1" : "0";
      const expectedScope = after?.kind === "BUILD" ? "ACTIVE_PACKAGE_EDITABLE_PATHS_ONLY" : "NO_WRITER_GATE";
      if (atAmendment.phase !== "PREFLIGHT" || atAmendment.attempt !== "1"
          || atAmendment.candidate_sha !== "none" || atAmendment.resume_phase !== "none"
          || atAmendment.block_reason !== "none" || atAmendment.writer_count !== expectedWriterCount
          || atAmendment.writer_scope_source !== expectedScope) {
        errors.push("AMENDMENT_MISSION_NOT_RESET_TO_PREFLIGHT");
      }
    } catch {
      errors.push("AMENDMENT_MISSION_UNREADABLE");
    }
  }
  if (mission.attempt !== "1") errors.push("AMENDMENT_ATTEMPT_NOT_ONE");
  return { errors, patterns: [PLAN_PATH, amendmentFiles[0]], commit: amendmentCommit };
}

function validatePreflight(root, item, evidenceRoot, baseSha, required, errors) {
  if (!required) return;
  const rel = `${evidenceRoot}/PREFLIGHT.md`;
  if (!existsSync(path.join(root, rel))) {
    errors.push(`PACKAGE_PREFLIGHT_RECEIPT_MISSING:${item.id}`);
    return;
  }
  const facts = parseFacts(readFileSync(path.join(root, rel), "utf8"));
  const marker = item.kind === "BUILD" ? "ASSERTIONS_RED" : "GATE_BASELINE";
  if (facts.PACKAGE !== item.id || facts.BASE_SHA !== baseSha || facts[marker] !== "PASS") {
    errors.push(`PACKAGE_PREFLIGHT_RECEIPT_INVALID:${item.id}`);
  }
  if (item.kind === "BUILD") {
    if (!facts.RED_RUN_ID || facts.RED_EXIT_NONZERO !== "PASS" || !facts.RED_FAILURE_ASSERTION) {
      errors.push(`PACKAGE_RED_EVIDENCE_INVALID:${item.id}`);
    }
  }
}

function validateReview(root, item, evidenceRoot, candidate, errors) {
  const receiptRel = `${evidenceRoot}/REVIEW.md`;
  const outputRel = `${evidenceRoot}/REVIEW_OUTPUT.md`;
  if (!existsSync(path.join(root, receiptRel)) || !existsSync(path.join(root, outputRel))) {
    errors.push(`PACKAGE_REVIEW_EVIDENCE_MISSING:${item.id}`);
    return;
  }
  const output = readFileSync(path.join(root, outputRel));
  const facts = parseFacts(readFileSync(path.join(root, receiptRel), "utf8"));
  const required = {
    PACKAGE: item.id,
    CANDIDATE_SHA: candidate,
    REVIEW: "PASS",
    REVIEWER_INDEPENDENT: "PASS",
    GATES: "PASS",
    REVIEW_EXIT: "0",
    REVIEW_OUTPUT_SHA256: hash(output),
  };
  for (const [key, value] of Object.entries(required)) if (facts[key] !== value) errors.push(`PACKAGE_REVIEW_RECEIPT_INVALID:${item.id}:${key}`);
  if (!/^[A-Za-z0-9._:-]{8,}$/.test(facts.REVIEW_RUN_ID ?? "")) errors.push(`PACKAGE_REVIEW_RUN_ID:${item.id}`);
  if (!facts.REVIEW_MODEL) errors.push(`PACKAGE_REVIEW_MODEL:${item.id}`);
  if (Number.isNaN(Date.parse(facts.REVIEW_STARTED_AT ?? "")) || Number.isNaN(Date.parse(facts.REVIEW_ENDED_AT ?? ""))) {
    errors.push(`PACKAGE_REVIEW_TIMESTAMPS:${item.id}`);
  }
}

function validateOwnerView(root, item, evidenceRoot, candidate, errors) {
  const receiptRel = `${evidenceRoot}/OWNER_VIEW.md`;
  if (!existsSync(path.join(root, receiptRel))) {
    errors.push(`PACKAGE_OWNER_VIEW_RECEIPT_MISSING:${item.id}`);
    return;
  }
  const facts = parseFacts(readFileSync(path.join(root, receiptRel), "utf8"));
  if (facts.PACKAGE !== item.id || facts.CANDIDATE_SHA !== candidate || facts.OWNER_VISUAL !== "PASS"
      || !/^https:\/\//.test(facts.PREVIEW_URL ?? "")) errors.push(`PACKAGE_OWNER_VIEW_RECEIPT_INVALID:${item.id}`);
  for (const viewport of ["1914x917", "1220x880", "390x844"]) {
    const rel = facts[`SCREENSHOT_${viewport}`];
    const full = rel ? path.join(root, rel) : "";
    if (!rel || !posix(rel).startsWith(`${evidenceRoot}/`) || !existsSync(full) || statSync(full).size === 0) {
      errors.push(`PACKAGE_OWNER_SCREENSHOT:${item.id}:${viewport}`);
    }
  }
}

function checkPackage(root, branch, base, baseSha, head, files, plan, mission) {
  const errors = [];
  const match = branch.match(/^codex\/kreile-(kr-l\d{2})$/);
  if (!match) return [`PACKAGE_BRANCH_INVALID:${branch}`];
  const packageId = match[1].toUpperCase();
  const item = plan.packages.find((entry) => entry.id === packageId);
  if (!item) return [`PACKAGE_BRANCH_UNKNOWN:${packageId}`];
  if (mission.active_package !== packageId) errors.push(`PACKAGE_MISSION_MISMATCH:${mission.active_package}:${packageId}`);
  if (mission.branch !== branch) errors.push(`PACKAGE_MISSION_BRANCH:${mission.branch}`);

  const evidencePattern = plan.operatingRules.evidenceReceiptPattern.replace("{packageIdLower}", packageId.toLowerCase());
  const evidenceRoot = evidencePattern.replace(/\/\*\*$/, "");
  const preflightReceipt = `${evidenceRoot}/PREFLIGHT.md`;
  const controlPatterns = [MISSION_PATH, "docs/project/CURRENT_STATE.md", item.focusedSpec, evidencePattern];
  const productPatterns = item.editablePaths;
  const commits = commitList(root, base, head);
  const amendment = checkAmendment(root, base, commits, files, plan, mission, item);
  errors.push(...amendment.errors);
  const allPatterns = [...controlPatterns, ...productPatterns, ...amendment.patterns];
  for (const rel of files) if (!covered(rel, allPatterns)) errors.push(`PACKAGE_SCOPE:${packageId}:${rel}`);

  if (commits.length === 0) errors.push(`PACKAGE_NO_COMMITS:${packageId}`);
  if (commits.length > 0) {
    const firstFiles = commitFiles(root, commits[0]);
    if (!firstFiles.includes(item.focusedSpec)) errors.push(`PACKAGE_FIRST_COMMIT_SPEC_MISSING:${packageId}`);
    if (!firstFiles.includes(MISSION_PATH)) errors.push(`PACKAGE_FIRST_COMMIT_MISSION_MISSING:${packageId}`);
    if (!firstFiles.includes(preflightReceipt)) errors.push(`PACKAGE_FIRST_COMMIT_PREFLIGHT_MISSING:${packageId}`);
    if (firstFiles.some((rel) => covered(rel, productPatterns))) errors.push(`PACKAGE_FIRST_COMMIT_PRODUCT_MIX:${packageId}`);
    const firstCommitPatterns = [MISSION_PATH, "docs/project/CURRENT_STATE.md", item.focusedSpec, preflightReceipt];
    if (firstFiles.some((rel) => !covered(rel, firstCommitPatterns))) errors.push(`PACKAGE_FIRST_COMMIT_CONTROL_SCOPE:${packageId}`);
    for (const [index, commit] of commits.entries()) {
      const paths = commitFiles(root, commit);
      if (index > 0 && paths.includes(item.focusedSpec) && commit !== amendment.commit) {
        errors.push(`PACKAGE_SPEC_CHANGED_AFTER_PREFLIGHT:${packageId}:${commit}`);
      }
      const hasControl = paths.some((rel) => covered(rel, [...controlPatterns, ...amendment.patterns]));
      const hasProduct = paths.some((rel) => covered(rel, productPatterns));
      if (hasControl && hasProduct) errors.push(`PACKAGE_COMMIT_ROLE_MIX:${packageId}:${commit}`);
    }
  }

  try {
    git(root, ["cat-file", "-e", `${base}:${item.focusedSpec}`]);
    errors.push(`PACKAGE_SPEC_PREEXISTED:${packageId}`);
  } catch {
    // Expected: every package introduces its own immutable focused spec.
  }
  validatePreflight(root, item, evidenceRoot, baseSha, !["TODO", "PREFLIGHT"].includes(mission.phase), errors);

  const candidatePhases = new Set(["REVIEW", "OWNER_VIEW", "CORRECTING", "READY_TO_MERGE", "DONE", "FAIL_FINAL"]);
  const resumeCandidate = ["REVIEW", "OWNER_VIEW", "CORRECTING"].includes(mission.resume_phase);
  const candidateRequired = candidatePhases.has(mission.phase)
    || (["BLOCKED_EXTERNAL", "BLOCKED_PRODUCT_DECISION"].includes(mission.phase) && resumeCandidate);
  const productCommits = commits.filter((commit) => commitFiles(root, commit).some((rel) => covered(rel, productPatterns)));
  if (item.kind === "BUILD" && candidateRequired && productCommits.length === 0) errors.push(`PACKAGE_PRODUCT_DELTA_MISSING:${packageId}`);
  if (item.kind === "GATE" && productCommits.length > 0) errors.push(`PACKAGE_GATE_PRODUCT_DELTA:${packageId}`);

  if (candidateRequired) {
    if (item.kind === "BUILD") {
      if (!isSha(mission.candidate_sha) || !commits.includes(mission.candidate_sha)) {
        errors.push(`PACKAGE_CANDIDATE_NOT_IN_RANGE:${packageId}:${mission.candidate_sha}`);
      } else {
        const lastProductCommit = productCommits.at(-1);
        if (lastProductCommit !== mission.candidate_sha) errors.push(`PACKAGE_CANDIDATE_NOT_LAST_PRODUCT_COMMIT:${packageId}`);
        const candidateIndex = commits.indexOf(mission.candidate_sha);
        for (const commit of commits.slice(candidateIndex + 1)) {
          if (commitFiles(root, commit).some((rel) => covered(rel, productPatterns))) {
            errors.push(`PACKAGE_PRODUCT_AFTER_CANDIDATE:${packageId}:${commit}`);
          }
        }
      }
    } else if (mission.candidate_sha !== baseSha) {
      errors.push(`PACKAGE_GATE_CANDIDATE_NOT_BASE:${packageId}:${mission.candidate_sha}:${baseSha}`);
    }
  } else if (mission.candidate_sha !== "none") {
    errors.push(`PACKAGE_EARLY_CANDIDATE_SHA:${packageId}:${mission.phase}`);
  }
  if (["OWNER_VIEW", "READY_TO_MERGE", "DONE"].includes(mission.phase)) {
    validateReview(root, item, evidenceRoot, mission.candidate_sha, errors);
  }
  if (["READY_TO_MERGE", "DONE"].includes(mission.phase) && item.ownerView) {
    validateOwnerView(root, item, evidenceRoot, mission.candidate_sha, errors);
  }
  return errors;
}

function checkClosure(root, baseSha, files, mission) {
  const errors = [];
  const evidence = "docs/evidence/live-line/kr-l20/LIVE_COMPLETE.md";
  const allowed = new Set([MISSION_PATH, "docs/project/CURRENT_STATE.md", evidence]);
  for (const rel of files) if (!allowed.has(rel)) errors.push(`CLOSE_SCOPE:${rel}`);
  if (mission.active_package !== "KR-L20" || mission.phase !== "DONE" || mission.branch !== CLOSE_BRANCH
      || mission.candidate_sha !== baseSha || mission.writer_count !== "0"
      || mission.last_completed_package !== "KR-L20" || mission.next_package !== "none"
      || mission.next_gate_after_active_package !== "LIVE_COMPLETE") errors.push("CLOSE_MISSION_INVALID");
  const full = path.join(root, evidence);
  if (!existsSync(full)) errors.push("CLOSE_EVIDENCE_MISSING");
  else {
    const facts = parseFacts(readFileSync(full, "utf8"));
    if (facts.DEPLOYMENT_SHA !== baseSha || facts.PRODUCTION_SMOKE !== "PASS"
        || !/^https:\/\//.test(facts.PRODUCTION_URL ?? "")
        || facts.MONITORING_HANDOFF !== "PASS" || facts.ROLLBACK_HANDOFF !== "PASS") {
      errors.push("CLOSE_EVIDENCE_INVALID");
    }
  }
  return errors;
}

export function checkLivePackageScope({ root, base, head, branch }) {
  const files = changedFiles(root, base, head);
  if (branch === "main") return [];
  const candidateMission = parseMission(readFileSync(path.join(root, MISSION_PATH), "utf8"));
  if (candidateMission.mission_id === "KREILE-VERKAUFSSTUFE-1") {
    const baseSha = resolved(root, base);
    if (branch === PR154_REBASELINE_BRANCH) return checkPr154Rebaseline(root, baseSha);
    if (branch === TA_B2_BRANCH) return checkTaB2Anchor(root, files, candidateMission, branch, baseSha);
    if (branch === TA_B2B_BRANCH) return checkTaB2bAnchor(root, files, candidateMission, branch, baseSha);
    if (branch === TA_B2C_BRANCH) return checkTaB2cAnchor(root, files, candidateMission, branch, baseSha);
    if (branch === TA_B2C2_BRANCH) return checkTaB2c2Anchor(root, files, candidateMission, branch, baseSha);
    if (branch === TA_B2C3_BRANCH) return checkTaB2c3Anchor(root, files, candidateMission, branch, baseSha);
    if (branch === TA_B2D2_BRANCH) return checkTaB2d2Anchor(root, files, candidateMission, branch, baseSha);
    if (branch === TA_B2E_BRANCH) return checkTaB2eAnchor(root, files, candidateMission, branch, baseSha);
    if (branch === TA_B2F_BRANCH) return checkTaB2fAnchor(root, files, candidateMission, branch, baseSha);
    if (branch === TA_B2H_BRANCH) return checkTaB2hAnchor(root, files, candidateMission, branch, baseSha);
    if (branch === TA_B2I_BRANCH) return checkTaB2iAnchor(root, files, candidateMission, branch, baseSha);
    if (branch === TA_B2J_BRANCH) return checkTaB2jAnchor(root, files, candidateMission, branch, baseSha);
    if (branch === TA_B2K1_BRANCH) return checkTaB2k1Anchor(root, files, candidateMission, branch, baseSha);
    if (candidateMission.active_block !== "B2") {
      return [`SALES_STAGE_ACTIVE_BLOCK_INVALID:${candidateMission.active_block}`];
    }
    const errors = checkSalesStageB2Scope(files, changedEntries(root, base, head), candidateMission, branch);
    const manifestChanged = files.includes("package.json"), lockChanged = files.includes("package-lock.json");
    if (manifestChanged !== lockChanged) errors.push("B2I_PARSER_MANIFEST_PAIR_REQUIRED");
    if (manifestChanged && lockChanged) {
      try {
        errors.push(...checkB2iParserChangesForTest({
          beforePackage: gitFile(root, base, "package.json"), afterPackage: gitFile(root, head, "package.json"),
          beforeLock: gitFile(root, base, "package-lock.json"), afterLock: gitFile(root, head, "package-lock.json"),
        }));
      } catch { errors.push("B2I_PARSER_MANIFEST_UNREADABLE"); }
    }
    return errors;
  }
  try {
    const baseMission = parseMission(gitFile(root, base, MISSION_PATH));
    if (baseMission.phase === "DONE" && baseMission.next_gate_after_active_package === "LIVE_COMPLETE") {
      const protectedChanges = files.filter((rel) => covered(rel, POST_LIVE_CONTROL_PATTERNS));
      return protectedChanges.map((rel) => `POST_LIVE_CONTROL_MUTATION:${rel}`);
    }
  } catch {
    // Before activation or in an isolated selftest, the normal package rules remain authoritative.
  }
  const baseSha = resolved(root, base);
  const plan = JSON.parse(readFileSync(path.join(root, PLAN_PATH), "utf8"));
  const mission = parseMission(readFileSync(path.join(root, MISSION_PATH), "utf8"));
  if (branch === ACTIVATION_BRANCH) return checkActivation(files, baseSha, plan);
  if (branch === CLOSE_BRANCH) return checkClosure(root, baseSha, files, mission);
  return checkPackage(root, branch, base, baseSha, head, files, plan, mission);
}

function write(root, rel, content) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, "utf8");
}

function setMission(text, values) {
  let next = text;
  for (const [key, value] of Object.entries(values)) next = next.replace(new RegExp(`^${key}:.*$`, "m"), `${key}: ${value}`);
  return next;
}

function missionFixture(plan, item) {
  return [
    "schema_version: 1",
    "mission_id: KREILE-LIVE-V1",
    "status: active",
    `plan_path: ${PLAN_PATH}`,
    `activation_condition: ${plan.activationCondition}`,
    `active_package: ${item.id}`,
    `active_package_position: ${item.position}`,
    `next_package: ${item.successor ?? "none"}`,
    "phase: PREFLIGHT",
    `branch: codex/kreile-${item.id.toLowerCase()}`,
    "base_ref: origin/main",
    `focused_spec: ${item.focusedSpec}`,
    "spec_owner: PL_ONLY_WRITER_FORBIDDEN",
    `writer_count: ${item.kind === "BUILD" ? "1" : "0"}`,
    `writer_scope_source: ${item.kind === "BUILD" ? "ACTIVE_PACKAGE_EDITABLE_PATHS_ONLY" : "NO_WRITER_GATE"}`,
    "reviewer: INDEPENDENT_EXACT_SHA",
    "attempt: 0",
    `last_completed_package: ${item.predecessor ?? "none"}`,
    "candidate_sha: none",
    `owner_visual_required: ${item.ownerView}`,
    "block_reason: none",
    "resume_phase: none",
    "next_gate_after_active_package: PL_CREATES_ASSERTIONS_RED_SPEC",
    "merge_rule: OWNER_EXPLICIT_AUTHORITY_ONLY",
    "production_rule: OWNER_AUTHORIZES_EACH_MAIN_DEPLOYMENT_FINAL_LIVE_DECLARATION_ONLY_AT_KR_L20",
    "updated_at: 2026-10-11T00:00:00.000Z",
    "",
  ].join("\n");
}

function commit(root, message) {
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", message]);
}

function reviewEvidence(item, candidate) {
  const output = `Independent review PASS for ${item.id} at ${candidate}\n`;
  return {
    output,
    receipt: [
      `PACKAGE=${item.id}`,
      `CANDIDATE_SHA=${candidate}`,
      "REVIEW=PASS",
      "REVIEWER_INDEPENDENT=PASS",
      "GATES=PASS",
      "REVIEW_RUN_ID=selftest-review-001",
      "REVIEW_MODEL=selftest-independent",
      "REVIEW_STARTED_AT=2026-10-11T00:00:00.000Z",
      "REVIEW_ENDED_AT=2026-10-11T00:01:00.000Z",
      "REVIEW_EXIT=0",
      `REVIEW_OUTPUT_SHA256=${hash(output)}`,
      "",
    ].join("\n"),
  };
}

function selftestPackage(fixture, plan, item) {
  write(fixture, PLAN_PATH, JSON.stringify(plan, null, 2));
  const baseMission = missionFixture(plan, item);
  write(fixture, MISSION_PATH, baseMission);
  commit(fixture, "base");
  const base = git(fixture, ["rev-parse", "HEAD"]);
  const branch = `codex/kreile-${item.id.toLowerCase()}`;
  git(fixture, ["checkout", "-qb", branch]);
  write(fixture, item.focusedSpec, "// immutable focused spec selftest\n");
  const preflight = item.kind === "BUILD"
    ? `PACKAGE=${item.id}\nASSERTIONS_RED=PASS\nBASE_SHA=${base}\nRED_RUN_ID=selftest-red-001\nRED_EXIT_NONZERO=PASS\nRED_FAILURE_ASSERTION=expected product assertion\n`
    : `PACKAGE=${item.id}\nGATE_BASELINE=PASS\nBASE_SHA=${base}\n`;
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, preflight);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: item.kind === "BUILD" ? "WRITING" : "REVIEW",
    candidate_sha: item.kind === "BUILD" ? "none" : base,
    next_gate_after_active_package: item.kind === "BUILD" ? "WRITER_COMPLETES_ACTIVE_SCOPE" : "INDEPENDENT_EXACT_SHA_REVIEW",
  }));
  commit(fixture, "PL preflight");
  let candidate = base;
  if (item.kind === "BUILD") {
    const product = item.editablePaths.find((rel) => !rel.includes("*"));
    if (!product) throw new Error(`Selftest package needs one exact editable path: ${item.id}`);
    write(fixture, product, "export const built = true;\n");
    commit(fixture, "writer product");
    candidate = git(fixture, ["rev-parse", "HEAD"]);
  }
  const evidence = reviewEvidence(item, candidate);
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/REVIEW_OUTPUT.md`, evidence.output);
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/REVIEW.md`, evidence.receipt);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "READY_TO_MERGE",
    candidate_sha: candidate,
    next_gate_after_active_package: "OWNER_MERGE_AUTHORITY",
  }));
  commit(fixture, "PL closure");
  const head = git(fixture, ["rev-parse", "HEAD"]);
  return { base, branch, head, candidate };
}

function selftestAmendment(fixture, plan, item) {
  write(fixture, PLAN_PATH, JSON.stringify(plan, null, 2));
  const baseMission = missionFixture(plan, item);
  write(fixture, MISSION_PATH, baseMission);
  commit(fixture, "base");
  const base = git(fixture, ["rev-parse", "HEAD"]);
  const branch = `codex/kreile-${item.id.toLowerCase()}`;
  git(fixture, ["checkout", "-qb", branch]);
  write(fixture, item.focusedSpec, "// immutable focused spec selftest\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, [
    `PACKAGE=${item.id}`,
    "ASSERTIONS_RED=PASS",
    `BASE_SHA=${base}`,
    "RED_RUN_ID=selftest-red-001",
    "RED_EXIT_NONZERO=PASS",
    "RED_FAILURE_ASSERTION=expected product assertion",
    "",
  ].join("\n"));
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "WRITING",
    next_gate_after_active_package: "WRITER_COMPLETES_ACTIVE_SCOPE",
  }));
  commit(fixture, "PL preflight");
  const product = item.editablePaths.find((rel) => !rel.includes("*"));
  write(fixture, product, "export const failedAttempt = true;\n");
  commit(fixture, "writer failed attempt");
  const failedCandidate = git(fixture, ["rev-parse", "HEAD"]);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "FAIL_FINAL",
    attempt: "1",
    candidate_sha: failedCandidate,
    next_gate_after_active_package: "OWNER_REPLANS_SAME_PACKAGE",
  }));
  commit(fixture, "PL final failure");

  const amended = JSON.parse(JSON.stringify(plan));
  amended.packages[0].acceptance = [...amended.packages[0].acceptance, "owner-authorized selftest clarification"];
  write(fixture, PLAN_PATH, JSON.stringify(amended, null, 2));
  write(fixture, item.focusedSpec, "// owner-authorized amended focused spec selftest\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, [
    `PACKAGE=${item.id}`,
    "ASSERTIONS_RED=PASS",
    `BASE_SHA=${base}`,
    "RED_RUN_ID=selftest-red-amended-001",
    "RED_EXIT_NONZERO=PASS",
    "RED_FAILURE_ASSERTION=amended expected product assertion",
    "",
  ].join("\n"));
  const baseRaw = gitFile(fixture, base, PLAN_PATH);
  write(fixture, "docs/delivery/amendments/KR-AMEND-0001.json", `${JSON.stringify({
    activePackage: item.id,
    authorizedBy: "OWNER_EXPLICIT_CURRENT_TASK",
    basePlanSha256: hash(baseRaw),
    changedFields: ["acceptance"],
    reason: "Selftest proves the only legal same-package recovery lane.",
    requestedAt: "2026-10-11T00:02:00.000Z",
  }, null, 2)}\n`);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "PREFLIGHT",
    attempt: "1",
    candidate_sha: "none",
    next_gate_after_active_package: "PL_CREATES_ASSERTIONS_RED_SPEC",
  }));
  commit(fixture, "owner-authorized same-package amendment");
  return { base, branch, head: git(fixture, ["rev-parse", "HEAD"]) };
}

function selftestBlockedPreflightAmendment(fixture, plan, item) {
  write(fixture, PLAN_PATH, JSON.stringify(plan, null, 2));
  const baseMission = missionFixture(plan, item);
  write(fixture, MISSION_PATH, baseMission);
  commit(fixture, "base");
  const base = git(fixture, ["rev-parse", "HEAD"]);
  const branch = `codex/kreile-${item.id.toLowerCase()}`;
  git(fixture, ["checkout", "-qb", branch]);
  write(fixture, item.focusedSpec, "// blocked preflight focused spec selftest\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, [
    `PACKAGE=${item.id}`,
    "ASSERTIONS_RED=PASS",
    `BASE_SHA=${base}`,
    "RED_RUN_ID=selftest-red-blocked-001",
    "RED_EXIT_NONZERO=PASS",
    "RED_FAILURE_ASSERTION=required path is outside package scope",
    "",
  ].join("\n"));
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "BLOCKED_PRODUCT_DECISION",
    block_reason: "required_path_outside_scope",
    resume_phase: "PREFLIGHT",
    next_gate_after_active_package: "OWNER_DECISION",
  }));
  commit(fixture, "PL blocks before writer start");

  const amended = JSON.parse(JSON.stringify(plan));
  amended.packages[0].acceptance = [...amended.packages[0].acceptance, "owner-authorized blocked-preflight clarification"];
  write(fixture, PLAN_PATH, JSON.stringify(amended, null, 2));
  write(fixture, item.focusedSpec, "// owner-authorized blocked-preflight spec rewrite\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, [
    `PACKAGE=${item.id}`,
    "ASSERTIONS_RED=PASS",
    `BASE_SHA=${base}`,
    "RED_RUN_ID=selftest-red-blocked-amended-001",
    "RED_EXIT_NONZERO=PASS",
    "RED_FAILURE_ASSERTION=amended required product assertion",
    "",
  ].join("\n"));
  const baseRaw = gitFile(fixture, base, PLAN_PATH);
  write(fixture, "docs/delivery/amendments/KR-AMEND-0001.json", `${JSON.stringify({
    activePackage: item.id,
    authorizedBy: "OWNER_EXPLICIT_CURRENT_TASK",
    basePlanSha256: hash(baseRaw),
    changedFields: ["acceptance"],
    reason: "Selftest proves blocked preflight can resume without a replacement package.",
    requestedAt: "2026-10-11T00:03:00.000Z",
  }, null, 2)}\n`);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "PREFLIGHT",
    attempt: "1",
    candidate_sha: "none",
    next_gate_after_active_package: "PL_CREATES_ASSERTIONS_RED_SPEC",
  }));
  commit(fixture, "owner-authorized blocked-preflight amendment");
  return { base, branch, head: git(fixture, ["rev-parse", "HEAD"]) };
}

function selftestGateToBuildAmendment(fixture, plan, item) {
  write(fixture, PLAN_PATH, JSON.stringify(plan, null, 2));
  const baseMission = missionFixture(plan, item);
  write(fixture, MISSION_PATH, baseMission);
  commit(fixture, "base");
  const base = git(fixture, ["rev-parse", "HEAD"]);
  const branch = `codex/kreile-${item.id.toLowerCase()}`;
  git(fixture, ["checkout", "-qb", branch]);
  write(fixture, item.focusedSpec, "// gate focused spec selftest\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, `PACKAGE=${item.id}\nGATE_BASELINE=PASS\nBASE_SHA=${base}\n`);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "REVIEW",
    candidate_sha: base,
    next_gate_after_active_package: "INDEPENDENT_EXACT_SHA_REVIEW",
  }));
  commit(fixture, "PL gate preflight");
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "FAIL_FINAL",
    attempt: "1",
    candidate_sha: base,
    next_gate_after_active_package: "OWNER_REPLANS_SAME_PACKAGE",
  }));
  commit(fixture, "PL gate final failure");

  const amended = JSON.parse(JSON.stringify(plan));
  const index = amended.packages.findIndex((entry) => entry.id === item.id);
  amended.packages[index].kind = "BUILD";
  amended.packages[index].editablePaths = ["src/app/live-gate-repair.tsx"];
  amended.packages[index].maxEditablePaths = 1;
  amended.packages[index].acceptance = [...amended.packages[index].acceptance, "owner-authorized bounded gate repair"];
  write(fixture, PLAN_PATH, JSON.stringify(amended, null, 2));
  write(fixture, item.focusedSpec, "// owner-authorized gate-to-build spec rewrite\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, [
    `PACKAGE=${item.id}`,
    "ASSERTIONS_RED=PASS",
    `BASE_SHA=${base}`,
    "RED_RUN_ID=selftest-gate-to-build-001",
    "RED_EXIT_NONZERO=PASS",
    "RED_FAILURE_ASSERTION=bounded gate repair assertion",
    "",
  ].join("\n"));
  const baseRaw = gitFile(fixture, base, PLAN_PATH);
  write(fixture, "docs/delivery/amendments/KR-AMEND-0001.json", `${JSON.stringify({
    activePackage: item.id,
    authorizedBy: "OWNER_EXPLICIT_CURRENT_TASK",
    basePlanSha256: hash(baseRaw),
    changedFields: ["acceptance", "editablePaths", "kind", "maxEditablePaths"],
    reason: "Selftest proves one failed gate can become one bounded build without a new package.",
    requestedAt: "2026-10-11T00:04:00.000Z",
  }, null, 2)}\n`);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "PREFLIGHT",
    attempt: "1",
    candidate_sha: "none",
    writer_count: "1",
    writer_scope_source: "ACTIVE_PACKAGE_EDITABLE_PATHS_ONLY",
    next_gate_after_active_package: "PL_CREATES_ASSERTIONS_RED_SPEC",
  }));
  commit(fixture, "owner-authorized gate-to-build amendment");
  return { base, branch, head: git(fixture, ["rev-parse", "HEAD"]) };
}

export function runSelftest(root = process.cwd()) {
  if (!covered("src/modules/orders/server/get.ts", ["src/modules/orders/**"])) throw new Error("glob positive failed");
  if (covered("src/modules/customers/server/get.ts", ["src/modules/orders/**"])) throw new Error("glob negative failed");
  if (!covered("supabase/migrations/20261103030000_ein2_erfassung.sql", ["supabase/migrations/*_ein[1-5]_*.sql"])) throw new Error("glob character-class positive failed");
  if (covered("supabase/migrations/20261103030000_ein6_erfassung.sql", ["supabase/migrations/*_ein[1-5]_*.sql"])) throw new Error("glob character-class negative failed");
  const salesStageMission = { active_block: "B2", branch: SALES_STAGE_B2_BRANCH };
  for (const rel of ["src/app/api/eingang-share/route.ts", "src/test/eingang_share.integration.test.ts", "src/app/nachrichten/page.tsx", "src/test/nachrichten_page.integration.test.ts"]) {
    const errors = checkSalesStageB2Scope([rel], [], salesStageMission, "kreile/b2-ein-3");
    if (errors.length) throw new Error(`P44 exact path rejected: ${rel}:${errors.join("|")}`);
  }
  for (const rel of ["src/app/api/eingang-share-extra/route.ts", "src/test/eingang_share_extra.integration.test.ts", "src/app/nachrichten-extra/page.tsx", "src/test/nachrichten_page_extra.integration.test.ts"]) {
    if (!checkSalesStageB2Scope([rel], [], salesStageMission, "kreile/b2-ein-3").includes(`SALES_STAGE_B2_SCOPE:${rel}`)) throw new Error(`P44 adjacent path accepted: ${rel}`);
  }
  const migrationA = "supabase/migrations/20261031212320_ap01_intake_item.sql";
  const validSalesStage = checkSalesStageB2Scope(
    ["src/modules/eingang/index.ts", ...SALES_STAGE_B2_EXACT_ALLOWLIST],
    [{ status: "A", path: migrationA }],
    salesStageMission,
    SALES_STAGE_B2_BRANCH,
  );
  if (validSalesStage.length > 0) throw new Error(`valid sales-stage B2 scope rejected: ${validSalesStage.join(" | ")}`);
  for (const rel of SALES_STAGE_B2_EXACT_ALLOWLIST) {
    const exactErrors = checkSalesStageB2Scope(
      [rel],
      rel === migrationA ? [{ status: "A", path: rel }] : [],
      salesStageMission,
      SALES_STAGE_B2_BRANCH,
    );
    if (exactErrors.length > 0) throw new Error(`exact B2 path rejected (${rel}): ${exactErrors.join(" | ")}`);
  }
  const validTaB2b = checkTaB2bScope(
    [".github/workflows/agentur-gate.yml", "docs/project/arbeitspakete/TRUST_ANCHOR_B2B.md", TA_B2B_BAUPLAN],
    {
      ...salesStageMission,
      phase: "WRITING",
      started_from_sha: TA_B2_BASE_SHA,
      desktop_due_at: "2026-11-08",
      tablet_mobile_due_at: "2026-11-08",
      handoff_path: "docs/delivery/ABGABE_B2.md",
      next_block: "B3",
    },
    TA_B2B_BRANCH,
    TA_B2B_BASE_SHA,
  );
  if (validTaB2b.length > 0) throw new Error(`valid TA-B2b scope rejected: ${validTaB2b.join(" | ")}`);
  const taB2bH18Mutation = checkTaB2bScope(
    ["scripts/quality/h18-server-actions.json"],
    {
      ...salesStageMission,
      phase: "WRITING",
      started_from_sha: TA_B2_BASE_SHA,
      desktop_due_at: "2026-11-08",
      tablet_mobile_due_at: "2026-11-08",
      handoff_path: "docs/delivery/ABGABE_B2.md",
      next_block: "B3",
    },
    TA_B2B_BRANCH,
    TA_B2B_BASE_SHA,
  );
  if (!taB2bH18Mutation.includes("TA_B2B_SCOPE:scripts/quality/h18-server-actions.json")) {
    throw new Error(`TA-B2b accepted the AP-01 H18 inventory mutation: ${taB2bH18Mutation.join(" | ")}`);
  }
  const taB2cMission = {
    ...salesStageMission,
    phase: "WRITING",
    started_from_sha: TA_B2_BASE_SHA,
    desktop_due_at: "2026-11-08",
    tablet_mobile_due_at: "2026-11-08",
    handoff_path: "docs/delivery/ABGABE_B2.md",
    next_block: "B3",
  };
  const validTaB2c = checkTaB2cScope(
    ["docs/project/arbeitspakete/TRUST_ANCHOR_B2C.md", TA_B2C_BAUPLAN, TA_B2C_RECEIPT],
    taB2cMission,
    TA_B2C_BRANCH,
    TA_B2C_BASE_SHA,
  );
  if (validTaB2c.length > 0) throw new Error(`valid TA-B2c scope rejected: ${validTaB2c.join(" | ")}`);
  for (const allowed of [
    "src/test/acceptance/ap01b_eingang_bestandskunde_unvollstaendig.integration.test.ts",
    "docs/delivery/ABGABE_AP-K1.md",
  ]) {
    const allowedErrors = checkSalesStageB2Scope([allowed], [], salesStageMission, SALES_STAGE_B2_BRANCH);
    if (allowedErrors.length > 0) throw new Error(`TA-B2c pattern rejected (${allowed}): ${allowedErrors.join(" | ")}`);
  }
  for (const rejected of [
    "src/test/acceptance/x.test.ts",
    "src/test/x.integration.test.ts",
    "docs/delivery/ABGABE_B3.md",
    TA_B2C_BAUPLAN,
  ]) {
    const rejectedErrors = checkSalesStageB2Scope([rejected], [], salesStageMission, SALES_STAGE_B2_BRANCH);
    if (!rejectedErrors.includes(`SALES_STAGE_B2_SCOPE:${rejected}`)) {
      throw new Error(`TA-B2c pattern accepted (${rejected}): ${rejectedErrors.join(" | ")}`);
    }
  }
  const taB2cOutside = checkTaB2cScope(["src/app/page.tsx"], taB2cMission, TA_B2C_BRANCH, TA_B2C_BASE_SHA);
  if (!taB2cOutside.includes("TA_B2C_SCOPE:src/app/page.tsx")) {
    throw new Error(`TA-B2c accepted an out-of-anchor file: ${taB2cOutside.join(" | ")}`);
  }
  const validTaB2c2 = checkTaB2c2Scope(
    ["docs/project/arbeitspakete/TRUST_ANCHOR_B2C2.md", TA_B2C2_RECEIPT],
    taB2cMission,
    TA_B2C2_BRANCH,
    TA_B2C2_BASE_SHA,
  );
  if (validTaB2c2.length > 0) throw new Error(`valid TA-B2c2 scope rejected: ${validTaB2c2.join(" | ")}`);
  for (const allowed of [
    "src/lib/server/commands/orderIntakeCommand.ts",
    "src/lib/server/commands/__tests__/orderIntakeCommand.test.ts",
  ]) {
    const allowedErrors = checkSalesStageB2Scope([allowed], [], salesStageMission, SALES_STAGE_B2_BRANCH);
    if (allowedErrors.length > 0) throw new Error(`TA-B2c2 path rejected (${allowed}): ${allowedErrors.join(" | ")}`);
  }
  const taB2c2Outside = checkTaB2c2Scope(["src/app/page.tsx"], taB2cMission, TA_B2C2_BRANCH, TA_B2C2_BASE_SHA);
  if (!taB2c2Outside.includes("TA_B2C2_SCOPE:src/app/page.tsx")) {
    throw new Error(`TA-B2c2 accepted an out-of-anchor file: ${taB2c2Outside.join(" | ")}`);
  }
  const validTaB2c3 = checkTaB2c3Scope(
    ["docs/project/arbeitspakete/TRUST_ANCHOR_B2C3.md", TA_B2C3_RECEIPT],
    taB2cMission,
    TA_B2C3_BRANCH,
    TA_B2C3_BASE_SHA,
  );
  if (validTaB2c3.length > 0) throw new Error(`valid TA-B2c3 scope rejected: ${validTaB2c3.join(" | ")}`);
  for (const allowed of [
    "src/lib/server/orderIntakeRead.ts",
    "src/lib/server/__tests__/orderIntakeRead.test.ts",
  ]) {
    const allowedErrors = checkSalesStageB2Scope([allowed], [], salesStageMission, SALES_STAGE_B2_BRANCH);
    if (allowedErrors.length > 0) throw new Error(`TA-B2c3 path rejected (${allowed}): ${allowedErrors.join(" | ")}`);
  }
  const taB2c3Outside = checkTaB2c3Scope(["src/app/page.tsx"], taB2cMission, TA_B2C3_BRANCH, TA_B2C3_BASE_SHA);
  if (!taB2c3Outside.includes("TA_B2C3_SCOPE:src/app/page.tsx")) {
    throw new Error(`TA-B2c3 accepted an out-of-anchor file: ${taB2c3Outside.join(" | ")}`);
  }
  const validTaB2d2 = checkTaB2d2Scope(TA_B2D2_REQUIRED_FILES, taB2cMission, TA_B2D2_BRANCH, TA_B2D2_BASE_SHA);
  if (validTaB2d2.length > 0) throw new Error(`valid TA-B2d2 scope rejected: ${validTaB2d2.join(" | ")}`);
  const taB2d2Outside = checkTaB2d2Scope(["src/app/page.tsx"], taB2cMission, TA_B2D2_BRANCH, TA_B2D2_BASE_SHA);
  if (!taB2d2Outside.includes("TA_B2D2_SCOPE:src/app/page.tsx")) {
    throw new Error(`TA-B2d2 accepted an out-of-anchor file: ${taB2d2Outside.join(" | ")}`);
  }
  const validTaB2e = checkTaB2eScope(TA_B2E_REQUIRED_FILES, taB2cMission, TA_B2E_BRANCH, TA_B2E_BASE_SHA);
  if (validTaB2e.length > 0) throw new Error(`valid TA-B2e scope rejected: ${validTaB2e.join(" | ")}`);
  const taB2eOutside = checkTaB2eScope(["src/app/page.tsx"], taB2cMission, TA_B2E_BRANCH, TA_B2E_BASE_SHA);
  if (!taB2eOutside.includes("TA_B2E_SCOPE:src/app/page.tsx")) {
    throw new Error(`TA-B2e accepted an out-of-anchor file: ${taB2eOutside.join(" | ")}`);
  }
  for (const allowed of [
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
    const allowedErrors = checkSalesStageB2Scope([allowed], [], salesStageMission, SALES_STAGE_B2_BRANCH);
    if (allowedErrors.length > 0) throw new Error(`TA-B2e path rejected (${allowed}): ${allowedErrors.join(" | ")}`);
  }
  const adjacentOrderCardPath = "src/lib/server/orderCardWrite.ts";
  const adjacentOrderCardErrors = checkSalesStageB2Scope(
    [adjacentOrderCardPath],
    [],
    salesStageMission,
    SALES_STAGE_B2_BRANCH,
  );
  if (!adjacentOrderCardErrors.includes(`SALES_STAGE_B2_SCOPE:${adjacentOrderCardPath}`)) {
    throw new Error(`TA-B2e accepted an adjacent order-card path: ${adjacentOrderCardErrors.join(" | ")}`);
  }
  const adjacentFontPath = "src/app/font-cache/localFonts.ts";
  const adjacentFontErrors = checkSalesStageB2Scope(
    [adjacentFontPath],
    [],
    salesStageMission,
    SALES_STAGE_B2_BRANCH,
  );
  if (!adjacentFontErrors.includes(`SALES_STAGE_B2_SCOPE:${adjacentFontPath}`)) {
    throw new Error(`TA-B2e accepted an adjacent font path: ${adjacentFontErrors.join(" | ")}`);
  }
  const adjacentBaselinePath = "quality/other-module-gates-baseline.json";
  const adjacentBaselineErrors = checkSalesStageB2Scope(
    [adjacentBaselinePath],
    [],
    salesStageMission,
    SALES_STAGE_B2_BRANCH,
  );
  if (!adjacentBaselineErrors.includes(`SALES_STAGE_B2_SCOPE:${adjacentBaselinePath}`)) {
    throw new Error(`TA-B2e accepted an adjacent baseline path: ${adjacentBaselineErrors.join(" | ")}`);
  }
  const adjacentOrderUiPath = "src/modules/inventory/ui/InventoryListView.tsx";
  const adjacentOrderUiErrors = checkSalesStageB2Scope(
    [adjacentOrderUiPath],
    [],
    salesStageMission,
    SALES_STAGE_B2_BRANCH,
  );
  if (!adjacentOrderUiErrors.includes(`SALES_STAGE_B2_SCOPE:${adjacentOrderUiPath}`)) {
    throw new Error(`TA-B2e accepted an adjacent order UI path: ${adjacentOrderUiErrors.join(" | ")}`);
  }
  const apRUnitMigration = "supabase/migrations/20261103010000_ap_r_freitext_einheiten.sql";
  const apRUnitMigrationErrors = checkSalesStageB2Scope(
    [apRUnitMigration],
    [{ status: "A", path: apRUnitMigration }],
    salesStageMission,
    SALES_STAGE_B2_BRANCH,
  );
  if (apRUnitMigrationErrors.length > 0) {
    throw new Error(`TA-B2e AP-R migration rejected: ${apRUnitMigrationErrors.join(" | ")}`);
  }
  const adjacentMigration = "supabase/migrations/20261103010000_ap_r_other.sql";
  const adjacentMigrationErrors = checkSalesStageB2Scope(
    [adjacentMigration],
    [{ status: "A", path: adjacentMigration }],
    salesStageMission,
    SALES_STAGE_B2_BRANCH,
  );
  if (!adjacentMigrationErrors.includes(`SALES_STAGE_B2_SCOPE:${adjacentMigration}`)
      || !adjacentMigrationErrors.includes(`SALES_STAGE_B2_MIGRATION_INVALID:${adjacentMigration}`)) {
    throw new Error(`TA-B2e accepted an adjacent migration: ${adjacentMigrationErrors.join(" | ")}`);
  }
  const changedApRMigrationErrors = checkSalesStageB2Scope(
    [apRUnitMigration],
    [{ status: "M", path: apRUnitMigration }],
    salesStageMission,
    SALES_STAGE_B2_BRANCH,
  );
  if (!changedApRMigrationErrors.includes(`SALES_STAGE_B2_MIGRATION_NOT_NEW:${apRUnitMigration}`)) {
    throw new Error(`TA-B2e accepted a changed AP-R migration: ${changedApRMigrationErrors.join(" | ")}`);
  }
  const p42Before = JSON.stringify({ judgeContractHash: "d322170885867420ca489927b5ad52522206e06009c5afb619d5159d4147752b", lintContractHash: "unchanged", issues: [], ignoredCodeFiles: [] }, null, 2) + "\n";
  const p42After = p42Before.replace("d322170885867420ca489927b5ad52522206e06009c5afb619d5159d4147752b", "f02832e8e3da8367b3604c5f356b6df95fe61310a2c24d04d5b8105b582aab88");
  if (checkTaB2fBaselineChangeForTest({ before: p42Before, after: p42After }).length) throw new Error("P42 valid one-field migration rejected");
  const p42Mutations = [p42Before, p42After + "\n", p42After.replace('"issues": []', '"issues": [1]'), p42After.replace('"ignoredCodeFiles": []', '"ignoredCodeFiles": [1]'), p42After.replace('"lintContractHash": "unchanged"', '"lintContractHash": "changed"'), p42After.replace("{", '{"extra":true,')];
  for (const after of p42Mutations) if (!checkTaB2fBaselineChangeForTest({ before: p42Before, after }).includes("TA_B2F_BASELINE_CHANGE_NOT_AUTHORIZED")) throw new Error("P42 accepted an additional baseline mutation");
  const validTaB2f = checkTaB2fScope(TA_B2F_REQUIRED_FILES, taB2cMission, TA_B2F_BRANCH, TA_B2F_BASE_SHA);
  if (validTaB2f.length > 0) throw new Error(`valid TA-B2f scope rejected: ${validTaB2f.join(" | ")}`);
  const taB2fOutside = checkTaB2fScope(["src/app/page.tsx"], taB2cMission, TA_B2F_BRANCH, TA_B2F_BASE_SHA);
  if (!taB2fOutside.includes("TA_B2F_SCOPE:src/app/page.tsx")) {
    throw new Error(`TA-B2f accepted an out-of-anchor file: ${taB2fOutside.join(" | ")}`);
  }
  if (checkTaB2fScope([TA_B2F_BAUPLAN], taB2cMission, TA_B2F_BRANCH, TA_B2F_BASE_SHA).length) {
    throw new Error("TA-B2f Fassung 4 rejected its pinned Bauplan");
  }
  for (const rel of ["src/app/globals.css", "src/styles/tokens.css", "src/ui/kr/Dialog.tsx", "docs/project/endversion/ui/routen.json"]) {
    const errors = checkSalesStageB2Scope([rel], [], salesStageMission, "kreile/b2-ein-0b");
    if (errors.length) throw new Error(`TA-B2f 0b path rejected (${rel}): ${errors.join(" | ")}`);
  }
  for (const rel of ["docs/project/endversion/ui/SICHTVERTRAG.json", "docs/project/endversion/ui/pruefe_sicht.cjs", "docs/project/endversion/ui/endversion_design.css"]) {
    if (!checkSalesStageB2Scope([rel], [], salesStageMission, "kreile/b2-ein-0b").includes(`SALES_STAGE_B2_SCOPE:${rel}`)) throw new Error(`Product scope accepted an immutable UI source: ${rel}`);
  }
  for (const rel of [
    "public/manifest.webmanifest",
    "public/icons/icon-192.png",
    "src/modules/communications/public.ts",
    "src/modules/complaints/public.ts",
    "src/modules/customers/public.ts",
    "src/modules/eingang/public.ts",
    "src/modules/supplier-invoices/public.ts",
    "src/modules/tasks/public.ts",
    "src/db/schema.ts",
    "src/lib/server/microsoftGraph.ts",
    "src/components/layout/F1SourceDialogs.tsx",
  ]) {
    const allowedErrors = checkSalesStageB2Scope([rel], [], salesStageMission, "kreile/b2-ein-1");
    if (allowedErrors.length > 0) throw new Error(`TA-B2f AP-EIN path rejected (${rel}): ${allowedErrors.join(" | ")}`);
  }
  for (const migration of [
    "supabase/migrations/20261103020000_b2_kunde_k1.sql",
    "supabase/migrations/20261103030000_ein2_erfassung.sql",
    "supabase/migrations/20261103040000_ein3_ware_original.sql",
    "supabase/migrations/20261103050000_ein4_nachrichten.sql",
    "supabase/migrations/20261103060000_ein5_eingangsrechnungen.sql",
    "supabase/migrations/20261103070000_ein6_korrekturen.sql",
  ]) {
    const migrationErrors = checkSalesStageB2Scope(
      [migration],
      [{ status: "A", path: migration }],
      salesStageMission,
      "kreile/b2-ein-2",
    );
    if (migrationErrors.length > 0) throw new Error(`TA-B2f migration rejected (${migration}): ${migrationErrors.join(" | ")}`);
  }
  const apgAprPaths = [
    apRUnitMigration,
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
    "src/lib/server/commands/orderIntakeCommand.ts",
    "src/modules/eingang/GlobalCreateFlow.tsx",
    "src/modules/eingang/requestGlobalCreate.ts",
    "src/ui/kr/Dialog.tsx",
    "src/ui/kr/GlobalesPlus.tsx",
  ];
  for (const rel of apgAprPaths) {
    const allowedErrors = checkSalesStageB2Scope([rel], [], salesStageMission, SALES_STAGE_B2_BRANCH);
    if (allowedErrors.length > 0) throw new Error(`TA-B2d2 AP-G/AP-R path rejected (${rel}): ${allowedErrors.join(" | ")}`);
  }
  const adjacentCommand = "src/lib/server/commands/unrelatedBillingCommand.ts";
  const adjacentErrors = checkSalesStageB2Scope([adjacentCommand], [], salesStageMission, SALES_STAGE_B2_BRANCH);
  if (!adjacentErrors.includes(`SALES_STAGE_B2_SCOPE:${adjacentCommand}`)) {
    throw new Error(`TA-B2c2 accepted an adjacent command: ${adjacentErrors.join(" | ")}`);
  }
  const outsideErrors = checkSalesStageB2Scope(
    ["src/modules/inventory/server/get.ts"],
    [],
    salesStageMission,
    SALES_STAGE_B2_BRANCH,
  );
  if (!outsideErrors.includes("SALES_STAGE_B2_SCOPE:src/modules/inventory/server/get.ts")) {
    throw new Error(`out-of-scope B2 path accepted: ${outsideErrors.join(" | ")}`);
  }
  const secondMigration = "supabase/migrations/20261102080100_ap01_intake_item.sql";
  const twoMigrationErrors = checkSalesStageB2Scope(
    [migrationA, secondMigration],
    [{ status: "A", path: migrationA }, { status: "A", path: secondMigration }],
    salesStageMission,
    SALES_STAGE_B2_BRANCH,
  );
  if (!twoMigrationErrors.includes("SALES_STAGE_B2_MIGRATION_COUNT:2")) {
    throw new Error(`second B2 migration accepted: ${twoMigrationErrors.join(" | ")}`);
  }
  const changedMigrationErrors = checkSalesStageB2Scope(
    [migrationA],
    [{ status: "M", path: migrationA }],
    salesStageMission,
    SALES_STAGE_B2_BRANCH,
  );
  if (!changedMigrationErrors.includes(`SALES_STAGE_B2_MIGRATION_NOT_NEW:${migrationA}`)) {
    throw new Error(`changed B2 migration accepted: ${changedMigrationErrors.join(" | ")}`);
  }
  const b1BranchErrors = checkSalesStageB2Scope(
    ["src/modules/eingang/index.ts"],
    [],
    salesStageMission,
    "kreile/b1-shell",
  );
  if (!b1BranchErrors.includes("SALES_STAGE_BRANCH_INVALID:kreile/b1-shell")) {
    throw new Error(`B1 branch accepted for new work: ${b1BranchErrors.join(" | ")}`);
  }
  for (const protectedFile of ["AGENTS.md", "missions/F1_ORDER_TO_CASH_PILOT_001.yml", "scripts/quality/check-delivery-contracts.mjs"]) {
    const protectedErrors = checkSalesStageB2Scope([protectedFile], [], salesStageMission, SALES_STAGE_B2_BRANCH);
    if (!protectedErrors.includes(`SALES_STAGE_B2_SCOPE:${protectedFile}`)) {
      throw new Error(`sales-stage governance mutation accepted: ${protectedFile}`);
    }
  }
  const rebaselineFixture = mkdtempSync(path.join(tmpdir(), "kreile-pr154-rebaseline-"));
  try {
    git(rebaselineFixture, ["init", "-q"]);
    git(rebaselineFixture, ["config", "user.email", "pr154-selftest@example.invalid"]);
    git(rebaselineFixture, ["config", "user.name", "PR154 Selftest"]);
    git(rebaselineFixture, ["config", "commit.gpgsign", "false"]);
    for (const rel of PR154_TRUST_ANCHOR_BASE_FILES) write(rebaselineFixture, rel, `protected-v1:${rel}\n`);
    write(rebaselineFixture, PR154_REBASELINE_RECEIPT, `${JSON.stringify({
      ...PR154_REBASELINE_VALUES,
      reason: "Owner-authorized one-time cumulative rebaseline after retargeting pull request 154 to main.",
    }, null, 2)}\n`);
    commit(rebaselineFixture, "original protected base");
    const fixtureOriginalBase = git(rebaselineFixture, ["rev-parse", "HEAD"]);
    const validRebaseline = checkPr154Rebaseline(rebaselineFixture, PR154_REBASELINE_BASE_SHA);
    if (validRebaseline.length > 0) throw new Error(`valid PR154 rebaseline rejected: ${validRebaseline.join(" | ")}`);
    for (const rel of PR154_TRUST_ANCHOR_BASE_FILES) write(rebaselineFixture, rel, `protected-v2:${rel}\n`);
    commit(rebaselineFixture, "approved trust anchors only");
    const fixtureTrustAnchor = git(rebaselineFixture, ["rev-parse", "HEAD"]);
    write(rebaselineFixture, "quality/eslint-baseline.json", "candidate ratchet migration\n");
    const validTrustAnchor = checkPr154Rebaseline(rebaselineFixture, fixtureTrustAnchor, fixtureOriginalBase);
    if (validTrustAnchor.length > 0) {
      throw new Error(`valid PR154 trust-anchor base rejected: ${validTrustAnchor.join(" | ")}`);
    }
    write(rebaselineFixture, "unexpected.txt", "not approved\n");
    commit(rebaselineFixture, "unexpected second base commit");
    const fixtureUnexpectedBase = git(rebaselineFixture, ["rev-parse", "HEAD"]);
    const invalidTrustAnchor = checkPr154Rebaseline(rebaselineFixture, fixtureUnexpectedBase, fixtureOriginalBase);
    if (!invalidTrustAnchor.some((error) => error.startsWith("PR154_TRUST_ANCHOR_COMMIT_COUNT:"))
        || !invalidTrustAnchor.some((error) => error.startsWith("PR154_TRUST_ANCHOR_FILES:"))) {
      throw new Error(`expanded PR154 trust-anchor base not rejected: ${invalidTrustAnchor.join(" | ")}`);
    }
    const movedBase = checkPr154Rebaseline(rebaselineFixture, "b".repeat(40));
    if (!movedBase.some((error) => error.startsWith("PR154_REBASELINE_BASE_INVALID:"))) {
      throw new Error(`moved PR154 base not rejected: ${movedBase.join(" | ")}`);
    }
    const changedReceipt = JSON.parse(readFileSync(path.join(rebaselineFixture, PR154_REBASELINE_RECEIPT), "utf8"));
    changedReceipt.followingPullRequests = "RELAXED";
    write(rebaselineFixture, PR154_REBASELINE_RECEIPT, `${JSON.stringify(changedReceipt, null, 2)}\n`);
    const invalidReceipt = checkPr154Rebaseline(rebaselineFixture, PR154_REBASELINE_BASE_SHA);
    if (!invalidReceipt.includes("PR154_REBASELINE_RECEIPT_VALUE:followingPullRequests")) {
      throw new Error(`changed PR154 receipt not rejected: ${invalidReceipt.join(" | ")}`);
    }
  } finally {
    rmSync(rebaselineFixture, { recursive: true, force: true });
  }
  const plan = JSON.parse(readFileSync(path.join(root, PLAN_PATH), "utf8"));
  const fixture = mkdtempSync(path.join(tmpdir(), "kreile-live-scope-"));
  try {
    git(fixture, ["init", "-q"]);
    git(fixture, ["config", "user.email", "scope-selftest@example.invalid"]);
    git(fixture, ["config", "user.name", "Scope Selftest"]);
    git(fixture, ["config", "commit.gpgsign", "false"]);
    const build = selftestPackage(fixture, plan, plan.packages[0]);
    const valid = checkLivePackageScope({ root: fixture, base: build.base, head: build.head, branch: build.branch });
    if (valid.length > 0) throw new Error(`valid build package rejected: ${valid.join(" | ")}`);
    write(fixture, plan.packages[0].editablePaths[0], "export const built = false;\n");
    commit(fixture, "late unreviewed product");
    const late = git(fixture, ["rev-parse", "HEAD"]);
    const invalid = checkLivePackageScope({ root: fixture, base: build.base, head: late, branch: build.branch });
    if (!invalid.some((error) => error.startsWith("PACKAGE_CANDIDATE_NOT_LAST_PRODUCT_COMMIT"))) {
      throw new Error(`late product mutation not rejected: ${invalid.join(" | ")}`);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }

  const gateFixture = mkdtempSync(path.join(tmpdir(), "kreile-live-gate-"));
  try {
    git(gateFixture, ["init", "-q"]);
    git(gateFixture, ["config", "user.email", "gate-selftest@example.invalid"]);
    git(gateFixture, ["config", "user.name", "Gate Selftest"]);
    git(gateFixture, ["config", "commit.gpgsign", "false"]);
    const gate = selftestPackage(gateFixture, plan, plan.packages[16]);
    const validGate = checkLivePackageScope({ root: gateFixture, base: gate.base, head: gate.head, branch: gate.branch });
    if (validGate.length > 0) throw new Error(`valid gate package rejected: ${validGate.join(" | ")}`);
  } finally {
    rmSync(gateFixture, { recursive: true, force: true });
  }

  const amendmentFixture = mkdtempSync(path.join(tmpdir(), "kreile-live-amendment-"));
  try {
    git(amendmentFixture, ["init", "-q"]);
    git(amendmentFixture, ["config", "user.email", "amendment-selftest@example.invalid"]);
    git(amendmentFixture, ["config", "user.name", "Amendment Selftest"]);
    git(amendmentFixture, ["config", "commit.gpgsign", "false"]);
    const amendment = selftestAmendment(amendmentFixture, plan, plan.packages[0]);
    const validAmendment = checkLivePackageScope({
      root: amendmentFixture,
      base: amendment.base,
      head: amendment.head,
      branch: amendment.branch,
    });
    if (validAmendment.length > 0) throw new Error(`valid amendment rejected: ${validAmendment.join(" | ")}`);
  } finally {
    rmSync(amendmentFixture, { recursive: true, force: true });
  }

  const blockedAmendmentFixture = mkdtempSync(path.join(tmpdir(), "kreile-live-blocked-amendment-"));
  try {
    git(blockedAmendmentFixture, ["init", "-q"]);
    git(blockedAmendmentFixture, ["config", "user.email", "blocked-amendment-selftest@example.invalid"]);
    git(blockedAmendmentFixture, ["config", "user.name", "Blocked Amendment Selftest"]);
    git(blockedAmendmentFixture, ["config", "commit.gpgsign", "false"]);
    const amendment = selftestBlockedPreflightAmendment(blockedAmendmentFixture, plan, plan.packages[0]);
    const validAmendment = checkLivePackageScope({
      root: blockedAmendmentFixture,
      base: amendment.base,
      head: amendment.head,
      branch: amendment.branch,
    });
    if (validAmendment.length > 0) throw new Error(`valid blocked-preflight amendment rejected: ${validAmendment.join(" | ")}`);
  } finally {
    rmSync(blockedAmendmentFixture, { recursive: true, force: true });
  }

  const gateAmendmentFixture = mkdtempSync(path.join(tmpdir(), "kreile-live-gate-amendment-"));
  try {
    git(gateAmendmentFixture, ["init", "-q"]);
    git(gateAmendmentFixture, ["config", "user.email", "gate-amendment-selftest@example.invalid"]);
    git(gateAmendmentFixture, ["config", "user.name", "Gate Amendment Selftest"]);
    git(gateAmendmentFixture, ["config", "commit.gpgsign", "false"]);
    const amendment = selftestGateToBuildAmendment(gateAmendmentFixture, plan, plan.packages[16]);
    const validAmendment = checkLivePackageScope({
      root: gateAmendmentFixture,
      base: amendment.base,
      head: amendment.head,
      branch: amendment.branch,
    });
    if (validAmendment.length > 0) throw new Error(`valid gate-to-build amendment rejected: ${validAmendment.join(" | ")}`);
  } finally {
    rmSync(gateAmendmentFixture, { recursive: true, force: true });
  }

  const closeFixture = mkdtempSync(path.join(tmpdir(), "kreile-live-close-"));
  try {
    git(closeFixture, ["init", "-q"]);
    git(closeFixture, ["config", "user.email", "close-selftest@example.invalid"]);
    git(closeFixture, ["config", "user.name", "Close Selftest"]);
    git(closeFixture, ["config", "commit.gpgsign", "false"]);
    const final = plan.packages.at(-1);
    write(closeFixture, PLAN_PATH, JSON.stringify(plan, null, 2));
    const readyMission = setMission(missionFixture(plan, final), {
      phase: "READY_TO_MERGE",
      candidate_sha: "a".repeat(40),
      next_gate_after_active_package: "OWNER_MERGE_AUTHORITY",
    });
    write(closeFixture, MISSION_PATH, readyMission);
    commit(closeFixture, "merged KR-L20 gate");
    const base = git(closeFixture, ["rev-parse", "HEAD"]);
    git(closeFixture, ["checkout", "-qb", CLOSE_BRANCH]);
    write(closeFixture, "docs/evidence/live-line/kr-l20/LIVE_COMPLETE.md", [
      `DEPLOYMENT_SHA=${base}`,
      "PRODUCTION_SMOKE=PASS",
      "PRODUCTION_URL=https://example.invalid",
      "MONITORING_HANDOFF=PASS",
      "ROLLBACK_HANDOFF=PASS",
      "",
    ].join("\n"));
    write(closeFixture, MISSION_PATH, setMission(readyMission, {
      phase: "DONE",
      branch: CLOSE_BRANCH,
      candidate_sha: base,
      last_completed_package: "KR-L20",
      next_gate_after_active_package: "LIVE_COMPLETE",
    }));
    commit(closeFixture, "close live line");
    const head = git(closeFixture, ["rev-parse", "HEAD"]);
    const validClose = checkLivePackageScope({ root: closeFixture, base, head, branch: CLOSE_BRANCH });
    if (validClose.length > 0) throw new Error(`valid close rejected: ${validClose.join(" | ")}`);

    git(closeFixture, ["checkout", "-qb", "hotfix/post-live-product"]);
    write(closeFixture, "src/app/post-live-health.tsx", "export const postLiveHealth = true;\n");
    commit(closeFixture, "normal post-live product hotfix");
    const hotfixHead = git(closeFixture, ["rev-parse", "HEAD"]);
    const validHotfix = checkLivePackageScope({ root: closeFixture, base: head, head: hotfixHead, branch: "hotfix/post-live-product" });
    if (validHotfix.length > 0) throw new Error(`valid post-live product hotfix rejected: ${validHotfix.join(" | ")}`);

    git(closeFixture, ["checkout", "-q", head]);
    git(closeFixture, ["checkout", "-qb", "hotfix/post-live-control"]);
    write(closeFixture, "AGENTS.md", "unauthorized live-line control mutation\n");
    commit(closeFixture, "mutate post-live control");
    const controlHead = git(closeFixture, ["rev-parse", "HEAD"]);
    const invalidControl = checkLivePackageScope({ root: closeFixture, base: head, head: controlHead, branch: "hotfix/post-live-control" });
    if (!invalidControl.includes("POST_LIVE_CONTROL_MUTATION:AGENTS.md")) {
      throw new Error(`post-live control mutation not rejected: ${invalidControl.join(" | ")}`);
    }
  } finally {
    rmSync(closeFixture, { recursive: true, force: true });
  }
  return true;
}

function parseArgs(argv) {
  const values = { root: process.cwd(), base: null, head: "HEAD", branch: null, selftest: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") values.root = path.resolve(argv[++index]);
    else if (value === "--base") values.base = argv[++index];
    else if (value === "--head") values.head = argv[++index];
    else if (value === "--branch") values.branch = argv[++index];
    else if (value === "--selftest") values.selftest = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selftest) {
    runSelftest(args.root);
    console.log("KREILE_LIVE_PACKAGE_SCOPE_SELFTEST=PASS");
    return;
  }
  args.base ??= "origin/main";
  args.branch ??= git(args.root, ["branch", "--show-current"]);
  const errors = checkLivePackageScope(args);
  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }
  console.log(`KREILE_LIVE_PACKAGE_SCOPE=PASS branch=${args.branch}`);
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) await main();
