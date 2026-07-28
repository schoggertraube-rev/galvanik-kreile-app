"use server";

import { extractDocumentData, OcrResult } from "@/lib/ocr/geminiOcr";
import { ocrService, OCRScan } from "@/lib/services/ocrService";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

function assertOcrContract(): void {
  if (!isFoundationAreaEnabled("OCR")) {
    foundationUnavailableAction("OCR");
  }
}

export async function processImage(base64Image: string): Promise<OcrResult> {
  assertOcrContract();
  try {
    return await extractDocumentData(base64Image);
  } catch (error) {
    console.error("❌ processImage Error:", error);
    return { rawText: "OCR fehlgeschlagen" };
  }
}

// DEPRECATED: ersetzt durch processImage
export async function processImageWithAI(base64Image: string): Promise<OCRScan> {
  assertOcrContract();
  console.warn("⚠️ processImageWithAI is deprecated, use processImage instead");
  return await ocrService.simulateScan("document");
}
