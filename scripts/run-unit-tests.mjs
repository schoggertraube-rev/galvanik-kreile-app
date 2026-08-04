import { spawnSync } from "node:child_process";
import path from "node:path";

const result = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs"),
    "run",
    "--exclude",
    "**/*.integration.test.ts",
    ...process.argv.slice(2),
  ],
  {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "test" },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;

if (result.signal) {
  process.kill(process.pid, result.signal);
} else {
  process.exitCode = result.status ?? 1;
}
