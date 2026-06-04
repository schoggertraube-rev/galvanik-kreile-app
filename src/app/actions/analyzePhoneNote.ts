"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_CUSTOMERS, INITIAL_ORDERS } from "@/lib/mockData";

export async function analyzePhoneNoteWithAI(text: string) {
  if (!text || text.trim().length < 3) {
    return null;
  }

  const apiKey = 
    process.env.GEMINI_API_KEY || 
    process.env.GOOGLE_API_KEY || 
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    // If no API key is present and we somehow escalated to AI, we just return null. 
    // The local analysis result will remain untouched.
    console.warn("AI Escalation requested but no GEMINI_API_KEY found.");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  const schema = {
    type: Type.OBJECT,
    properties: {
      customerName: {
        type: Type.STRING,
        description: "Der erkannte Kundenname, falls vorhanden.",
        nullable: true,
      },
      orderNumber: {
        type: Type.STRING,
        description: "Die erkannte Auftragsnummer (z.B. A-2026-0107), falls vorhanden.",
        nullable: true,
      },
      material: {
        type: Type.STRING,
        description: "Das erkannte Material oder Verfahren (z.B. Zink, Chrom, Vernickeln).",
        nullable: true,
      },
      theme: {
        type: Type.STRING,
        description: "Das Hauptthema des Anrufs (z.B. Reklamation, Abholtermin, Zahlungsfrage, Statusanfrage, Preisanfrage).",
        nullable: true,
      },
      timePhrase: {
        type: Type.STRING,
        description: "Erkannte Zeitangabe (z.B. morgen 10 Uhr, Freitag, heute).",
        nullable: true,
      },
      payment: {
        type: Type.STRING,
        description: "Erkannte Zahlungsart (z.B. Bar, Rechnung, Überweisung, EC-Karte).",
        nullable: true,
      },
      suggestedAnswer: {
        type: Type.STRING,
        description: "Ein natürlicher, freundlicher und kontextbezogener Antwortsatz, den der Mitarbeiter am Telefon direkt vorlesen kann. Basierend auf den erkannten Daten.",
      },
      overallConfidence: {
        type: Type.INTEGER,
        description: "Ein Konfidenzwert von 0 bis 100, wie sicher die Erkennung ist.",
      },
      highlights: {
        type: Type.ARRAY,
        description: "Liste von Wörtern aus dem Originaltext, die farblich hervorgehoben werden sollen.",
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            type: { 
              type: Type.STRING, 
              enum: ["kunde", "auftrag", "material", "thema", "zeit"] 
            }
          }
        }
      }
    },
    required: ["suggestedAnswer", "overallConfidence", "highlights"]
  };

  try {
    const prompt = `Analysiere den folgenden diktierten Text einer Telefonnotiz in einer Galvanik-Werkstatt. Extrahiere die geforderten Felder.

Text: "${text}"

Bekannte Kunden (als Kontext): ${INITIAL_CUSTOMERS.map(c => c.name).join(", ")}
Bekannte Aufträge (als Kontext): ${INITIAL_ORDERS.map(o => o.orderNumber).join(", ")}

WICHTIGE REGELN ZUR FAKTEN-TREUE (DATABASE FIRST):
1. Erfinde NIEMALS Fakten. Wenn ein Kunde oder Auftrag im Text genannt wird, aber nicht in den bekannten Listen steht, dann erwähne ihn, aber erfinde keinen Status dazu.
2. Wenn du nicht sicher bist, weise darauf hin, dass die Zuordnung unklar ist.
3. Generiere einen sinnvollen Antwort-Vorschlag, der auf den erkannten Daten basiert und professionell klingt.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1,
      }
    });

    if (!response.text) return null;
    
    const parsed = JSON.parse(response.text);
    return parsed;

  } catch (error) {
    console.error("Gemini AI Analysis Error:", error);
    throw new Error("Failed to analyze text with AI");
  }
}

