import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260715001670_finance_truth_contracts_prepared_unapplied.sql"),
  "utf8",
);

describe("finance truth migration", () => {
  it("fails before inventing or repairing contradictory finalized receipt data", () => {
    expect(migration).toContain("FINANCE_TRUTH_RECONCILIATION_REQUIRED");
    expect(migration).toContain("status = 'festgeschrieben'");
    expect(migration).toContain("beleg_finalized_truth_chk");
    expect(migration).toContain("ust_satz IN (0, 7, 19)");
    expect(migration).toContain("abs(brutto - netto - ust_betrag) <= 0.01");
    expect(migration).not.toMatch(/\bUPDATE\s+public\.beleg\b/i);
  });

  it("enforces one positive, reviewed fuel detail per receipt", () => {
    expect(migration).toContain("duplicate fuel detail");
    expect(migration).toContain("kraftstoff_detail_beleg_id_uidx");
    expect(migration).toContain("kraftstoff_detail_liter_positive_chk");
    expect(migration).toContain("kraftstoff_detail_preis_positive_chk");
    expect(migration).toContain("ALTER COLUMN liter SET NOT NULL");
  });
});
