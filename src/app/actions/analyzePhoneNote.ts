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
    // FALLBACK: Lokale Regex-Analyse
    const lower = text.toLowerCase();
    
    // Customer
    const matchedCustomer = INITIAL_CUSTOMERS.find(c => c.name && lower.includes(c.name.toLowerCase()));
    
    // Order
    const orderMatch = text.match(/A-\d{4}-\d{4}/i);
    const orderNumber = orderMatch ? orderMatch[0].toUpperCase() : null;

    // Material
    const materials = ["zink", "chrom", "nickel", "messing", "kupfer", "gold", "silber", "eloxal", "alu", "stahl"];
    const finishes = ["vernickeln", "verchromen", "verzinken", "vergolden", "versilbern", "brünieren", "eloxieren"];
    const material = materials.find(m => lower.includes(m)) || finishes.find(f => lower.includes(f)) || null;

    // Keywords / Theme
    const matchedKeywords: string[] = [];
    if (/reklamation|beschädigt|kratzer|kaputt|defekt|mangel/i.test(lower)) matchedKeywords.push("Reklamation");
    if (/rechnung|zahlung|bezahlen|überweisung|bar\b|offen.*€|€.*offen/i.test(lower)) matchedKeywords.push("Buchhaltung/Zahlung");
    if (/abhol|versand|spedition|lieferung|fertig|termin|morgen|übermorgen/i.test(lower)) matchedKeywords.push("Termin/Logistik");
    if (/angebot|preis|kosten/i.test(lower)) matchedKeywords.push("Angebot");

    let theme = null;
    if (matchedKeywords.includes("Termin/Logistik")) theme = "Abholtermin";
    else if (matchedKeywords.includes("Reklamation")) theme = "Reklamation";
    else if (matchedKeywords.includes("Buchhaltung/Zahlung")) theme = "Zahlungsfrage";
    else if (matchedKeywords.includes("Angebot")) theme = "Angebotsanfrage";
    else if (lower.includes("status") || lower.includes("stand")) theme = "Statusanfrage";
    else if (lower.includes("preis") || lower.includes("kosten")) theme = "Preisanfrage";

    // Payment
    let payment = null;
    if (lower.includes("bar")) payment = "Bar bei Abholung";
    else if (lower.includes("rechnung")) payment = "Auf Rechnung";
    else if (lower.includes("überweisung")) payment = "Überweisung";
    else if (lower.includes("ec") || lower.includes("karte")) payment = "EC-Karte";

    // Time Phrase Simple (Fallback just looks for words)
    let timePhrase = null;
    const timeWords = ["morgen", "übermorgen", "heute", "montag", "dienstag", "mittwoch", "donnerstag", "freitag"];
    const foundTime = timeWords.find(tw => lower.includes(tw));
    if (foundTime) timePhrase = foundTime.charAt(0).toUpperCase() + foundTime.slice(1);

    // Answer
    let suggestedAnswer = "";
    if (orderNumber && matchedCustomer) {
      suggestedAnswer = `Guten Tag ${matchedCustomer.name}, Ihr Auftrag ${orderNumber} ist in Bearbeitung.`;
    } else if (matchedCustomer) {
      suggestedAnswer = `Guten Tag ${matchedCustomer.name}, ich habe Ihre Kundenakte aufgerufen. Wie kann ich Ihnen helfen?`;
    } else {
      suggestedAnswer = `Ich höre zu... (Lokales Fallback - Kein API Key gefunden)`;
    }

    const highlights: any[] = [];
    if (matchedCustomer) highlights.push({ word: matchedCustomer.name, type: "kunde" });
    if (orderNumber) highlights.push({ word: orderNumber, type: "auftrag" });
    if (material) highlights.push({ word: material, type: "material" });
    if (timePhrase) highlights.push({ word: foundTime, type: "zeit" });

    return {
      customerName: matchedCustomer?.name || null,
      orderNumber,
      material,
      theme,
      timePhrase,
      payment,
      suggestedAnswer,
      overallConfidence: 75,
      highlights
    };
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

Generiere einen sinnvollen Antwort-Vorschlag, der auf den erkannten Daten basiert.
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
