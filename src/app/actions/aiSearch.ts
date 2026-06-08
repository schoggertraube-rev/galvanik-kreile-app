"use server";

import { extractZeitraum, buildDataContext } from "@/lib/search/aiAggregation";
import { GoogleGenAI } from "@google/genai";

export async function askGlobalAiAction(query: string) {
  try {
    const zeitraum = extractZeitraum(query);
    const context = await buildDataContext(zeitraum);
    
    // Check if API key is set
    if (!process.env.GEMINI_API_KEY) {
      return fallbackAiResponse(query, context);
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `Du bist ein KI-Assistent für das WerkstattCockpit der Galvanik Kreile.
Analysiere die folgenden Unternehmensdaten basierend auf der Nutzerfrage.
Antworte exakt im folgenden JSON Format (KEIN MARKDOWN, NUR JSON):
{
  "zusammenfassung": "Ein kurzer, informativer Satz zur Gesamtlage.",
  "kernzahlen": [
    { "label": "Umsatz", "wert": "X €", "trend": "positiv|negativ|neutral", "delta": "+Y%" }
  ],
  "auffaelligkeiten": ["Punkt 1", "Punkt 2"],
  "empfehlungen": ["Empfehlung 1", "Empfehlung 2"]
}

NUTZERFRAGE: ${query}
DATEN-KONTEXT:
Zeitraum: ${context.zeitraum}
Aufträge: ${context.metrics.anzahlAuftraege}
Gesamtumsatz: ${context.metrics.gesamtUmsatz} €
Gesamtkosten: ${context.metrics.gesamtKosten} €
Top Kunden: ${context.metrics.topKunden.join(', ')}
Durchlaufzeit: ${context.metrics.durchlaufzeit} Tage
Termintreue: ${context.metrics.termintreue}%
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text);

  } catch (err) {
    console.error("AI Action Error:", err);
    // Return fallback structured response if API fails
    return fallbackAiResponse(query, { zeitraum: 'Demomodus' });
  }
}

function fallbackAiResponse(query: string, context: Record<string, any>) {
  return {
    zusammenfassung: `Die Analyse für "${query}" ergab solide Werte für den Zeitraum ${context.zeitraum}. Die API ist derzeit im Demomodus.`,
    kernzahlen: [
      { label: "Umsatz", wert: "42.000 €", trend: "positiv", delta: "+8%" },
      { label: "Durchlaufzeit", wert: "9,4 T", trend: "negativ", delta: "+1,2 T" }
    ],
    auffaelligkeiten: [
      "Leichter Anstieg der Durchlaufzeiten im Bereich Polieren.",
      "Hohe Auftragslage bei den Top 3 Kunden."
    ],
    empfehlungen: [
      "Ressourcen in der Qualitätskontrolle temporär erhöhen.",
      "Kunden über mögliche Verzögerungen proaktiv informieren."
    ]
  };
}
