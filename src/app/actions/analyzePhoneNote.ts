"use server";

import { Type } from "@google/genai";
import { generateGeminiContentWithFallback } from "@/lib/ai/geminiClient";

export type PhoneNoteCategory =
  | "pickup_request"
  | "status_question"
  | "payment_question"
  | "complaint"
  | "callback"
  | "new_order_intake"
  | "new_customer_request"
  | "quote_request"
  | "email_review"
  | "attachment_review"
  | "photo_review"
  | "document_review"
  | "appointment_request"
  | "deadline_request"
  | "material_or_surface_info"
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

  const schema = {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: "Die Hauptkategorie des Anrufs.",
        enum: [
          "pickup_request", "status_question", "payment_question", "complaint",
          "callback", "new_order_intake", "new_customer_request", "quote_request",
          "email_review", "attachment_review", "photo_review", "document_review",
          "appointment_request", "deadline_request", "material_or_surface_info",
          "shipping_question", "technical_question", "general"
        ]
      },
      material: {
        type: Type.STRING,
        description: "Das erkannte Material (z.B. Zink, Kupfer, Messing, Stahl, Bronze), falls aus dem Text ersichtlich.",
        nullable: true,
      },
      surfaceRequested: {
        type: Type.STRING,
        description: "Die gewünschte Oberfläche oder das Verfahren (z.B. Versilbern, Verchromen, Vernickeln).",
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
3. Wenn Neukunde (new_customer_request): Erfinde keine Fakten zu einem existierenden Kunden. Weise darauf hin, dass der Kunde im System neu angelegt wird.
4. Wenn E-Mail/Bilder (email_review, photo_review): Erwähne, dass die E-Mail/Bilder jetzt geöffnet und geprüft werden.
5. Wenn Reklamation (complaint): Formuliere, dass das aufgenommen und zur Klärung weitergegeben wird.
6. Keine trockenen Standard-Phrasen wie "Ich nehme die Anfrage auf" bei jedem Fall. Sei kontextbezogen!
`;

    const response = await generateGeminiContentWithFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2, // slightly higher for natural phrasing, but grounded by prompt
      }
    });

    if (!response.text) return null;
    const parsed = JSON.parse(response.text);
    return {
      category: parsed.category,
      material: parsed.material,
      surfaceRequested: parsed.surfaceRequested,
      suggestedAnswer: parsed.suggestedAnswer,
      overallConfidence: parsed.overallConfidence
    };

  } catch (error) {
    console.error("Gemini AI Analysis Error:", error);
    return {
      category: "general",
      material: null,
      surfaceRequested: null,
      suggestedAnswer: "Die KI-Analyse ist aktuell wegen hoher Auslastung nicht verfügbar. Die Notiz wurde dennoch gespeichert.",
      overallConfidence: 0
    };
  }
}
