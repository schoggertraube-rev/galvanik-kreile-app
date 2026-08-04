import { OcrProvider, OcrErgebnis } from "./types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parsedDocument(data: unknown): JsonRecord {
  if (!isRecord(data) || !isRecord(data.data) || !isRecord(data.data.parsed)) {
    return {};
  }

  return data.data.parsed;
}

function documentText(data: unknown): string | null {
  if (!isRecord(data) || !isRecord(data.data)) return null;

  return stringValue(data.data.text);
}

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

      const data: unknown = await response.json();
      return this.mapKlippaToOcrErgebnis(data);
    } catch (e) {
      console.error("Klippa OCR Failed:", e);
      throw e;
    }
  }

  private mapKlippaToOcrErgebnis(data: unknown): OcrErgebnis {
    const parsed = parsedDocument(data);
    const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    
    return {
      lieferant: stringValue(parsed.merchant_name),
      datum: stringValue(parsed.date),
      brutto: numberValue(parsed.amount),
      netto: numberValue(parsed.amount_net),
      ustSatz: numberValue(parsed.vat_rate),
      ustBetrag: numberValue(parsed.vat_amount),
      belegart: stringValue(parsed.document_type) ?? 'quittung',
      zahlungsart: stringValue(parsed.payment_method),
      rechnungsnummer: stringValue(parsed.invoice_number),
      confidence: numberValue(parsed.confidence) ?? 0.85,
      rohtext: documentText(data) ?? JSON.stringify(parsed),
      positionen: lines.map((line) => {
        const fields = isRecord(line) ? line : {};
        return {
          beschreibung: stringValue(fields.description) ?? "Unbekannt",
          menge: numberValue(fields.quantity) ?? 1,
          einzelpreis: numberValue(fields.price_per_unit) ?? numberValue(fields.amount),
          betrag: numberValue(fields.amount) ?? 0,
        };
      }),
    };
  }
}
