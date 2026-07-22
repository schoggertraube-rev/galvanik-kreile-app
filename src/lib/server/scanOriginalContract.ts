// Direct-to-storage avoids Vercel's 4.5 MB Function body limit. Fourteen MiB
// also stays below Gemini's 20 MB inline-request ceiling after base64 expansion.
export const MAX_SCAN_FILE_BYTES = 14 * 1024 * 1024;
export const MAX_SCAN_PROCESSING_ATTEMPTS = 3;

export const SCAN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SCAN_SHA256 = /^[0-9a-f]{64}$/;

export const SCAN_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
} as const;

export type ScanMimeType = keyof typeof SCAN_MIME_EXTENSIONS;

export function isSupportedScanMimeType(value: string): value is ScanMimeType {
  return Object.hasOwn(SCAN_MIME_EXTENSIONS, value);
}

export function hasDeclaredScanSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return mimeType === "application/pdf"
    && buffer.length >= 5
    && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

export function scanStoragePath(tenantId: string, id: string, mimeType: string): string | null {
  if (!isSupportedScanMimeType(mimeType)) return null;
  return `${tenantId}/${id}/original.${SCAN_MIME_EXTENSIONS[mimeType]}`;
}

export type CaptureReceiptLike = {
  id: string;
  tenantId: string;
  recordKind: string;
  fileUrl: string;
  fileType: string | null;
  contentSha256: string | null;
  fileSizeBytes: number | null;
  uploadedBy: string | null;
};

export function isConfirmedCaptureReceipt(
  receipt: CaptureReceiptLike,
  tenantId: string,
): receipt is CaptureReceiptLike & {
  fileType: ScanMimeType;
  contentSha256: string;
  fileSizeBytes: number;
  uploadedBy: string;
} {
  const expectedPath = receipt.fileType
    ? scanStoragePath(tenantId, receipt.id, receipt.fileType)
    : null;
  return receipt.recordKind === "capture_scan"
    && receipt.tenantId === tenantId
    && SCAN_UUID.test(receipt.id)
    && Boolean(receipt.uploadedBy)
    && Boolean(receipt.fileType && isSupportedScanMimeType(receipt.fileType))
    && Boolean(receipt.contentSha256 && SCAN_SHA256.test(receipt.contentSha256))
    && Number.isSafeInteger(receipt.fileSizeBytes)
    && (receipt.fileSizeBytes ?? 0) >= 1
    && (receipt.fileSizeBytes ?? 0) <= MAX_SCAN_FILE_BYTES
    && expectedPath !== null
    && receipt.fileUrl === expectedPath;
}
