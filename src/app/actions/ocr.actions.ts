"use server";

import { GoogleGenAI } from "@google/genai";
import { createId } from "@paralleldrive/cuid2";
import { ocrService, OCRScan } from "@/lib/services/ocrService";

export async function processImageWithAI(base64Image: string): Promise<OCRScan> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn("⚠️ GEMINI_API_KEY is not set. Falling back to simulated scan.");
    return await ocrService.simulateScan("document");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Strip the data URI prefix if present (e.g. "data:image/jpeg;base64,")
    const base64Data = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;

    const prompt = `Du bist ein Experte in der Auftragsannahme einer Galvanik-Werkstatt.
Analysiere das Bild (Lieferschein, Laufkarte, Zettel oder Bauteil) und extrahiere ALLE nützlichen Informationen für den Auftrag oder die Kundenkartei.
Achte besonders auf:
- Kundenname, Firma, Ansprechpartner
- Adresse, PLZ, Ort
- Telefonnummer, E-Mail
- Name des Bauteils, Artikelnummer, Zeichnungsnummer
- Anzahl / Menge, Gewicht, Abmessungen
- Gewünschte Oberfläche (z.B. vergoldet, versilbert, vernickelt, eloxiert), Schichtdicke
- Bemerkungen, Sonderwünsche (z.B. "nicht polieren", "dringend", "Express")
- Auftragsnummer, Lieferscheinnummer, Datum

Du bist nicht auf diese Felder beschränkt. Finde alle relevanten Infos und erfinde selbst passende Felder, wenn nötig!
Wähle für jedes gefundene Feld einen selbsterklärenden englischen camelCase-Schlüssel (z.B. "customerName", "email", "orderNumber", "specialNotes", "drawingNumber", "dimensions", "urgent").

Antworte NUR mit einem JSON-Objekt ohne Markdown-Codeblöcke, exakt in diesem Format:
{
  "extractedFields": [
    { "key": "customerName", "value": "Müller GmbH", "confidence": 0.95 },
    { "key": "orderNumber", "value": "AUF-1234", "confidence": 0.88 },
    { "key": "specialNotes", "value": "Bitte extra dick vergolden", "confidence": 0.75 }
    // ... füge hier ALLE auf dem Bild gefundenen Felder als weitere Objekte hinzu
  ]
}
Wenn ein Feld unleserlich oder geraten ist, gib einen niedrigen Confidence-Wert (< 0.7).`;

    const maxRetries = 3;
    let attempt = 0;
    let response;
    while (attempt < maxRetries) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data,
              },
            },
            { text: prompt },
          ],
        });
        // success, break out of retry loop
        break;
      } catch (innerErr) {
        attempt++;
        console.warn(`Gemini API attempt ${attempt} failed:`, innerErr);
        if (attempt >= maxRetries) throw innerErr;
        // exponential backoff before retrying
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }

    if (!response) throw new Error("Gemini API call failed after retries.");

    const rawText = response.text;
    console.log("🤖 Gemini raw response:", rawText);

    if (!rawText) throw new Error("Empty response from Gemini API");

    // Parse JSON — strip any accidental markdown fences
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsedData = JSON.parse(cleaned);

    const mappedFields = (parsedData.extractedFields || []).map((field: { key: string; value: string; confidence: number }) => ({
      key: field.key,
      value: field.value,
      confidence: field.confidence,
      reviewState: (field.confidence > 0.85 ? "accepted" : "uncertain") as "accepted" | "uncertain",
    }));

    return {
      id: createId(),
      extractedFields: mappedFields,
    };

  } catch (error) {
    console.error("❌ Gemini API Error:", error);
    console.warn("Falling back to simulated scan due to API error.");
    return await ocrService.simulateScan("document");
  }
}
