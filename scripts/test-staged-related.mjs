import { execFileSync, spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** PL19.11.17:13 / R27: explicit local diff tests; never a CI shortcut. */
export function selectLocalTestFiles(raw, { root = process.cwd(), ci = false, tracked = new Set() } = {}) {
  if (raw === undefined) return undefined;
  if (ci) throw new Error("KREILE_LOCAL_TEST_FILES is local-only; CI keeps its full checks.");
  let selected;
  try { selected = JSON.parse(raw); }
  catch { throw new Error("KREILE_LOCAL_TEST_FILES must be a non-empty JSON array of repository test paths."); }
  if (!Array.isArray(selected) || selected.length === 0) throw new Error("Local test selection must not be empty.");
  const rootPath = realpathSync(root);
  const result = selected.map(file => {
    if (typeof file !== "string" || !file || file.includes("\0")) throw new Error("Invalid local test path.");
    const relative = file.replaceAll("\\", "/");
    if (path.isAbsolute(relative) || /^[a-z]:/i.test(relative) || relative.startsWith("-") || path.posix.normalize(relative) !== relative || relative.startsWith("../") || !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(relative)) throw new Error("Local tests must use canonical repository test paths.");
    if (!tracked.has(relative)) throw new Error("Selected test is not in the repository index: " + relative);
    let target;
    try {
      target = realpathSync(path.resolve(rootPath, relative));
      if (!statSync(target).isFile()) throw new Error("NOT_A_FILE");
    } catch { throw new Error("Selected repository test does not exist: " + relative); }
    const inside = path.relative(rootPath, target);
    if (inside === ".." || inside.startsWith(".." + path.sep) || path.isAbsolute(inside)) throw new Error("Selected test resolves outside the repository.");
    return relative;
  });
  if (new Set(result).size !== result.length) throw new Error("Duplicate local tests are not allowed.");
  return result;
}

export function buildTestArguments(staged, selected) {
  const scope = selected === undefined
    ? ["related", "--run", ...staged, "--passWithNoTests", "--exclude", "**/*.integration.test.ts", "--exclude", "**/*.integration.test.tsx"]
    : ["run", ...selected];
  return [...scope, "--maxWorkers=1", "--no-file-parallelism", "--testTimeout=15000"];
}

function main() {
  const staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], { encoding: "utf8" })
    .split("\0").filter(file => /\.(?:[cm]?[jt]sx?)$/.test(file));
  const tracked = new Set(execFileSync("git", ["ls-files", "--cached", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean));
  const selected = selectLocalTestFiles(process.env.KREILE_LOCAL_TEST_FILES, {
    tracked, ci: process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true" || process.env.CI === "1",
  });
  if (staged.length === 0 && selected === undefined) {
    console.log("No staged files for related tests.");
    return;
  }
  if (selected !== undefined) console.log("R27 explicit local diff tests:", JSON.stringify(selected));
  const result = spawnSync(process.execPath, [
    path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs"), ...buildTestArguments(staged, selected),
  ], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "test" }, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.signal) process.kill(process.pid, result.signal);
  else process.exitCode = result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
