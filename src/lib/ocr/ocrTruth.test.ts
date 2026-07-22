import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("OCR fail-closed truth", () => {
  it("never turns provider or JSON failure into a successful OCR value", () => {
    const extractor = source("src/lib/ocr/geminiOcr.ts");
    const legacyAction = source("src/app/actions/ocr.actions.ts");
    expect(extractor).toContain('throw new Error("OCR_EXTRACTION_FAILED"');
    expect(extractor).not.toContain('return { rawText: "OCR fehlgeschlagen" }');
    expect(legacyAction).toContain('throw new Error("ORIGINAL_RECEIPT_REQUIRED")');
    expect(legacyAction).not.toContain("extractDocumentData");
  });

  it("separates original receipt from bounded OCR claim and settlement", () => {
    const uploadRoute = source("src/app/api/erfassung/scan-upload/route.ts");
    const processRoute = source("src/app/api/erfassung/scan-process/[id]/route.ts");

    expect(uploadRoute).not.toContain("extractDocumentData");
    expect(uploadRoute).toContain('recordKind: "capture_scan"');
    expect(uploadRoute.indexOf("confirmStoredOriginal")).toBeLessThan(uploadRoute.indexOf('status: "secured"'));
    expect(uploadRoute).toContain('status: "storage_unconfirmed"');
    expect(uploadRoute).toContain('status: "integrity_error"');

    expect(processRoute).toContain("pg_advisory_xact_lock");
    expect(processRoute).toContain("isConfirmedCaptureReceipt");
    expect(processRoute.indexOf("await reserveDirectAiUsage")).toBeLessThan(processRoute.indexOf('.from("scans").download'));
    expect(processRoute).toContain("minimumInputUnits: Math.ceil(claim.bytes / 256)");
    expect(processRoute).toContain("`scan-ocr:${claim.id}:${claim.attempt}`");
    expect(processRoute).toContain("userId: claim.uploadedBy");
    expect(processRoute.indexOf("createHash(\"sha256\")")).toBeLessThan(processRoute.indexOf("await extractDocumentData"));
    expect(processRoute.indexOf("await extractDocumentData")).toBeLessThan(processRoute.lastIndexOf('status: "processed"'));
    expect(processRoute).toContain("extraction.actualUnits");
    expect(processRoute).toContain("extraction.providerStatus");
    expect(processRoute).toContain('admission.reason === "in_progress"');
    expect(processRoute).toContain('eq(scanUploads.status, "processing")');
  });

  it("routes every visible scan entry through original-before-OCR storage", () => {
    const page = source("src/app/scan/page.tsx");
    const upload = source("src/components/erfassung/ScanFlow/ScanUpload.tsx");
    const result = source("src/components/erfassung/ScanFlow/ScanResult.tsx");

    expect(page).toContain('import { ScanUpload }');
    expect(page).toContain("<ScanUpload />");
    expect(page).not.toContain("CameraCapture");
    expect(upload).toContain('fetch("/api/erfassung/scan-upload"');
    expect(upload).toContain("originalIsConfirmed");
    expect(upload).toContain('type: "status_unknown"');
    expect(result).toContain("hasConfirmedExtraction");
    expect(result).toContain("contentSha256");
    expect(result).toContain("fileSizeBytes");
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
