import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const plan = JSON.parse(readFileSync(path.join(root, "docs/delivery/KREILE_LIVE_PLAN_V1.json"), "utf8"));
const missionText = readFileSync(path.join(root, "missions/F1_ORDER_TO_CASH_PILOT_001.yml"), "utf8");
const mission = Object.fromEntries(
  missionText
    .split(/\r?\n/)
    .map((line) => line.match(/^([a-z][a-z0-9_]*):\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const item = plan.packages.find((entry) => entry.id === mission.active_package);

if (!item) throw new Error(`Active package ${mission.active_package} is not in the live plan.`);

const projection = {
  plan: plan.planId,
  mission: mission.mission_id,
  package: {
    id: item.id,
    kind: item.kind,
    position: item.position,
    title: item.title,
    userValue: item.userValue,
    routes: item.routes,
    acceptance: item.acceptance,
    scopeOut: item.scopeOut,
    predecessor: item.predecessor,
    successor: item.successor,
  },
  plControl: {
    phase: mission.phase,
    branch: mission.branch,
    baseRef: mission.base_ref,
    focusedSpec: item.focusedSpec,
    preflightReceipt: `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`,
    reviewReceipt: `docs/evidence/live-line/${item.id.toLowerCase()}/REVIEW.md`,
    reviewOutput: `docs/evidence/live-line/${item.id.toLowerCase()}/REVIEW_OUTPUT.md`,
    ownerViewReceipt: item.ownerView ? `docs/evidence/live-line/${item.id.toLowerCase()}/OWNER_VIEW.md` : null,
    nextGate: mission.next_gate_after_active_package,
    blockedResumePhase: mission.resume_phase,
  },
  writerContract: {
    exactlyOneWriter: item.kind === "BUILD",
    writerCount: item.kind === "BUILD" ? 1 : 0,
    editablePaths: item.editablePaths,
    forbidden: [
      item.focusedSpec,
      ".claude/**",
      ".github/**",
      "AGENTS.md",
      "package.json",
      "missions/**",
      "docs/delivery/**",
      "docs/evidence/live-line/**",
      "docs/project/CURRENT_STATE.md",
      "docs/project/history/**",
      "docs/project/linie/ui/designsystem_v1_1/**",
      "quality/**",
      "scripts/quality/**",
      "scripts/advance-live-package.mjs",
      "scripts/close-live-line.mjs",
      "scripts/show-active-live-package.mjs",
    ],
  },
  reviewContract: {
    exactCandidateSha: true,
    independentReviewer: true,
    maxCorrectionRounds: plan.operatingRules.maxCorrectionRounds,
    requiredChecks: plan.operatingRules.checks,
    ownerVisualRequired: item.ownerView,
    visualViewports: item.ownerView ? plan.operatingRules.visualViewports : [],
  },
};

process.stdout.write(`${JSON.stringify(projection, null, 2)}\n`);
