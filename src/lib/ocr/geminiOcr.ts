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
  detectedType?: string;
  confidence?: number;
}

import { generateGeminiContentWithFallback } from "@/lib/ai/geminiClient";
import { Type } from "@google/genai";

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

    const rawTextResponse = response.text || "";
    if (!rawTextResponse) {
      return { rawText: "OCR fehlgeschlagen" };
    }

    const cleanedJsonText = rawTextResponse.replace(/```json|```/g, "").trim();
    const parsedData = JSON.parse(cleanedJsonText);

    return {
      customerName: parsedData.Kundenname || parsedData.customerName,
      company: parsedData.Firma || parsedData.company,
      address: parsedData.Adresse || parsedData.address,
      phone: parsedData.Telefon || parsedData.phone,
      email: parsedData.Email || parsedData.email || parsedData['E-Mail'],
      articleDescription: parsedData.Artikelbeschreibung || parsedData.articleDescription,
      material: parsedData.Material || parsedData.material,
      surface: parsedData.Oberflaeche || parsedData.surface || parsedData.Oberfläche,
      quantity: parsedData.Stueckzahl ? Number(parsedData.Stueckzahl) : (parsedData.quantity ? Number(parsedData.quantity) : undefined),
      notes: parsedData.Sonderhinweise || parsedData.notes,
      rawText: rawTextResponse
    };
  } catch (error) {
    console.error("Gemini OCR Request failed:", error);
    return { rawText: "OCR fehlgeschlagen", confidence: 0 };
  }
}
