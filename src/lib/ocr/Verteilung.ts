import type { OcrErgebnis } from "@/lib/ocr/types";

/**
 * OCR alone is not an accounting approval. Distribution into fuel, stock,
 * BWA or tax flows must be triggered from a confirmed receipt workflow.
 */
export function verteilBeleg(
  _belegId: string,
  _ergebnis: OcrErgebnis,
  _kategorieName: string,
): Promise<never> {
  void _belegId;
  void _ergebnis;
  void _kategorieName;
  return Promise.reject(new Error("OCR_DISTRIBUTION_REQUIRES_CONFIRMED_RECEIPT"));
}
