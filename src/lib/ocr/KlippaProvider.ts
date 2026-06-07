import { OcrProvider, OcrErgebnis } from "./types";

export class KlippaProvider implements OcrProvider {
  async extractBeleg(imageUrl: string): Promise<OcrErgebnis> {
    if (!process.env.KLIPPA_API_KEY) {
      throw new Error("KLIPPA_API_KEY is not set in environment variables");
    }

    try {
      const response = await fetch('https://custom-ocr.klippa.com/api/v1/parseDocument', {
        method: 'POST',
        headers: {
          'X-Auth-Key': process.env.KLIPPA_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: imageUrl,
          template: 'financial_document',
          pdf_text_extraction: 'fast',
        }),
      });

      if (!response.ok) {
        throw new Error(`Klippa API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapKlippaToOcrErgebnis(data);
    } catch (e: any) {
      console.error("Klippa OCR Failed:", e);
      throw e;
    }
  }

  private mapKlippaToOcrErgebnis(data: any): OcrErgebnis {
    // Basic mapping, assuming standard response structure or mocking it if missing
    // Since we don't have exact Klippa payload type here, we do best-effort mapping
    const parsed = data.data?.parsed || {};
    
    return {
      lieferant: parsed.merchant_name || null,
      datum: parsed.date || null,
      brutto: parsed.amount || null,
      netto: parsed.amount_net || null,
      ustSatz: parsed.vat_rate || null,
      ustBetrag: parsed.vat_amount || null,
      belegart: parsed.document_type || 'quittung',
      zahlungsart: parsed.payment_method || null,
      rechnungsnummer: parsed.invoice_number || null,
      confidence: parsed.confidence || 0.85,
      rohtext: data.data?.text || JSON.stringify(parsed),
      positionen: (parsed.lines || []).map((line: any) => ({
        beschreibung: line.description || "Unbekannt",
        menge: line.quantity || 1,
        einzelpreis: line.price_per_unit || line.amount,
        betrag: line.amount || 0
      }))
    };
  }
}
