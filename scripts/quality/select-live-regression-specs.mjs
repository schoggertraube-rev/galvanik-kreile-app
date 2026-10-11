import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const PLAN_PATH = "docs/delivery/KREILE_LIVE_PLAN_V1.json";
const LIVE_SPEC_PATTERN = /^kr-l\d{2}-.+\.spec\.ts$/;
const DISABLED_TEST_PATTERN = /\b(?:test(?:\.describe)?|it|describe)\.(?:skip|fixme)\s*\(/;

const posix = (value) => value.replaceAll("\\", "/");

export function inspectLiveRegressionSpecs(root = process.cwd()) {
  const plan = JSON.parse(readFileSync(path.join(root, PLAN_PATH), "utf8"));
  const planned = new Map(plan.packages.map((item) => [posix(item.focusedSpec), item]));
  const e2eRoot = path.join(root, "e2e");
  const existing = existsSync(e2eRoot)
    ? readdirSync(e2eRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && LIVE_SPEC_PATTERN.test(entry.name))
      .map((entry) => `e2e/${entry.name}`)
      .sort()
    : [];
  const errors = [];

  for (const rel of existing) {
    const item = planned.get(rel);
    if (!item) {
      errors.push(`LIVE_REGRESSION_UNPLANNED_SPEC:${rel}`);
      continue;
    }
    const text = readFileSync(path.join(root, rel), "utf8");
    if (DISABLED_TEST_PATTERN.test(text)) errors.push(`LIVE_REGRESSION_DISABLED_TEST:${rel}`);
  }

  const localSpecs = existing.filter((rel) => {
    const item = planned.get(rel);
    return item?.kind === "BUILD" && !("externalPrerequisite" in item);
  });
  return { errors, localSpecs };
}

export function runSelftest() {
  const banned = [
    "test.skip('x', () => {})",
    "test.fixme('x', () => {})",
    "describe.skip('x', () => {})",
    "test.describe.fixme('x', () => {})",
    "it.fixme('x', () => {})",
  ];
  for (const sample of banned) {
    if (!DISABLED_TEST_PATTERN.test(sample)) throw new Error(`disabled-test pattern missed: ${sample}`);
  }
  if (DISABLED_TEST_PATTERN.test("test('x', () => {})")) throw new Error("enabled test rejected");
  return true;
}

function parseArgs(argv) {
  const args = { root: process.cwd(), mode: "check" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") args.root = path.resolve(argv[++index]);
    else if (value === "--list") args.mode = "list";
    else if (value === "--check") args.mode = "check";
    else if (value === "--selftest") args.mode = "selftest";
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "selftest") {
    runSelftest();
    console.log("KREILE_LIVE_REGRESSION_SELFTEST=PASS");
    return;
  }
  const result = inspectLiveRegressionSpecs(args.root);
  if (result.errors.length > 0) {
    result.errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }
  if (args.mode === "list") {
    result.localSpecs.forEach((rel) => console.log(rel));
    return;
  }
  console.log(`KREILE_LIVE_REGRESSION_CONTRACT=PASS local_specs=${result.localSpecs.length}`);
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) await main();
