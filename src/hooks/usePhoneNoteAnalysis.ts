"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { INITIAL_CUSTOMERS, INITIAL_ORDERS, MockCustomer, MockOrder } from "@/lib/mockData";

/* ===== Types ===== */
export interface AnalysisField {
  label: string;
  value: string;
  confidence: number;
  type: "kunde" | "auftrag" | "thema" | "material" | "zeit" | "zahlung";
}

export interface ProposedAction {
  id: string;
  title: string;
  subtitle: string;
  type: "auto" | "review";
  actionType: string;
}

export interface AnalysisResult {
  matchedCustomer: MockCustomer | null;
  matchedOrder: MockOrder | null;
  allCustomerOrders: MockOrder[];
  matchedMaterial: string | null;
  matchedTheme: string | null;
  matchedTime: { label: string; dayOfWeek: number; isFree: boolean } | null;
  matchedPayment: string | null;
  matchedKeywords: string[];
  suggestedAnswer: string;
  overallConfidence: number;
  fields: AnalysisField[];
  proposedActions: ProposedAction[];
  highlights: { word: string; type: "kunde" | "auftrag" | "material" | "thema" | "zeit" }[];
}

/* ===== Time Phrase Parser ===== */
function parseTimePhrase(text: string): { label: string; dayOfWeek: number; isFree: boolean } | null {
  const lower = text.toLowerCase();
  const now = new Date();
  const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  const timePatterns: [RegExp, number][] = [
    [/\bmorgen\b/, 1],
    [/\bübermorgen\b/, 2],
    [/\bheute\b/, 0],
    [/\bmontag\b/, (() => { const d = (1 - now.getDay() + 7) % 7 || 7; return d; })()],
    [/\bdienstag\b/, (() => { const d = (2 - now.getDay() + 7) % 7 || 7; return d; })()],
    [/\bmittwoch\b/, (() => { const d = (3 - now.getDay() + 7) % 7 || 7; return d; })()],
    [/\bdonnerstag\b/, (() => { const d = (4 - now.getDay() + 7) % 7 || 7; return d; })()],
    [/\bfreitag\b/, (() => { const d = (5 - now.getDay() + 7) % 7 || 7; return d; })()],
  ];

  // Also match time like "10 Uhr", "10:00"
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?/);
  const timeStr = timeMatch ? `${timeMatch[1]}:${timeMatch[2] || "00"}` : "10:00";

  for (const [pattern, daysAhead] of timePatterns) {
    if (pattern.test(lower)) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + daysAhead);
      const dow = targetDate.getDay();
      const isFree = dow >= 1 && dow <= 5; // Mo-Fr = frei
      const dayLabel = `${weekdays[dow]} ${targetDate.getDate()}.${targetDate.getMonth() + 1}. · ${timeStr}`;
      return { label: dayLabel, dayOfWeek: dow, isFree };
    }
  }
  return null;
}

/* ===== Payment Detection ===== */
function detectPayment(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("bar")) return "Bar bei Abholung";
  if (lower.includes("rechnung")) return "Auf Rechnung";
  if (lower.includes("überweisung")) return "Überweisung";
  if (lower.includes("ec") || lower.includes("karte")) return "EC-Karte";
  return null;
}

/* ===== Theme Detection ===== */
function detectTheme(text: string, keywords: string[]): string | null {
  if (keywords.includes("Termin/Logistik")) return "Abholtermin";
  if (keywords.includes("Reklamation")) return "Reklamation";
  if (keywords.includes("Buchhaltung/Zahlung")) return "Zahlungsfrage";
  if (keywords.includes("Angebot")) return "Angebotsanfrage";
  const lower = text.toLowerCase();
  if (lower.includes("status") || lower.includes("stand")) return "Statusanfrage";
  if (lower.includes("preis") || lower.includes("kosten")) return "Preisanfrage";
  return null;
}

