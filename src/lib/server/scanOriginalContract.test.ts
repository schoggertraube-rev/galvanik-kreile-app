import { describe, expect, it } from "vitest";
import {
  hasDeclaredScanSignature,
  isConfirmedCaptureReceipt,
  scanStoragePath,
} from "@/lib/server/scanOriginalContract";

const id = "019f9d82-e6fd-7ef1-9c7e-376d36ecfd45";
const tenantId = "galvanik-kreile";

describe("scan original receipt contract", () => {
  it("accepts only content whose magic signature matches the declared MIME type", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const pdf = Buffer.from("%PDF-1.7\n", "ascii");

    expect(hasDeclaredScanSignature(jpeg, "image/jpeg")).toBe(true);
    expect(hasDeclaredScanSignature(png, "image/png")).toBe(true);
    expect(hasDeclaredScanSignature(pdf, "application/pdf")).toBe(true);
    expect(hasDeclaredScanSignature(pdf, "image/jpeg")).toBe(false);
    expect(hasDeclaredScanSignature(Buffer.from("<script>"), "application/pdf")).toBe(false);
  });

  it("derives a tenant/request-bound private object path", () => {
    expect(scanStoragePath(tenantId, id, "image/jpeg")).toBe(`${tenantId}/${id}/original.jpg`);
    expect(scanStoragePath(tenantId, id, "image/heic")).toBeNull();
  });

  it("accepts a complete capture receipt and rejects legacy, path, hash and size variants", () => {
    const receipt = {
      id,
      tenantId,
      recordKind: "capture_scan",
      fileUrl: `${tenantId}/${id}/original.pdf`,
      fileType: "application/pdf",
      contentSha256: "a".repeat(64),
      fileSizeBytes: 1024,
      uploadedBy: "00000000-0000-4000-8000-000000000001",
    };

    expect(isConfirmedCaptureReceipt(receipt, tenantId)).toBe(true);
    expect(isConfirmedCaptureReceipt({ ...receipt, recordKind: "legacy" }, tenantId)).toBe(false);
    expect(isConfirmedCaptureReceipt({ ...receipt, fileUrl: `other/${id}/original.pdf` }, tenantId)).toBe(false);
    expect(isConfirmedCaptureReceipt({ ...receipt, contentSha256: "not-a-hash" }, tenantId)).toBe(false);
    expect(isConfirmedCaptureReceipt({ ...receipt, fileSizeBytes: 14 * 1024 * 1024 + 1 }, tenantId)).toBe(false);
  });
});
