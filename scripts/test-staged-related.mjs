import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(file => /\.(?:[cm]?[jt]sx?)$/.test(file));
if (staged.length === 0) {
  console.log("No staged files for related tests.");
} else {
  const result = spawnSync(process.execPath, [
    path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs"),
    "related", "--run", ...staged, "--passWithNoTests",
    "--exclude", "**/*.integration.test.ts",
    "--exclude", "**/*.integration.test.tsx",
    "--maxWorkers=1", "--no-file-parallelism", "--testTimeout=15000",
  ], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "test" }, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.signal) process.kill(process.pid, result.signal);
  else process.exitCode = result.status ?? 1;
}
