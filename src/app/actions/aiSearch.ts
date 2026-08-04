"use server";

import { extractZeitraum, buildDataContext } from "@/lib/search/aiAggregation";
import { generateAiResponse, GeminiConfigError, GeminiQuotaError } from "@/lib/ai/geminiClient";

export type GlobalAiMetric = {
  label: string;
  wert: string;
  trend: string;
  delta: string;
};

export type GlobalAiResponse = {
  zusammenfassung: string;
  kernzahlen: GlobalAiMetric[];
  auffaelligkeiten: string[];
  empfehlungen: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((entry): entry is string => typeof entry === "string");
}

function parseMetric(value: unknown): GlobalAiMetric | null {
  if (!isRecord(value)) return null;

  const { label, wert, trend, delta } = value;
  if (typeof label !== "string" || typeof wert !== "string" || typeof trend !== "string" || typeof delta !== "string") {
    return null;
  }

  return { label, wert, trend, delta };
}

function parseGlobalAiResponse(value: unknown): GlobalAiResponse {
  if (!isRecord(value) || typeof value.zusammenfassung !== "string") {
    throw new Error("Ungültige Antwort des KI-Dienstes");
  }

  const kernzahlen = Array.isArray(value.kernzahlen)
    ? value.kernzahlen.map(parseMetric).filter((metric): metric is GlobalAiMetric => metric !== null)
    : [];

  return {
    zusammenfassung: value.zusammenfassung,
    kernzahlen,
    auffaelligkeiten: stringArray(value.auffaelligkeiten),
    empfehlungen: stringArray(value.empfehlungen),
  };
}

export async function askGlobalAiAction(query: string): Promise<GlobalAiResponse> {
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
    
    const response: unknown = JSON.parse(text);
    return parseGlobalAiResponse(response);

  } catch (err: unknown) {
    console.error("AI Action Error:", err);
    
    // Use the specific error message if it's one of our custom errors
    let errorMsg = "Unbekannter API-Fehler";
    if (err instanceof GeminiConfigError || err instanceof GeminiQuotaError) {
      errorMsg = err.message;
    } else if (err instanceof Error) {
      errorMsg = err.message;
    }
    
    return fallbackAiResponse(errorMsg);
  }
}

function fallbackAiResponse(errorMsg: string): GlobalAiResponse {
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
