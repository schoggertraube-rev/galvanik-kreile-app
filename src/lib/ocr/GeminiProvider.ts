import { OcrProvider, OcrErgebnis } from "./types";
import { generateGeminiContentWithFallback } from "@/lib/ai/geminiClient";
import { Type } from "@google/genai";

export class GeminiProvider implements OcrProvider {
  async extractBeleg(imageUrl: string): Promise<OcrErgebnis> {
    console.log("[GeminiProvider] extractBeleg called with:", imageUrl);
    try {
      const { data: base64Data, mimeType } = await this.fetchImageAsBase64(imageUrl);

      const schema = {
        type: Type.OBJECT,
        properties: {
          lieferant: { type: Type.STRING, nullable: true },
          datum: { type: Type.STRING, nullable: true, description: "ISO date string YYYY-MM-DD" },
          brutto: { type: Type.NUMBER, nullable: true, description: "Bruttobetrag in EUR" },
          netto: { type: Type.NUMBER, nullable: true, description: "Nettobetrag in EUR" },
          ustSatz: { type: Type.NUMBER, nullable: true, description: "Umsatzsteuersatz in Prozent (z.B. 19 oder 7)" },
          ustBetrag: { type: Type.NUMBER, nullable: true, description: "Umsatzsteuerbetrag in EUR" },
          belegart: { type: Type.STRING, nullable: true, description: "rechnung, quittung, tankbeleg, kassenbon" },
          zahlungsart: { type: Type.STRING, nullable: true, description: "bar, karte, ueberweisung" },
          rechnungsnummer: { type: Type.STRING, nullable: true },
          positionen: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                beschreibung: { type: Type.STRING },
                menge: { type: Type.NUMBER, nullable: true },
                einzelpreis: { type: Type.NUMBER, nullable: true },
                betrag: { type: Type.NUMBER }
              },
              required: ["beschreibung", "betrag"]
            }
          }
        }
      };

      const payloadContents = [
        { text: "Extrahiere Belegdaten aus diesem Dokument. Gib Lieferant, Datum, Brutto, Netto, USt-Satz (als Zahl, z.B. 19), USt-Betrag, Belegart, Zahlungsart, Rechnungsnummer und einzelne Belegpositionen an." },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        }
      ];

      const response = await generateGeminiContentWithFallback({
        contents: payloadContents,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });

      const rawTextResponse = response.text || "";
      if (!rawTextResponse) {
        return this.getFallbackErgebnis("Leere Antwort von Gemini erhalten", rawTextResponse);
      }

      const cleanedJsonText = rawTextResponse.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanedJsonText);

      // Plausibilitätsprüfung (AP P1-02 Schritt 4)
      // Wenn Brutto oder Datum fehlt, setzen wir niedrige Plausibilität (confidence < 0.85)
      const isPlausible = !!parsed.brutto && !!parsed.datum && !!parsed.lieferant;
      const confidence = isPlausible ? 0.90 : 0.50;

      return {
        lieferant: parsed.lieferant || null,
        datum: parsed.datum || null,
        brutto: parsed.brutto || null,
        netto: parsed.netto || null,
        ustSatz: parsed.ustSatz || null,
        ustBetrag: parsed.ustBetrag || null,
        belegart: parsed.belegart || null,
        zahlungsart: parsed.zahlungsart || null,
        rechnungsnummer: parsed.rechnungsnummer || null,
        confidence: confidence,
        rohtext: rawTextResponse,
        positionen: (parsed.positionen || []).map((line: Record<string, unknown>) => ({
          beschreibung: typeof line.beschreibung === "string" ? line.beschreibung : "Unbekannte Position",
          menge: typeof line.menge === "number" ? line.menge : null,
          einzelpreis: typeof line.einzelpreis === "number" ? line.einzelpreis : null,
          betrag: typeof line.betrag === "number" ? line.betrag : 0
        }))
      };
    } catch (e: unknown) {
      console.error("Gemini OCR Failed:", e);
      return this.getFallbackErgebnis(e instanceof Error ? e.message : "Unerwarteter Fehler", "");
    }
  }

  private async fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      data: buffer.toString("base64"),
      mimeType: contentType
    };
  }

  private getFallbackErgebnis(reason: string, rohtext: string): OcrErgebnis {
    return {
      lieferant: null,
      datum: null,
      brutto: null,
      netto: null,
      ustSatz: null,
      ustBetrag: null,
      belegart: null,
      zahlungsart: null,
      rechnungsnummer: null,
      confidence: 0.10, // Erzwingt "manuell zu prüfen"
      rohtext: `Fehler: ${reason}\n\n${rohtext}`,
      positionen: []
    };
  }
}
