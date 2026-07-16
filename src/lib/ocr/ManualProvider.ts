import type { OcrErgebnis, OcrProvider } from "@/lib/ocr/types";

export class ManualProvider implements OcrProvider {
  async extractBeleg(): Promise<OcrErgebnis> {
    throw new Error("OCR_PROVIDER_NOT_CONFIGURED");
  }
}
