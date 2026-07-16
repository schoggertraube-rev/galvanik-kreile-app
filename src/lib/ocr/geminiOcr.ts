export interface OcrResult {
  customerName?: string;
  company?: string;
  address?: string;
  phone?: string;
  email?: string;
  articleDescription?: string;
  material?: string;
  surface?: string;
  quantity?: number;
  notes?: string;
  rawText: string;
}

import { generateGeminiContentWithFallback } from "@/lib/ai/geminiClient";
import { Type } from "@google/genai";

function optionalText(value: unknown, maximum: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("OCR_INVALID_RESPONSE");
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new Error("OCR_INVALID_RESPONSE");
  }
  return normalized;
}

export function parseOcrResponse(rawTextResponse: string): OcrResult {
  if (!rawTextResponse.trim() || rawTextResponse.length > 50_000) throw new Error("OCR_EMPTY_RESPONSE");
  const cleanedJsonText = rawTextResponse.replace(/```json|```/g, "").trim();
  const parsed: unknown = JSON.parse(cleanedJsonText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("OCR_INVALID_RESPONSE");
  const data = parsed as Record<string, unknown>;
  const rawQuantity = data.Stueckzahl ?? data.quantity;
  let quantity: number | undefined;
  if (rawQuantity !== undefined && rawQuantity !== null && rawQuantity !== "") {
    const parsedQuantity = typeof rawQuantity === "number" ? rawQuantity : Number(rawQuantity);
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 1_000_000) {
      throw new Error("OCR_INVALID_RESPONSE");
    }
    quantity = parsedQuantity;
  }

  const result: OcrResult = {
    customerName: optionalText(data.Kundenname ?? data.customerName, 200),
    company: optionalText(data.Firma ?? data.company, 200),
    address: optionalText(data.Adresse ?? data.address, 500),
    phone: optionalText(data.Telefon ?? data.phone, 100),
    email: optionalText(data.Email ?? data.email ?? data["E-Mail"], 320),
    articleDescription: optionalText(data.Artikelbeschreibung ?? data.articleDescription, 500),
    material: optionalText(data.Material ?? data.material, 100),
    surface: optionalText(data.Oberflaeche ?? data.surface ?? data["Oberfläche"], 100),
    quantity,
    notes: optionalText(data.Sonderhinweise ?? data.notes, 1_000),
    rawText: rawTextResponse,
  };
  const hasStructuredEvidence = Object.entries(result).some(([key, value]) => key !== "rawText" && value !== undefined);
  if (!hasStructuredEvidence) throw new Error("OCR_NO_STRUCTURED_DATA");
  return result;
}

export async function extractDocumentData(imageBase64: string): Promise<OcrResult> {
  const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

  const schema = {
    type: Type.OBJECT,
    properties: {
      Kundenname: { type: Type.STRING, nullable: true },
      Firma: { type: Type.STRING, nullable: true },
      Adresse: { type: Type.STRING, nullable: true },
      Telefon: { type: Type.STRING, nullable: true },
      Email: { type: Type.STRING, nullable: true },
      Artikelbeschreibung: { type: Type.STRING, nullable: true },
      Material: { type: Type.STRING, nullable: true },
      Oberflaeche: { type: Type.STRING, nullable: true },
      Stueckzahl: { type: Type.NUMBER, nullable: true },
      Sonderhinweise: { type: Type.STRING, nullable: true }
    }
  };

  const payloadContents = [
    { text: "Du bist ein OCR-Assistent fuer eine Galvanik-Werkstatt. Extrahiere aus diesem Dokument/Foto: Kundenname, Firma, Adresse, Telefon, E-Mail, Artikelbeschreibung, Material, Oberflaeche, Stueckzahl, Sonderhinweise. Antworte NUR als JSON ohne Markdown-Backticks." },
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data
      }
    }
  ];

  try {
    const response = await generateGeminiContentWithFallback({
      contents: payloadContents,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    return parseOcrResponse(response.text || "");
  } catch (error) {
    console.error("Gemini OCR Request failed:", error);
    throw new Error("OCR_EXTRACTION_FAILED", { cause: error });
  }
}
