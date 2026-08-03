"use server";

import { extractZeitraum, buildDataContext } from "@/lib/search/aiAggregation";
import { generateAiResponse, GeminiConfigError, GeminiQuotaError } from "@/lib/ai/geminiClient";

export async function askGlobalAiAction(query: string) {
  try {
    const zeitraum = extractZeitraum(query);
    const context = await buildDataContext(zeitraum);
    
    // Heuristic: Only allow web search if the user asks for external information
    // internal business metrics should NOT trigger Google Search
    const needsWebSearch = /wetter|nachrichten|news|markt|aktien|google|recherchiere|welt|aktuell/i.test(query);
    
    const prompt = `Du bist ein KI-Assistent für das WerkstattCockpit der Galvanik Kreile. 
${needsWebSearch ? "Du hast Zugriff auf die Google-Suche, um aktuelle externe Fragen zu beantworten." : "Beantworte die Frage NUR basierend auf den internen Systemdaten. Erfinde keine Fakten."}
Analysiere die folgenden Unternehmensdaten basierend auf der Nutzerfrage.

WICHTIGE REGELN:
- Erfinde niemals Umsatz, Kosten, Gewinn, Durchlaufzeit oder andere Kennzahlen.
- Wenn im Daten-Kontext "Keine Daten" oder "Nicht berechenbar" steht, musst du exakt dies ausgeben und darfst dir keine Werte ausdenken.
- Nutze keine allgemeinen Branchenannahmen. Nutze keine Demo-Werte als Realität.
- Wenn ein Zeitraum keine Datensätze enthält, sage "Für diesen Zeitraum liegen keine passenden Daten vor".
- Verweise in den Empfehlungen auf passende App-Bereiche (z.B. Performance Cockpit, Warendurchlauf, Buchhaltung).

Antworte exakt im folgenden JSON Format (KEIN MARKDOWN, NUR JSON):
{
  "zusammenfassung": "Ein kurzer, informativer Satz zur Gesamtlage oder die Antwort auf die allgemeine Frage.",
  "kernzahlen": [
    { "label": "Umsatz", "wert": "X €", "trend": "neutral", "delta": "N/A" }
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
Durchlaufzeit: ${context.metrics.durchlaufzeit}
Termintreue: ${context.metrics.termintreue}

VERGLEICHS-KONTEXT (${context.comparisonZeitraum}):
(Vergleichsdaten sind derzeit nicht aggregiert. Bitte gib N/A für Deltas aus.)
`;

    const text = await generateAiResponse(prompt, needsWebSearch);
    
    return JSON.parse(text);

  } catch (err: unknown) {
    console.error("AI Action Error:", err);
    
    // Use the specific error message if it's one of our custom errors
    let errorMsg = "Unbekannter API-Fehler";
    if (err instanceof GeminiConfigError || err instanceof GeminiQuotaError) {
      errorMsg = err.message;
    } else if (err instanceof Error) {
      errorMsg = err.message;
    }
    
    return fallbackAiResponse(query, errorMsg);
  }
}

function fallbackAiResponse(query: string, errorMsg: string) {
  return {
    zusammenfassung: `⚠️ KI-Dienst nicht verfügbar: ${errorMsg}`,
    kernzahlen: [],
    auffaelligkeiten: [
      "Es konnten keine Live-Daten oder Analysen abgerufen werden, da die KI-Anbindung nicht konfiguriert ist oder ein Fehler vorliegt."
    ],
    empfehlungen: [
      "Bitte hinterlege einen gültigen Google Gemini API-Key (GEMINI_API_KEY) im System."
    ]
  };
}
