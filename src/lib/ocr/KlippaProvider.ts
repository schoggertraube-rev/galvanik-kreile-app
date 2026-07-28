import type { OcrErgebnis, OcrProvider } from "./types";

/** External OCR is blocked until the photo/OCR data contract is approved. */
export class KlippaProvider implements OcrProvider {
  async extractBeleg(_imageUrl: string): Promise<OcrErgebnis> {
    void _imageUrl;
    throw new Error("NOT_CONFIGURED: Klippa-OCR ist nicht freigegeben.");
  }
}
