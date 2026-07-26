import type { OcrErgebnis, OcrPosition } from "@/lib/ocr/types";

const RESULT_KEYS = [
  "lieferant",
  "datum",
  "brutto",
  "netto",
  "ustSatz",
  "ustBetrag",
  "positionen",
  "belegart",
  "zahlungsart",
  "rechnungsnummer",
  "confidence",
  "rohtext",
  "actualUnits",
  "providerStatus",
] as const;
const POSITION_KEYS = ["beschreibung", "menge", "einzelpreis", "betrag"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function record(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key))) throw new Error(code);
  return result;
}

function optionalText(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("OCR_RESULT_INVALID");
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || normalized.includes("\0")) {
    throw new Error("OCR_RESULT_INVALID");
  }
  return normalized;
}

function optionalNumber(value: unknown, maximum: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error("OCR_RESULT_INVALID");
  }
  return Math.round(value * 100) / 100;
}

function optionalDate(value: unknown): string | null {
  const text = optionalText(value, 10);
  if (text === null) return null;
  if (!ISO_DATE.test(text)) throw new Error("OCR_RESULT_INVALID");
  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900
    || year > new Date().getUTCFullYear() + 1
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error("OCR_RESULT_INVALID");
  }
  return text;
}

function receiptType(value: unknown): string | null {
  const normalized = optionalText(value, 40)?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "quittung" || normalized === "kassenbeleg") return "kassenbon";
  return ["rechnung", "kassenbon", "tankbeleg", "bewirtung", "abo"].includes(normalized)
    ? normalized
    : null;
}

function paymentType(value: unknown): string | null {
  const normalized = optionalText(value, 40)?.toLowerCase().replace("ü", "ue");
  if (!normalized) return null;
  return ["bar", "karte", "ueberweisung", "paypal"].includes(normalized) ? normalized : null;
}

function positions(value: unknown): OcrPosition[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("OCR_RESULT_INVALID");
  return value.map((entry) => {
    const item = record(entry, POSITION_KEYS, "OCR_RESULT_INVALID");
    const description = optionalText(item.beschreibung, 500);
    const amount = optionalNumber(item.betrag, 9_999_999_999);
    if (!description || amount === null) throw new Error("OCR_RESULT_INVALID");
    return {
      beschreibung: description,
      menge: optionalNumber(item.menge, 1_000_000),
      einzelpreis: optionalNumber(item.einzelpreis, 9_999_999_999),
      betrag: amount,
    };
  });
}

export function parseStoredOcrPositions(value: unknown): OcrPosition[] {
  return positions(value);
}

function confidencePercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("OCR_RESULT_INVALID");
  }
  const percent = value <= 1 ? value * 100 : value;
  return Math.round(percent * 100) / 100;
}

export function parseOcrResult(value: unknown): OcrErgebnis {
  const result = record(value, RESULT_KEYS, "OCR_RESULT_INVALID");
  const rawText = optionalText(result.rohtext, 100_000) ?? "";
  const actualUnits = result.actualUnits === null || result.actualUnits === undefined
    ? null
    : result.actualUnits;
  if (actualUnits !== null && (!Number.isSafeInteger(actualUnits) || (actualUnits as number) < 0)) {
    throw new Error("OCR_RESULT_INVALID");
  }
  const providerStatus = optionalText(result.providerStatus, 80);

  return {
    lieferant: optionalText(result.lieferant, 300),
    datum: optionalDate(result.datum),
    brutto: optionalNumber(result.brutto, 9_999_999_999),
    netto: optionalNumber(result.netto, 9_999_999_999),
    ustSatz: optionalNumber(result.ustSatz, 100),
    ustBetrag: optionalNumber(result.ustBetrag, 9_999_999_999),
    positionen: positions(result.positionen),
    belegart: receiptType(result.belegart),
    zahlungsart: paymentType(result.zahlungsart),
    rechnungsnummer: optionalText(result.rechnungsnummer, 200),
    confidence: confidencePercent(result.confidence),
    rohtext: rawText,
    actualUnits: actualUnits as number | null,
    providerStatus,
  };
}

export function normalizeSupplierName(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized || normalized.length > 300) throw new Error("OCR_SUPPLIER_INVALID");
  return normalized;
}

export function ocrResultForLedger(result: OcrErgebnis): Record<string, unknown> {
  return {
    lieferant: result.lieferant,
    datum: result.datum,
    brutto: result.brutto,
    netto: result.netto,
    ustSatz: result.ustSatz,
    ustBetrag: result.ustBetrag,
    positionen: result.positionen,
    belegart: result.belegart,
    zahlungsart: result.zahlungsart,
    rechnungsnummer: result.rechnungsnummer,
    confidence: result.confidence,
    rohtext: result.rohtext,
    actualUnits: result.actualUnits ?? null,
    providerStatus: result.providerStatus ?? null,
  };
}
