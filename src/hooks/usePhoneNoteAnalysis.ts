"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { INITIAL_CUSTOMERS, INITIAL_ORDERS, MockCustomer, MockOrder } from "@/lib/mockData";
import { analyzePhoneNoteWithAI } from "@/app/actions/analyzePhoneNote";

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const analyze = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (!text || text.trim().length < 3) {
      setResult(null);
      setIsAnalyzing(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsAnalyzing(true);
      try {
        const aiData = await analyzePhoneNoteWithAI(text);
        if (!aiData) {
          setResult(null);
          setIsAnalyzing(false);
          return;
        }

        // 1. Customer matching
        let matchedCustomer: MockCustomer | null = null;
        if (aiData.customerName) {
          matchedCustomer = INITIAL_CUSTOMERS.find(c => c.name.toLowerCase().includes(aiData.customerName.toLowerCase())) || null;
        }

        // 2. Order matching
        let matchedOrder: MockOrder | null = null;
        if (aiData.orderNumber) {
          matchedOrder = INITIAL_ORDERS.find(o => o.orderNumber.toUpperCase() === aiData.orderNumber.toUpperCase()) || null;
        }
        
        let allCustomerOrders: MockOrder[] = [];
        if (matchedCustomer) {
          allCustomerOrders = INITIAL_ORDERS.filter(o => o.customerId === matchedCustomer!.id);
          if (!matchedOrder && allCustomerOrders.length > 0) {
            const activeOrders = allCustomerOrders.filter(o => o.status !== "done");
            if (activeOrders.length === 1) matchedOrder = activeOrders[0];
          }
        }

        // 8. Build fields
        const fields: AnalysisField[] = [];
        if (matchedCustomer) fields.push({ label: "Kunde", value: matchedCustomer.name, confidence: 96, type: "kunde" });
        if (matchedOrder) fields.push({ label: "Auftrag", value: matchedOrder.orderNumber, confidence: 95, type: "auftrag" });
        if (aiData.theme) fields.push({ label: "Thema", value: aiData.theme, confidence: 92, type: "thema" });
        if (aiData.material) fields.push({ label: "Material", value: aiData.material, confidence: 88, type: "material" });
        if (aiData.timePhrase) fields.push({ label: "Wunschtermin", value: aiData.timePhrase, confidence: 85, type: "zeit" });
        if (aiData.payment) fields.push({ label: "Zahlung", value: aiData.payment, confidence: 85, type: "zahlung" });

        // 9. Proposed actions
        const proposedActions: ProposedAction[] = [];
        if (aiData.timePhrase) {
          proposedActions.push({
            id: "cal",
            title: "Kalendereintrag",
            subtitle: `${aiData.timePhrase} · Abholung ${matchedCustomer?.name || "Kunde"}`,
            type: "auto",
            actionType: "create_calendar_event"
          });
        }
        if (matchedOrder) {
          proposedActions.push({
            id: "ord",
            title: `Auftrag ${matchedOrder.orderNumber}`,
            subtitle: `${aiData.timePhrase ? "Abholtermin" : "Aktualisierung"}${aiData.payment ? " + Zahlungsart " + aiData.payment.toLowerCase() : ""}`,
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
        if (aiData.theme === "Zahlungsfrage" || aiData.payment) {
          proposedActions.push({
            id: "pay",
            title: "Offene Rechnung 248 €",
            subtitle: "Bei Abholung erwähnen — kein Mahnlauf nötig",
            type: "review",
            actionType: "create_invoice_reminder"
          });
        }

        setResult({
          matchedCustomer,
          matchedOrder,
          allCustomerOrders,
          matchedMaterial: aiData.material || null,
          matchedTheme: aiData.theme || null,
          matchedTime: aiData.timePhrase ? { label: aiData.timePhrase, dayOfWeek: 1, isFree: true } : null,
          matchedPayment: aiData.payment || null,
          matchedKeywords: [],
          suggestedAnswer: aiData.suggestedAnswer || "Guten Tag, wie kann ich helfen?",
          overallConfidence: aiData.overallConfidence || 80,
          fields,
          proposedActions,
          highlights: aiData.highlights || [],
        });
      } catch (error) {
        console.error("Analysis error:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }, 1000); // 1s debounce to avoid spamming the AI while speaking
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return { result, analyze, isAnalyzing };
}
