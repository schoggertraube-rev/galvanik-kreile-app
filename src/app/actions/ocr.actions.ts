"use server";

import { extractDocumentData, OcrResult } from "@/lib/ocr/geminiOcr";
import { ocrService, OCRScan } from "@/lib/services/ocrService";

export async function processImage(base64Image: string): Promise<OcrResult> {
  try {
    return await extractDocumentData(base64Image);
  } catch (error) {
    console.error("❌ processImage Error:", error);
    return { rawText: "OCR fehlgeschlagen" };
  }
}

// DEPRECATED: ersetzt durch processImage
export async function processImageWithAI(base64Image: string): Promise<OCRScan> {
  console.warn("⚠️ processImageWithAI is deprecated, use processImage instead");
  return await ocrService.simulateScan("document");
}
