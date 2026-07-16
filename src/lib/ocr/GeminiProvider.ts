import { Type } from "@google/genai";
import { generateGeminiContentWithFallback } from "@/lib/ai/geminiClient";
import { parseOcrResult } from "@/lib/ocr/resultContract";
import type { OcrErgebnis, OcrProvider } from "@/lib/ocr/types";

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const MAX_PROVIDER_RESPONSE = 200_000;
const RECEIPT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Gemini OCR response is invalid");
  return value as Record<string, unknown>;
}

function configuredStorageHost(): string {
  const configured = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configured) throw new Error("OCR storage configuration unavailable");
  const url = new URL(configured);
  if (url.protocol !== "https:") throw new Error("OCR storage configuration unavailable");
  return url.host;
}

export class GeminiProvider implements OcrProvider {
  async extractBeleg(imageUrl: string): Promise<OcrErgebnis> {
    const { data, mimeType } = await this.fetchImageAsBase64(imageUrl);
    const schema = {
      type: Type.OBJECT,
      properties: {
        lieferant: { type: Type.STRING, nullable: true },
        datum: { type: Type.STRING, nullable: true, description: "ISO-Datum YYYY-MM-DD oder null" },
        brutto: { type: Type.NUMBER, nullable: true },
        netto: { type: Type.NUMBER, nullable: true },
        ustSatz: { type: Type.NUMBER, nullable: true },
        ustBetrag: { type: Type.NUMBER, nullable: true },
        belegart: { type: Type.STRING, nullable: true },
        zahlungsart: { type: Type.STRING, nullable: true },
        rechnungsnummer: { type: Type.STRING, nullable: true },
        rohtext: { type: Type.STRING },
        positionen: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              beschreibung: { type: Type.STRING },
              menge: { type: Type.NUMBER, nullable: true },
              einzelpreis: { type: Type.NUMBER, nullable: true },
              betrag: { type: Type.NUMBER },
            },
            required: ["beschreibung", "betrag"],
          },
        },
      },
      required: ["rohtext", "positionen"],
    };
    const response = await generateGeminiContentWithFallback({
      contents: [
        {
          text: "Extrahiere ausschließlich im Dokument sichtbare Belegdaten. Erfinde keine Werte, Lieferanten, Positionen oder Datumsangaben; unsichere oder fehlende Felder müssen null sein. rohtext enthält nur erkannten Dokumenttext. Antworte ausschließlich im vorgegebenen JSON-Schema.",
        },
        { inlineData: { mimeType, data } },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0,
        maxOutputTokens: 4_096,
      },
    });
    const rawResponse = response.text || "";
    if (!rawResponse || rawResponse.length > MAX_PROVIDER_RESPONSE) {
      throw new Error("Gemini OCR response is empty or too large");
    }
    const parsed = object(JSON.parse(rawResponse.replace(/```json|```/g, "").trim()));
    const metadata = response as { usageMetadata?: { totalTokenCount?: unknown }; modelVersion?: unknown };
    const totalTokens = Number(metadata.usageMetadata?.totalTokenCount);
    const actualUnits = Number.isSafeInteger(totalTokens) && totalTokens >= 0 ? totalTokens : null;
    const providerStatus = typeof metadata.modelVersion === "string" && metadata.modelVersion.trim()
      ? metadata.modelVersion.trim().slice(0, 80)
      : "gemini";

    return parseOcrResult({
      lieferant: parsed.lieferant ?? null,
      datum: parsed.datum ?? null,
      brutto: parsed.brutto ?? null,
      netto: parsed.netto ?? null,
      ustSatz: parsed.ustSatz ?? null,
      ustBetrag: parsed.ustBetrag ?? null,
      positionen: parsed.positionen ?? [],
      belegart: parsed.belegart ?? null,
      zahlungsart: parsed.zahlungsart ?? null,
      rechnungsnummer: parsed.rechnungsnummer ?? null,
      confidence: 0,
      rohtext: parsed.rohtext ?? "",
      actualUnits,
      providerStatus,
    });
  }

  private async fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:" || url.host !== configuredStorageHost()) {
      throw new Error("OCR storage URL is not trusted");
    }
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("Stored receipt could not be loaded");
    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim() || "";
    if (!RECEIPT_TYPES.has(contentType)) throw new Error("Stored receipt type is invalid");
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RECEIPT_BYTES) {
      throw new Error("Stored receipt is too large");
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength < 1 || arrayBuffer.byteLength > MAX_RECEIPT_BYTES) {
      throw new Error("Stored receipt size is invalid");
    }
    return { data: Buffer.from(arrayBuffer).toString("base64"), mimeType: contentType };
  }
}
