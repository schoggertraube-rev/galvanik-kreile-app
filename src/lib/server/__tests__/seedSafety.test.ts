import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initializeDemoIfNeeded } from "@/app/actions/demoSetup";
import { seedDatabase } from "@/db/seed";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function activeSource(path: string): string {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*--.*$/gm, "");
}

describe("fresh-environment seed safety", () => {
  it("retires the mock database seed before any database access", async () => {
    await expect(seedDatabase()).rejects.toThrow("RETIRED_MOCK_SEED");
    const active = activeSource("src/db/seed.ts");
    expect(active).not.toContain('from "./index"');
    expect(active).not.toContain("db.delete");
    expect(active).not.toContain("INITIAL_CUSTOMERS");
  });

  it("never auto-initializes demo data from a server action", async () => {
    await expect(initializeDemoIfNeeded()).resolves.toEqual({
      initialized: false,
      reason: "retired_mock_seed",
    });
    const active = activeSource("src/app/actions/demoSetup.ts");
    expect(active).not.toContain("@/db");
    expect(active).not.toContain("seedDatabase");
  });

  it("exposes no destructive or fabricating package command", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts).not.toHaveProperty("demo:seed");
    expect(packageJson.scripts).not.toHaveProperty("demo:cleanup");
    expect(packageJson.scripts).not.toHaveProperty("demo:reset");
    expect(packageJson.scripts).not.toHaveProperty("db:seed");
    expect(packageJson.scripts).not.toHaveProperty("db:push");
  });

  it("keeps legacy direct-database seed entry points inert", () => {
    for (const path of [
      "src/db/seed_analyse.ts",
      "seed_channels.js",
      "seed_segments.js",
    ]) {
      const active = activeSource(path);
      expect(active).toContain("RETIRED_");
      expect(active).not.toContain("DATABASE_URL");
      expect(active).not.toContain("postgres(");
      expect(active).not.toMatch(/\b(?:insert|delete)\b/i);
    }
  });

  it("leaves fresh Supabase resets and historical cleanup/period seeds data-free", () => {
    for (const path of [
      "supabase/seed.sql",
      "supabase/migrations/20260625000000_cleanup_demo_data.sql",
      "supabase/migrations/20260609000008_seed_periode_aktuelle.sql",
    ]) {
      const active = activeSource(path);
      expect(active).not.toMatch(/\bdelete\s+from\b/i);
      expect(active).not.toMatch(/\binsert\s+into\b/i);
    }
  });
});
