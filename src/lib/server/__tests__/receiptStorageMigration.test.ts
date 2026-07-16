import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("prepared receipt storage migration", () => {
  it("keeps the canonical OCR bucket private and format/size bounded", () => {
    const sql = readFileSync(join(
      process.cwd(),
      "supabase/migrations/20260715000200_buchhaltung_receipt_storage_prepared_unapplied.sql",
    ), "utf8");

    expect(sql).toContain("'buchhaltung-belege'");
    expect(sql).toMatch(/public\s*=\s*false/i);
    expect(sql).toContain("10485760");
    expect(sql).toContain("application/pdf");
    expect(sql).not.toMatch(/CREATE\s+POLICY/i);
  });
});
