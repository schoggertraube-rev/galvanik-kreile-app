import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const PLAN_PATH = "docs/delivery/KREILE_LIVE_PLAN_V1.json";
const MISSION_PATH = "missions/F1_ORDER_TO_CASH_PILOT_001.yml";

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function parseMission(text) {
  const values = {};
  const order = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-z][a-z0-9_]*):\s*(.*?)\s*$/);
    if (!match) throw new Error(`Invalid mission line: ${line}`);
    values[match[1]] = match[2];
    order.push(match[1]);
  }
  return { values, order };
}

function renderMission(order, values) {
  return `${order.map((key) => `${key}: ${values[key]}`).join("\n")}\n`;
}

export function successorMission({ plan, mission, branch, now = new Date().toISOString() }) {
  if (mission.phase !== "READY_TO_MERGE") throw new Error(`Active package is not merge-ready: ${mission.phase}`);
  if (!/^[0-9a-f]{40}$/i.test(mission.candidate_sha ?? "")) throw new Error("Mission has no exact candidate SHA");
  const active = plan.packages.find((item) => item.id === mission.active_package);
  if (!active) throw new Error(`Unknown active package: ${mission.active_package}`);
  if (!active.successor) throw new Error(`${active.id} is the final package and cannot advance`);
  const successor = plan.packages.find((item) => item.id === active.successor);
  if (!successor || successor.predecessor !== active.id) throw new Error(`Broken successor chain after ${active.id}`);
  const expectedBranch = `codex/kreile-${successor.id.toLowerCase()}`;
  if (branch !== expectedBranch) throw new Error(`Expected fresh successor branch ${expectedBranch}, got ${branch}`);
  return {
    ...mission,
    active_package: successor.id,
    active_package_position: String(successor.position),
    next_package: successor.successor ?? "none",
    phase: "PREFLIGHT",
    branch: expectedBranch,
    focused_spec: successor.focusedSpec,
    writer_count: successor.kind === "BUILD" ? "1" : "0",
    writer_scope_source: successor.kind === "BUILD" ? "ACTIVE_PACKAGE_EDITABLE_PATHS_ONLY" : "NO_WRITER_GATE",
    attempt: "0",
    last_completed_package: active.id,
    candidate_sha: "none",
    owner_visual_required: String(successor.ownerView),
    block_reason: "none",
    resume_phase: "none",
    next_gate_after_active_package: "PL_CREATES_ASSERTIONS_RED_SPEC",
    updated_at: now,
  };
}

export function runSelftest(root = process.cwd()) {
  const plan = JSON.parse(readFileSync(path.join(root, PLAN_PATH), "utf8"));
  const first = plan.packages[0];
  const successor = plan.packages[1];
  if (!first || !successor || first.successor !== successor.id) throw new Error("Plan has no valid first successor");
  const mission = {
    schema_version: "1",
    mission_id: "KREILE-LIVE-V1",
    status: "active",
    plan_path: PLAN_PATH,
    activation_condition: plan.activationCondition,
    active_package: first.id,
    active_package_position: String(first.position),
    next_package: successor.id,
    phase: "READY_TO_MERGE",
    branch: `codex/kreile-${first.id.toLowerCase()}`,
    base_ref: "origin/main",
    focused_spec: first.focusedSpec,
    spec_owner: "PL_ONLY_WRITER_FORBIDDEN",
    writer_count: first.kind === "BUILD" ? "1" : "0",
    writer_scope_source: first.kind === "BUILD" ? "ACTIVE_PACKAGE_EDITABLE_PATHS_ONLY" : "NO_WRITER_GATE",
    reviewer: "INDEPENDENT_EXACT_SHA",
    attempt: "0",
    last_completed_package: "none",
    candidate_sha: "a".repeat(40),
    owner_visual_required: String(first.ownerView),
    block_reason: "none",
    resume_phase: "none",
    next_gate_after_active_package: "OWNER_MERGE_AUTHORITY",
    merge_rule: "OWNER_EXPLICIT_AUTHORITY_ONLY",
    production_rule: "OWNER_AUTHORIZES_EACH_MAIN_DEPLOYMENT_FINAL_LIVE_DECLARATION_ONLY_AT_KR_L20",
    updated_at: "2026-10-11T00:00:00.000Z",
  };
  const next = successorMission({
    plan,
    mission,
    branch: `codex/kreile-${successor.id.toLowerCase()}`,
    now: "2026-10-11T00:00:00.000Z",
  });
  if (next.active_package !== successor.id || next.last_completed_package !== first.id || next.phase !== "PREFLIGHT") {
    throw new Error("Successor selftest failed");
  }
  return true;
}

function parseArgs(argv) {
  const args = { root: process.cwd(), apply: false, selftest: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") args.root = path.resolve(argv[++index]);
    else if (value === "--apply") args.apply = true;
    else if (value === "--selftest") args.selftest = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selftest) {
    runSelftest(args.root);
    console.log("KREILE_LIVE_ADVANCE_SELFTEST=PASS");
    return;
  }
  if (!args.apply) throw new Error("Refusing to change mission without --apply");
  if (git(args.root, ["status", "--porcelain"])) throw new Error("Working tree must be clean before successor activation");
  const branch = git(args.root, ["branch", "--show-current"]);
  const head = git(args.root, ["rev-parse", "HEAD"]);
  const originMain = git(args.root, ["rev-parse", "origin/main"]);
  if (head !== originMain) throw new Error(`Successor branch must start exactly at origin/main: ${head} != ${originMain}`);
  const plan = JSON.parse(readFileSync(path.join(args.root, PLAN_PATH), "utf8"));
  const parsed = parseMission(readFileSync(path.join(args.root, MISSION_PATH), "utf8"));
  execFileSync("git", ["-C", args.root, "merge-base", "--is-ancestor", parsed.values.candidate_sha, "origin/main"], {
    stdio: "ignore",
  });
  const next = successorMission({ plan, mission: parsed.values, branch });
  writeFileSync(path.join(args.root, MISSION_PATH), renderMission(parsed.order, next), "utf8");
  console.log(`KREILE_LIVE_ADVANCE=PASS active=${next.active_package} branch=${branch}`);
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) await main();
