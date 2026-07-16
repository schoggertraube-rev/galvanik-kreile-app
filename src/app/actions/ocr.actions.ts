"use server";

import { extractDocumentData, OcrResult } from "@/lib/ocr/geminiOcr";

export async function processImage(base64Image: string): Promise<OcrResult> {
  if (typeof base64Image !== "string" || base64Image.length < 32 || base64Image.length > 28 * 1024 * 1024) {
    throw new Error("INVALID_OCR_IMAGE");
  }
  return extractDocumentData(base64Image);
}

// Deprecated simulation path is deliberately fail-closed.
export async function processImageWithAI(_base64Image: string): Promise<never> {
  throw new Error("DEPRECATED_OCR_PATH");
}
