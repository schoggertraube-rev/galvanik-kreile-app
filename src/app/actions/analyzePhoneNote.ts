"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { MockCustomer, MockOrder } from "@/lib/mockData";

export type PhoneNoteCategory =
  | "pickup_request"
  | "status_question"
  | "payment_question"
  | "complaint"
  | "callback"
  | "new_order_intake"
  | "quote_request"
  | "shipping_question"
  | "technical_question"
  | "general";

export interface AIAnalysisInput {
  text: string;
  knownFacts: {
    customerCandidates: string[];
    orderCandidates: string[];
    selectedCustomer: string | null;
    selectedOrders: string[];
    detectedDate: string | null;
    paymentKnown: string | null;
  };
}

export async function analyzePhoneNoteWithAI(input: AIAnalysisInput) {
  if (!input.text || input.text.trim().length < 3) return null;

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    console.warn("AI Escalation requested but no GEMINI_API_KEY found.");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  const schema = {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: "Die Hauptkategorie des Anrufs.",
        enum: [
          "pickup_request", "status_question", "payment_question", "complaint",
          "callback", "new_order_intake", "quote_request", "shipping_question",
          "technical_question", "general"
        ]
      },
      material: {
        type: Type.STRING,
        description: "Das erkannte Material oder Verfahren (z.B. Zink, Chrom, Vernickeln), falls aus dem Text ersichtlich.",
        nullable: true,
      },
      suggestedAnswer: {
        type: Type.STRING,
        description: "Ein natürlicher, freundlicher und kontextbezogener Antwortsatz für den Mitarbeiter. Erfasse die Situation lebendig, aber bleibe streng bei den knownFacts (keine Erfindungen von Fakten!). Wenn ein Fakt (Kunde, Auftrag, Status, Zahlung) unbekannt ist, formuliere, dass das noch geklärt werden muss.",
      },
      overallConfidence: {
        type: Type.INTEGER,
        description: "Ein Konfidenzwert von 0 bis 100, wie sicher die Erkennung der Absicht ist.",
      },
    },
    required: ["category", "suggestedAnswer", "overallConfidence"]
  };

  try {
    const prompt = `Analysiere den folgenden diktierten Text einer Telefonnotiz in einer Galvanik-Werkstatt.
Dein Ziel ist es, die Absicht (Kategorie) zu erkennen und einen professionellen Antwortvorschlag zu formulieren.

Text: "${input.text}"

WICHTIG - BEKANNTE FAKTEN (DATABASE FIRST):
Du darfst NIEMALS Fakten erfinden. Nutze AUSSCHLIESSLICH diese bekannten Fakten für deinen Antwortvorschlag.
- Eindeutiger Kunde: ${input.knownFacts.selectedCustomer || "Keiner/Unklar"}
- Mögliche Kunden (Fuzzy): ${input.knownFacts.customerCandidates.join(", ") || "Keine"}
- Eindeutige Aufträge: ${input.knownFacts.selectedOrders.join(", ") || "Keine"}
- Mögliche Aufträge (Fuzzy): ${input.knownFacts.orderCandidates.join(", ") || "Keine"}
- Erkanntes Datum/Termin: ${input.knownFacts.detectedDate || "Keins"}
- Erkannte Zahlung: ${input.knownFacts.paymentKnown || "Keine"}

REGELN FÜR DEN ANTWORTVORSCHLAG:
1. Wenn es ein neuer Auftrag ist (new_order_intake): Formuliere, dass der Vorgang für den Wareneingang erfasst wird.
2. Wenn es ein KV/Angebot ist (quote_request): Weise darauf hin, dass Foto/Teil/Material nötig sind für eine verbindliche Schätzung.
3. Wenn es eine Abholung ist: Weise auf Prüfung von Auftrag, Termin und Zahlung hin.
4. Wenn Reklamation: Formuliere, dass das aufgenommen und zur Klärung weitergegeben wird.
5. Keine trockenen Standard-Phrasen wie "Ich nehme die Anfrage auf und kläre den Vorgang intern" bei jedem Fall. Sei kontextbezogen!
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2, // slightly higher for natural phrasing, but grounded by prompt
      }
    });

    if (!response.text) return null;
    return JSON.parse(response.text);

  } catch (error) {
    console.error("Gemini AI Analysis Error:", error);
    throw new Error("Failed to analyze text with AI");
  }
}
