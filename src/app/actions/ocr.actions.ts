"use server";

import type { OcrResult } from "@/lib/ocr/geminiOcr";
import type { OCRScan } from "@/lib/services/ocrService";

const denial = "NOT_AVAILABLE: Sicherer W3-KI-/Provider-Vertrag fehlt.";

export async function processImage(base64Image: string): Promise<OcrResult> {
  void base64Image;
  throw new Error(denial);
}

export async function processImageWithAI(base64Image: string): Promise<OCRScan> {
  void base64Image;
  throw new Error(denial);
}
