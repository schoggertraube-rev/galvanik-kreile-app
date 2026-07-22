"use server";

// Compatibility exports remain fail-closed so a dormant client cannot bypass
// the canonical original-receipt -> bounded OCR claim workflow.
export async function processImage(_base64Image: string): Promise<never> {
  void _base64Image;
  throw new Error("ORIGINAL_RECEIPT_REQUIRED");
}

export async function processImageWithAI(_base64Image: string): Promise<never> {
  void _base64Image;
  throw new Error("ORIGINAL_RECEIPT_REQUIRED");
}
