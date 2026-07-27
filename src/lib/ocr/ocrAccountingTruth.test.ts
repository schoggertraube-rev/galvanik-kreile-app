import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readStoredOcrConfidencePercent } from "@/lib/buchhaltung/types";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("OCR drafts cannot become accounting truth automatically", () => {
  it("reads confidence only with explicit scale provenance", () => {
    expect(readStoredOcrConfidencePercent(0.88, "fraction")).toBe(88);
    expect(readStoredOcrConfidencePercent(0.5, "percent")).toBe(0.5);
    expect(readStoredOcrConfidencePercent(88, null)).toBeUndefined();
    expect(() => readStoredOcrConfidencePercent(1.1, "fraction"))
      .toThrow("FINANCE_DATA_INVALID:ocr_confidence");
  });

  it("keeps every OCR write in review and never creates master data or distributes it", () => {
    const route = source("src/app/api/ocr-process/route.ts");
    expect(route).toContain('status: "pruefen"');
    expect(route).toContain("requiresReview: true");
    expect(route).toContain("vorsteuerAbzug: false");
    expect(route).toContain('absetzbarProzent: "0"');
    expect(route).not.toContain("insert(lieferant)");
    expect(route).not.toContain("insert(kategorie)");
    expect(route).not.toContain("verteilBeleg");
  });

  it("excludes review drafts from finance totals while counting them as review work", () => {
    const actions = source("src/app/buchhaltung/actions.ts");
    const analysis = source("src/app/buchhaltung/analysis.actions.ts");
    expect(actions).toContain("inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES)");
    expect(actions).toContain("inArray(beleg.status, ['pruefen', 'erfasst'])");
    expect(analysis.match(/inArray\(beleg\.status, CONFIRMED_RECEIPT_STATUSES\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(analysis).toContain("inArray(beleg.status, ['pruefen', 'erfasst'])");
  });

  it("separates provenance expansion from the later percentage contract", () => {
    const migration = source("supabase/migrations/20260713000600_ocr_confidence_scale_expand.sql");
    const contract = source("supabase/migrations/20260720000400_ocr_confidence_percent_contract_prepared_unapplied.sql");
    const validation = source("scripts/validation/ocr_confidence_scale.local.sql");
    expect(migration).toContain("REMOTE WAVE 1: explicitly approved 2026-07-26");
    expect(migration).not.toContain("ocr_confidence * 100");
    expect(migration).not.toContain("ADD COLUMN IF NOT EXISTS ocr_confidence_scale");
    expect(migration).not.toContain("DROP CONSTRAINT IF EXISTS");
    expect(migration).toContain("ocr_confidence_scale = 'fraction'");
    expect(migration).toContain("ocr_confidence <= 100");
    expect(migration).toContain("status IN ('festgeschrieben', 'storniert')");
    expect(migration).toContain("GET DIAGNOSTICS updated_count = ROW_COUNT");
    expect(migration).toContain("after_digest IS DISTINCT FROM before_digest");
    expect(migration).toContain("e1ce1f9549c3130798a292eca4276606");
    expect(migration).toContain("927d5dd065d18f1570171726a1447612");
    expect(validation).toContain("897411d5f1d8f1610e3c00489fc60f30");
    expect(validation).toContain("SET TRANSACTION READ ONLY");
    expect(contract).toContain("ocr_confidence * 100");
    expect(contract).toContain("WHERE ocr_confidence_scale = 'fraction'");
    expect(contract).toContain("non-null confidence lacks explicit scale");
  });

  it("does not derive savings from OCR confidence alone", () => {
    const analysis = source("src/app/buchhaltung/analysis.actions.ts");
    const gate = analysis.indexOf("FINANCE_SAVINGS_NOT_EVIDENCED");
    const retiredHeuristic = analysis.indexOf("normalizeOcrConfidencePercent");
    expect(gate).toBeGreaterThan(0);
    expect(retiredHeuristic === -1 || gate < retiredHeuristic).toBe(true);
  });

  it("has no dummy receipt fallback or simulated downstream distribution", () => {
    const manual = source("src/lib/ocr/ManualProvider.ts");
    const distribution = source("src/lib/ocr/Verteilung.ts");
    expect(manual).not.toContain("Aral");
    expect(manual).not.toContain("112.45");
    expect(manual).toContain("OCR_PROVIDER_NOT_CONFIGURED");
    expect(distribution).not.toContain("verteilt_an");
    expect(distribution).toContain("OCR_DISTRIBUTION_REQUIRES_CONFIRMED_RECEIPT");
  });
});
