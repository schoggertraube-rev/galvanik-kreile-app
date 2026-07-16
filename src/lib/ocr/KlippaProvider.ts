import { parseOcrResult } from "@/lib/ocr/resultContract";
import type { OcrErgebnis, OcrProvider, OcrPosition } from "@/lib/ocr/types";

const MAX_PROVIDER_RESPONSE = 1_000_000;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positions(value: unknown): OcrPosition[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((entry) => {
    const line = object(entry);
    const description = text(line.description);
    const amount = number(line.amount);
    if (!description || amount === null || amount < 0) return [];
    return [{
      beschreibung: description,
      menge: number(line.quantity),
      einzelpreis: number(line.price_per_unit),
      betrag: amount,
    }];
  });
}

export class KlippaProvider implements OcrProvider {
  async extractBeleg(imageUrl: string): Promise<OcrErgebnis> {
    const apiKey = process.env.KLIPPA_API_KEY;
    if (!apiKey) throw new Error("Klippa OCR is not configured");
    const response = await fetch("https://custom-ocr.klippa.com/api/v1/parseDocument", {
      method: "POST",
      headers: { "X-Auth-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ url: imageUrl, template: "financial_document", pdf_text_extraction: "fast" }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`Klippa OCR failed with status ${response.status}`);
    const body = await response.text();
    if (!body || body.length > MAX_PROVIDER_RESPONSE) throw new Error("Klippa OCR response is invalid");
    const root = object(JSON.parse(body));
    const data = object(root.data);
    const parsed = object(data.parsed);

    return parseOcrResult({
      lieferant: text(parsed.merchant_name),
      datum: text(parsed.date),
      brutto: number(parsed.amount),
      netto: number(parsed.amount_net),
      ustSatz: number(parsed.vat_rate),
      ustBetrag: number(parsed.vat_amount),
      belegart: text(parsed.document_type),
      zahlungsart: text(parsed.payment_method),
      rechnungsnummer: text(parsed.invoice_number),
      confidence: number(parsed.confidence) ?? 0,
      rohtext: text(data.text) ?? "",
      positionen: positions(parsed.lines),
      actualUnits: null,
      providerStatus: "klippa",
    });
  }
}