/* ===== Main Hook ===== */
export function usePhoneNoteAnalysis() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const analyze = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (!text || text.trim().length < 3) {
      setResult(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const lower = text.toLowerCase();
      const highlights: AnalysisResult["highlights"] = [];

      // 1. Customer matching
      let matchedCustomer: MockCustomer | null = null;
      for (const cust of INITIAL_CUSTOMERS) {
        if (cust.name && lower.includes(cust.name.toLowerCase())) {
          matchedCustomer = cust;
          highlights.push({ word: cust.name, type: "kunde" });
          break;
        }
      }

      // 2. Order matching (by ID pattern A-2026-XXXX)
      let matchedOrder: MockOrder | null = null;
      const orderMatch = text.match(/A-\d{4}-\d{4}/i);
      if (orderMatch) {
        const ordNum = orderMatch[0].toUpperCase();
        matchedOrder = INITIAL_ORDERS.find(o => o.orderNumber === ordNum) || null;
        highlights.push({ word: ordNum, type: "auftrag" });
      }
      
      // If customer found but no order, get customer's orders
      let allCustomerOrders: MockOrder[] = [];
      if (matchedCustomer) {
        allCustomerOrders = INITIAL_ORDERS.filter(o => o.customerId === matchedCustomer!.id);
        if (!matchedOrder && allCustomerOrders.length > 0) {
          // Pick best match by score
          const activeOrders = allCustomerOrders.filter(o => o.status !== "done");
          if (activeOrders.length === 1) matchedOrder = activeOrders[0];
        }
      }

      // 3. Material
      const materials = ["zink", "chrom", "nickel", "messing", "kupfer", "gold", "silber", "eloxal", "alu", "stahl"];
      const finishes = ["vernickeln", "verchromen", "verzinken", "vergolden", "versilbern", "brünieren", "eloxieren"];
      const matchedMaterial = materials.find(m => lower.includes(m)) || finishes.find(f => lower.includes(f)) || null;
      if (matchedMaterial) highlights.push({ word: matchedMaterial, type: "material" });

      // 4. Keywords
      const matchedKeywords: string[] = [];
      if (/reklamation|beschädigt|kratzer|kaputt|defekt|mangel/i.test(lower)) matchedKeywords.push("Reklamation");
      if (/rechnung|zahlung|bezahlen|überweisung|bar\b|offen.*€|€.*offen/i.test(lower)) matchedKeywords.push("Buchhaltung/Zahlung");
      if (/abhol|versand|spedition|lieferung|fertig|termin|morgen|übermorgen/i.test(lower)) matchedKeywords.push("Termin/Logistik");
      if (/angebot|preis|kosten/i.test(lower)) matchedKeywords.push("Angebot");

      // 5. Time
      const matchedTime = parseTimePhrase(text);
      // Add time-related words to highlights
      const timeWords = ["morgen", "übermorgen", "heute", "montag", "dienstag", "mittwoch", "donnerstag", "freitag"];
      for (const tw of timeWords) {
        if (lower.includes(tw)) highlights.push({ word: tw, type: "zeit" });
      }

      // 6. Payment
      const matchedPayment = detectPayment(text);

      // 7. Theme
      const matchedTheme = detectTheme(text, matchedKeywords);
      if (matchedTheme) {
        const themeWords = ["abhol", "reklamation", "rechnung", "zahlung", "angebot"];
        for (const tw of themeWords) {
          if (lower.includes(tw) && !highlights.some(h => h.word === tw)) {
            highlights.push({ word: tw, type: "thema" });
          }
        }
      }

      // 8. Build fields
      const fields: AnalysisField[] = [];
      if (matchedCustomer) fields.push({ label: "Kunde", value: matchedCustomer.name, confidence: 96, type: "kunde" });
      if (matchedOrder) fields.push({ label: "Auftrag", value: matchedOrder.orderNumber, confidence: orderMatch ? 100 : 75, type: "auftrag" });
      if (matchedTheme) fields.push({ label: "Thema", value: matchedTheme, confidence: 92, type: "thema" });
      if (matchedMaterial) {
        const cap = matchedMaterial.charAt(0).toUpperCase() + matchedMaterial.slice(1);
        fields.push({ label: "Material", value: cap, confidence: 88, type: "material" });
      }
      if (matchedTime) fields.push({ label: "Wunschtermin", value: matchedTime.label, confidence: matchedTime.isFree ? 90 : 70, type: "zeit" });
      if (matchedPayment) fields.push({ label: "Zahlung", value: matchedPayment, confidence: 85, type: "zahlung" });

      // 9. Proposed actions
      const proposedActions: ProposedAction[] = [];
      if (matchedTime) {
        proposedActions.push({
          id: "cal",
          title: "Kalendereintrag",
          subtitle: `${matchedTime.label} · Abholung ${matchedCustomer?.name || "Kunde"}`,
          type: "auto",
          actionType: "create_calendar_event"
        });
      }
      if (matchedOrder) {
        proposedActions.push({
          id: "ord",
          title: `Auftrag ${matchedOrder.orderNumber}`,
          subtitle: `${matchedTime ? "Abholtermin" : "Aktualisierung"}${matchedPayment ? " + Zahlungsart " + matchedPayment.toLowerCase() : ""}`,
          type: "auto",
          actionType: "update_order_pickup"
        });
      }
      if (matchedCustomer) {
        proposedActions.push({
          id: "cust",
          title: "Kundenkarte: Notiz",
          subtitle: `${matchedCustomer.name} · Anruf ${new Date().toLocaleDateString("de-DE", { day: "numeric", month: "numeric" })} ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`,
          type: "auto",
          actionType: "add_customer_note"
        });
      }
      if (matchedKeywords.includes("Buchhaltung/Zahlung") || matchedPayment) {
        proposedActions.push({
          id: "pay",
          title: "Offene Rechnung 248 €",
          subtitle: "Bei Abholung erwähnen — kein Mahnlauf nötig",
          type: "review",
          actionType: "create_invoice_reminder"
        });
      }

      // 10. Suggested answer
      let suggestedAnswer = "";
      if (matchedOrder && matchedCustomer) {
        const statusInfo = matchedOrder.statusText || matchedOrder.status;
        suggestedAnswer = `Guten Tag ${matchedCustomer.name}, Ihr Auftrag ${matchedOrder.orderNumber} (${matchedOrder.task}) hat den Status „${statusInfo}".`;
        if (matchedTime?.isFree) suggestedAnswer += ` Der gewünschte Termin ${matchedTime.label} ist frei.`;
        if (matchedPayment) suggestedAnswer += ` Zahlungsart: ${matchedPayment}.`;
      } else if (matchedCustomer) {
        suggestedAnswer = `Guten Tag ${matchedCustomer.name}, ich habe Ihre Kundenakte aufgerufen. `;
        if (matchedTheme) suggestedAnswer += `Gern kümmere ich mich um Ihr Anliegen zum Thema ${matchedTheme}.`;
        else suggestedAnswer += `Wie kann ich Ihnen weiterhelfen?`;
      } else if (matchedTheme || matchedMaterial || matchedTime) {
        suggestedAnswer = `Ich habe Ihr Anliegen notiert`;
        if (matchedTheme) suggestedAnswer += ` (Thema: ${matchedTheme})`;
        if (matchedMaterial) suggestedAnswer += ` zu ${matchedMaterial}`;
        suggestedAnswer += `. Um welchen Auftrag oder Kunden handelt es sich genau?`;
      } else if (text.length > 15) {
        suggestedAnswer = `Ich höre zu... (noch nicht genug Kontext für einen konkreten Lösungsvorschlag erkannt)`;
      } else {
        suggestedAnswer = `„Sobald genug erkannt ist, schlage ich hier eine Antwort vor, die du direkt vorlesen kannst."`;
      }

      // 11. Overall confidence
      const confidences = fields.map(f => f.confidence);
      const overallConfidence = confidences.length > 0
        ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : 0;

      setResult({
        matchedCustomer,
        matchedOrder,
        allCustomerOrders,
        matchedMaterial,
        matchedTheme,
        matchedTime,
        matchedPayment,
        matchedKeywords,
        suggestedAnswer,
        overallConfidence,
        fields,
        proposedActions,
        highlights,
      });
    }, 300);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return { result, analyze };
}
