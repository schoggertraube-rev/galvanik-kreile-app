"use server";

import { checkAppAuth } from "@/lib/server/authHelper";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function extractCustomerDataFromFreetext(text: string) {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return { ok: false, error: auth.message };

  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: "Kein Gemini API Key konfiguriert." };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_TEXT || "gemini-2.5-flash" });

    const prompt = `
Extrahiere strukturierte Kundendaten aus folgendem Freitext einer Notiz.
Antworte AUSSCHLIESSLICH als gültiges JSON im folgenden Format:
{
  "type": "privat" | "business" | "lead",
  "company": "Firmenname falls erkennbar, sonst null",
  "contactName": "Vor- und Nachname falls erkennbar, sonst null",
  "email": "Email falls erkennbar, sonst null",
  "phone": "Telefon falls erkennbar, sonst null",
  "street": "Straße und Hausnummer falls erkennbar, sonst null",
  "zipCode": "PLZ falls erkennbar, sonst null",
  "city": "Stadt falls erkennbar, sonst null",
  "notes": "Relevante zusätzliche Informationen, die sich auf den Kunden beziehen, sonst null"
}

Freitext: "${text}"
`;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    
    // Bereinige Markdown Code Blocks falls Gemini sie mitschickt
    const cleanedJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanedJson);

    return { ok: true, data };
  } catch (error: any) {
    console.error("Failed to extract data:", error);
    return { ok: false, error: "Fehler bei der KI-Auswertung: " + error.message };
  }
}

export async function enrichCustomerData(company: string, city: string) {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return { ok: false, error: auth.message };

  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: "Kein Gemini API Key konfiguriert." };
  }

  if (!company && !city) {
      return { ok: false, error: "Mindestens Firma oder Stadt muss angegeben werden." };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_TEXT || "gemini-2.5-flash" });

    const prompt = `
Führe eine Web-Recherche für folgendes Unternehmen durch und liefere die Kontaktdaten.
Unternehmen: "${company}"
Ort/Stadt: "${city}"

Antworte AUSSCHLIESSLICH als gültiges JSON im folgenden Format:
{
  "street": "Straße und Hausnummer, falls gefunden, sonst null",
  "zipCode": "PLZ falls gefunden, sonst null",
  "city": "Stadt falls gefunden, sonst null",
  "website": "Website falls gefunden, sonst null",
  "phone": "Öffentliche Telefonnummer falls gefunden, sonst null",
  "email": "Öffentliche Email falls gefunden, sonst null",
  "confidence": "hoch" | "mittel" | "niedrig"
}
`;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    
    const cleanedJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanedJson);

    return { ok: true, data };
  } catch (error: any) {
    console.error("Failed to enrich data:", error);
    return { ok: false, error: "Fehler bei der KI-Recherche: " + error.message };
  }
}
