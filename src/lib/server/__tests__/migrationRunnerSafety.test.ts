import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("legacy Drizzle migration runner safety", () => {
  const runner = readFileSync(resolve(process.cwd(), "migrate.mjs"), "utf8");

  it("fails closed without a valid database URL or when migration execution fails", () => {
    expect(runner.indexOf("DATABASE_URL is required")).toBeLessThan(
      runner.indexOf("new URL(connectionString)"),
    );
    expect(runner).toContain('["postgres:", "postgresql:"]');
    expect(runner).toContain("process.exitCode = 1");
    expect(runner).toContain("await sql.end({ timeout: 5 })");
    expect(runner).not.toContain("process.exit(0)");
    expect(runner).not.toContain("connectionString.replace");
  });
});
