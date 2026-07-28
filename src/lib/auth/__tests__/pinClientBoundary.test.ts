import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("PIN hash client boundary check", () => {
  it("rejects real client props and server payloads without flagging type declarations or test fixtures", () => {
    const script = path.resolve(process.cwd(), "scripts/quality/check-forbidden-patterns.mjs");
    const output = execFileSync(process.execPath, [script, "--self-test"], { encoding: "utf8" });

    expect(output).toMatch(/PIN client-boundary self-test passed/);
  });
});
