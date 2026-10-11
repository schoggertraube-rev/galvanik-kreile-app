import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const PLAN_PATH = "docs/delivery/KREILE_LIVE_PLAN_V1.json";
const MISSION_PATH = "missions/F1_ORDER_TO_CASH_PILOT_001.yml";
const CLOSE_BRANCH = "codex/kreile-live-close";

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

export function closedMission({ plan, mission, branch, deploymentSha, now = new Date().toISOString() }) {
  const final = plan.packages.at(-1);
  if (!final || final.id !== "KR-L20" || final.kind !== "GATE" || final.successor !== null) {
    throw new Error("Plan final package is not the writerless KR-L20 gate");
  }
  if (branch !== CLOSE_BRANCH) throw new Error(`Expected ${CLOSE_BRANCH}, got ${branch}`);
  if (mission.active_package !== final.id || mission.phase !== "READY_TO_MERGE") {
    throw new Error(`KR-L20 is not merge-ready: ${mission.active_package}/${mission.phase}`);
  }
  if (!/^[0-9a-f]{40}$/i.test(deploymentSha)) throw new Error("Deployment SHA is not exact");
  return {
    ...mission,
    phase: "DONE",
    branch: CLOSE_BRANCH,
    writer_count: "0",
    writer_scope_source: "NO_WRITER_GATE",
    last_completed_package: final.id,
    next_package: "none",
    candidate_sha: deploymentSha,
    block_reason: "none",
    resume_phase: "none",
    next_gate_after_active_package: "LIVE_COMPLETE",
    updated_at: now,
  };
}

export function runSelftest(root = process.cwd()) {
  const plan = JSON.parse(readFileSync(path.join(root, PLAN_PATH), "utf8"));
  const final = plan.packages.at(-1);
  const mission = {
    active_package: final.id,
    phase: "READY_TO_MERGE",
    branch: `codex/kreile-${final.id.toLowerCase()}`,
    writer_count: "0",
    writer_scope_source: "NO_WRITER_GATE",
    last_completed_package: final.predecessor,
    next_package: "none",
    candidate_sha: "a".repeat(40),
    block_reason: "none",
    resume_phase: "none",
    next_gate_after_active_package: "OWNER_MERGE_AUTHORITY",
  };
  const result = closedMission({
    plan,
    mission,
    branch: CLOSE_BRANCH,
    deploymentSha: "b".repeat(40),
    now: "2026-10-11T00:00:00.000Z",
  });
  if (result.phase !== "DONE" || result.candidate_sha !== "b".repeat(40)
      || result.next_gate_after_active_package !== "LIVE_COMPLETE") throw new Error("Close selftest failed");
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
    console.log("KREILE_LIVE_CLOSE_SELFTEST=PASS");
    return;
  }
  if (!args.apply) throw new Error("Refusing to close the live line without --apply");
  if (git(args.root, ["status", "--porcelain"])) throw new Error("Working tree must be clean before live closure");
  const branch = git(args.root, ["branch", "--show-current"]);
  const head = git(args.root, ["rev-parse", "HEAD"]);
  const originMain = git(args.root, ["rev-parse", "origin/main"]);
  if (head !== originMain) throw new Error(`Close branch must start exactly at origin/main: ${head} != ${originMain}`);
  const plan = JSON.parse(readFileSync(path.join(args.root, PLAN_PATH), "utf8"));
  const parsed = parseMission(readFileSync(path.join(args.root, MISSION_PATH), "utf8"));
  execFileSync("git", ["-C", args.root, "merge-base", "--is-ancestor", parsed.values.candidate_sha, "origin/main"], {
    stdio: "ignore",
  });
  const next = closedMission({ plan, mission: parsed.values, branch, deploymentSha: originMain });
  writeFileSync(path.join(args.root, MISSION_PATH), renderMission(parsed.order, next), "utf8");
  console.log(`KREILE_LIVE_CLOSE=PASS deployment=${originMain}`);
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) await main();
