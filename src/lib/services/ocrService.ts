import { createId } from "@paralleldrive/cuid2";

export type OCRExtractedField = {
  key: string;
  value: string;
  confidence: number;
  reviewState: "accepted" | "edited" | "uncertain" | "ignored";
};

export type OCRScan = {
  id: string;
  extractedFields: OCRExtractedField[];
};

export const ocrService = {
  async simulateScan(type: "document" | "label" | "part_photo"): Promise<OCRScan> {
    console.log(`📸 OCR Service: Starte Simulation für ${type}`);
    // Simuliere Wartezeit für echtes Feeling
    await new Promise(r => setTimeout(r, 1800)); 
    
    // Demo-Daten mit absichtlich eingebauten Unsicherheiten (< 0.85)
    return {
      id: createId(),
      extractedFields: [
        { key: "customerName", value: "Museum Lenzburg", confidence: 0.92, reviewState: "accepted" },
        { key: "phone", value: "0172-5551234", confidence: 0.88, reviewState: "accepted" },
        { key: "itemName", value: "Ritterrüstung Helm", confidence: 0.70, reviewState: "uncertain" },
        { key: "quantity", value: "1", confidence: 0.95, reviewState: "accepted" },
        { key: "surfaceRequested", value: "versilbert", confidence: 0.55, reviewState: "uncertain" }
      ]
    };
  }
};
