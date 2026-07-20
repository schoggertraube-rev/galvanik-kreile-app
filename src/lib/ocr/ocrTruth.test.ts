import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("OCR fail-closed truth", () => {
  it("never turns provider or JSON failure into a successful OCR value", () => {
    const extractor = source("src/lib/ocr/geminiOcr.ts");
    const action = source("src/app/actions/ocr.actions.ts");
    expect(extractor).toContain('throw new Error("OCR_EXTRACTION_FAILED"');
    expect(extractor).not.toContain('return { rawText: "OCR fehlgeschlagen" }');
    expect(action).not.toContain("simulateScan");
    expect(action).not.toContain('rawText: "OCR fehlgeschlagen"');
  });

  it("marks upload processed only after confirmed extraction and recognizes secured fallback", () => {
    const route = source("src/app/api/erfassung/scan-upload/route.ts");
    const upload = source("src/components/erfassung/ScanFlow/ScanUpload.tsx");
    expect(route.indexOf('status: "processed"')).toBeLessThan(route.indexOf("await extractDocumentData"));
    expect(route).toContain('status: "secured"');
    expect(upload).toContain('["processed", "secured", "error"]');
    expect(upload).toContain('source: fallbackState.type === "storage_failed" ? "manual" : "scan"');
  });

  it("routes every visible scan entry through original-before-OCR storage", () => {
    const page = source("src/app/scan/page.tsx");
    const upload = source("src/components/erfassung/ScanFlow/ScanUpload.tsx");
    const route = source("src/app/api/erfassung/scan-upload/route.ts");

    expect(page).toContain('import { ScanUpload }');
    expect(page).toContain("<ScanUpload />");
    expect(page).not.toContain("CameraCapture");
    expect(page).not.toContain("createOrderFromScan");
    expect(page).not.toContain("processImage");
    expect(upload).toContain('fetch("/api/erfassung/scan-upload"');
    expect(route.indexOf('.from("scans")')).toBeLessThan(route.indexOf("await extractDocumentData"));
    expect(route).toContain('fileUrl: storagePath');
  });

  it("requires explicit position data and disables unimplemented scan actions", () => {
    const items = source("src/components/intake/SuggestedItemsPanel.tsx");
    const result = source("src/components/erfassung/ScanFlow/ScanResult.tsx");
    expect(items).not.toContain('name: ocrData.itemName || "Bauteil"');
    expect(items).not.toContain("quantity: 1");
    expect(items).toContain("disabled={!canConfirm}");
    expect(result).not.toContain("alert(");
    expect(result).not.toContain("(WIP)");
    expect(result).toContain("Ein idempotenter Dokument-Zuordnungsbeleg ist noch nicht angebunden");
    expect(result).toContain("Die Buchhaltungsübergabe benötigt einen bestätigten Belegvertrag");
  });
});
