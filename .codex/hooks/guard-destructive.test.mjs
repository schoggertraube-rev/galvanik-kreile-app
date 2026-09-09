import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const guardPath = fileURLToPath(new URL("./guard-destructive.mjs", import.meta.url));

function runGuard(command) {
  return spawnSync(process.execPath, [guardPath], {
    encoding: "utf8",
    input: JSON.stringify({ tool_input: { command } })
  });
}

const denyCommands = [
  "rm -rf C:/tmp/x",
  "rm -fr C:/tmp/x",
  "rm --recursive --force C:/tmp/x",
  "rm --force --recursive C:/tmp/x",
  "Remove-Item -Recurse -Force C:/tmp/x",
  "Remove-Item -Force -Recurse C:/tmp/x"
];

const safeCommands = [
  "git status --short",
  "Remove-Item C:/tmp/one-explicit-file.txt"
];

test("blocks the complete recursive-force command matrix", () => {
  for (const command of denyCommands) {
    const result = runGuard(command);
    assert.equal(result.status, 0, command);

    const output = JSON.parse(result.stdout);
    assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse", command);
    assert.equal(output.hookSpecificOutput.permissionDecision, "deny", command);
    assert.equal(typeof output.hookSpecificOutput.permissionDecisionReason, "string", command);
    assert.ok(output.hookSpecificOutput.permissionDecisionReason.length > 0, command);
  }
});

test("allows the complete safe command matrix", () => {
  for (const command of safeCommands) {
    const result = runGuard(command);
    assert.equal(result.status, 0, command);
    assert.equal(result.stdout, "", command);
  }
});
