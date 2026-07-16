import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeOcrConfidencePercent } from "@/lib/buchhaltung/types";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("OCR drafts cannot become accounting truth automatically", () => {
  it("normalizes historical fractional confidence without changing canonical percentages", () => {
    expect(normalizeOcrConfidencePercent(0.88)).toBe(88);
    expect(normalizeOcrConfidencePercent(88)).toBe(88);
    expect(() => normalizeOcrConfidencePercent(101)).toThrow("FINANCE_DATA_INVALID:ocr_confidence");
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
    expect(actions).toContain("eq(beleg.status, 'pruefen')");
    expect(analysis.match(/inArray\(beleg\.status, CONFIRMED_RECEIPT_STATUSES\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(analysis).toContain("eq(beleg.status, 'pruefen')");
  });

  it("prepares but does not apply the percentage backfill and range constraint", () => {
    const migration = source("supabase/migrations/20260715001400_ocr_confidence_percent_prepared_unapplied.sql");
    expect(migration).toContain("PREPARED, NOT APPLIED");
    expect(migration).toContain("ocr_confidence * 100");
    expect(migration).toContain("beleg_ocr_confidence_percent");
    expect(migration).toContain("ocr_confidence <= 100");
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
