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

export interface CustomerCandidate {
  id: string;
  name: string;
  city: string;
  phone: string;
  openOrdersCount: number;
  confidence: number;
  matchReason: string;
}

export interface OrderCandidate {
  id: string;
  orderNumber: string;
  task: string;
  status: string;
  station: string;
  dueDate: string;
  confidence: number;
  matchReason: string;
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
  // Disambiguation
  customerCandidates: CustomerCandidate[];
  needsCustomerSelection: boolean;
  orderCandidates: OrderCandidate[];
  needsOrderSelection: boolean;
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

  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?/);
  const timeStr = timeMatch ? `${timeMatch[1]}:${timeMatch[2] || "00"}` : "10:00";

  for (const [pattern, daysAhead] of timePatterns) {
    if (pattern.test(lower)) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + daysAhead);
      const dow = targetDate.getDay();
      const isFree = dow >= 1 && dow <= 5;
      const dayLabel = `${weekdays[dow]} ${targetDate.getDate()}.${targetDate.getMonth() + 1}. · ${timeStr}`;
      return { label: dayLabel, dayOfWeek: dow, isFree };
    }
  }
  return null;
}

/* ===== Fuzzy Customer Matching ===== */
function findCustomerCandidates(nameHint: string): CustomerCandidate[] {
  if (!nameHint || nameHint.length < 2) return [];
  const lower = nameHint.toLowerCase();
  
  const candidates: CustomerCandidate[] = [];
  for (const c of INITIAL_CUSTOMERS) {
    const cLower = c.name.toLowerCase();
    // Exact substring match
    if (cLower.includes(lower) || lower.includes(cLower)) {
      const openOrders = INITIAL_ORDERS.filter(o => o.customerId === c.id && o.status !== "done");
      candidates.push({
        id: c.id,
        name: c.name,
        city: c.city || "—",
        phone: c.phone || "—",
        openOrdersCount: openOrders.length,
        confidence: 95,
        matchReason: "Name erkannt",
      });
      continue;
    }
    // Fuzzy: check each word of the hint against each word of customer name
    const hintWords = lower.split(/\s+/).filter(w => w.length >= 3);
    const nameWords = cLower.split(/\s+/);
    for (const hw of hintWords) {
      for (const nw of nameWords) {
        // Simple fuzzy: Levenshtein-like — starts with or close match
        if (nw.startsWith(hw) || hw.startsWith(nw) || (hw.length >= 4 && nw.includes(hw.slice(0, 4)))) {
          const openOrders = INITIAL_ORDERS.filter(o => o.customerId === c.id && o.status !== "done");
          candidates.push({
            id: c.id,
            name: c.name,
            city: c.city || "—",
            phone: c.phone || "—",
            openOrdersCount: openOrders.length,
            confidence: 70,
            matchReason: `Ähnlich: "${hw}" ≈ "${nw}"`,
          });
          break;
        }
      }
      if (candidates.some(cc => cc.id === c.id)) break;
    }
  }
  return candidates;
}

/* ===== Build Order Candidates ===== */
function buildOrderCandidates(customer: MockCustomer): OrderCandidate[] {
  const orders = INITIAL_ORDERS.filter(o => o.customerId === customer.id && o.status !== "done");
  return orders.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    task: o.task,
    status: o.statusText || o.status || "aktiv",
    station: o.station || "—",
    dueDate: o.dueLabel ? `${o.dueLabel} ${o.dueValue}` : o.dueDate,
    confidence: 80,
    matchReason: "Offener Auftrag",
  }));
}

/* ===== Main Hook ===== */
export function usePhoneNoteAnalysis() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const analyze = useCallback((text: string, overrideCustomerId?: string, overrideOrderIds?: string[]) => {
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

        // === Customer disambiguation ===
        let matchedCustomer: MockCustomer | null = null;
        let customerCandidates: CustomerCandidate[] = [];
        let needsCustomerSelection = false;

        if (overrideCustomerId) {
          // User already selected a customer
          matchedCustomer = INITIAL_CUSTOMERS.find(c => c.id === overrideCustomerId) || null;
        } else if (aiData.customerName) {
          customerCandidates = findCustomerCandidates(aiData.customerName);
          if (customerCandidates.length === 1 && customerCandidates[0].confidence >= 90) {
            matchedCustomer = INITIAL_CUSTOMERS.find(c => c.id === customerCandidates[0].id) || null;
          } else if (customerCandidates.length > 1) {
            needsCustomerSelection = true;
          } else if (customerCandidates.length === 1) {
            matchedCustomer = INITIAL_CUSTOMERS.find(c => c.id === customerCandidates[0].id) || null;
          }
        }

        // === Order disambiguation ===
        let matchedOrder: MockOrder | null = null;
        let orderCandidates: OrderCandidate[] = [];
        let needsOrderSelection = false;

        if (aiData.orderNumber) {
          matchedOrder = INITIAL_ORDERS.find(o => o.orderNumber.toUpperCase() === aiData.orderNumber.toUpperCase()) || null;
        }

        if (overrideOrderIds && overrideOrderIds.length === 1) {
          matchedOrder = INITIAL_ORDERS.find(o => o.id === overrideOrderIds[0]) || null;
        }

        let allCustomerOrders: MockOrder[] = [];
        if (matchedCustomer) {
          allCustomerOrders = INITIAL_ORDERS.filter(o => o.customerId === matchedCustomer!.id);
          orderCandidates = buildOrderCandidates(matchedCustomer);
          
          if (!matchedOrder && orderCandidates.length === 1) {
            matchedOrder = INITIAL_ORDERS.find(o => o.id === orderCandidates[0].id) || null;
          } else if (!matchedOrder && orderCandidates.length > 1 && !overrideOrderIds) {
            needsOrderSelection = true;
          }
        }

        // === Local time parse for calendar ===
        const matchedTime = parseTimePhrase(text) || (aiData.timePhrase ? { label: aiData.timePhrase, dayOfWeek: 1, isFree: true } : null);

        // === Build fields ===
        const fields: AnalysisField[] = [];
        if (matchedCustomer) fields.push({ label: "Kunde", value: matchedCustomer.name, confidence: 96, type: "kunde" });
        else if (needsCustomerSelection) fields.push({ label: "Kunde", value: `${customerCandidates.length} mögliche Treffer`, confidence: 50, type: "kunde" });
        if (matchedOrder) fields.push({ label: "Auftrag", value: matchedOrder.orderNumber, confidence: 95, type: "auftrag" });
        else if (needsOrderSelection) fields.push({ label: "Auftrag", value: `${orderCandidates.length} offene Aufträge`, confidence: 50, type: "auftrag" });
        if (aiData.theme) fields.push({ label: "Thema", value: aiData.theme, confidence: 92, type: "thema" });
        if (aiData.material) fields.push({ label: "Material", value: aiData.material, confidence: 88, type: "material" });
        if (matchedTime) fields.push({ label: "Wunschtermin", value: matchedTime.label, confidence: matchedTime.isFree ? 90 : 70, type: "zeit" });
        if (aiData.payment) fields.push({ label: "Zahlung", value: aiData.payment, confidence: 85, type: "zahlung" });

        // === Proposed actions ===
        const proposedActions: ProposedAction[] = [];
        if (matchedTime) {
          proposedActions.push({
            id: "cal", title: "Kalendereintrag",
            subtitle: `${matchedTime.label} · Abholung ${matchedCustomer?.name || "Kunde"}`,
            type: "auto", actionType: "create_calendar_event"
          });
        }
        if (matchedOrder) {
          proposedActions.push({
            id: "ord", title: `Auftrag ${matchedOrder.orderNumber}`,
            subtitle: `${matchedTime ? "Abholtermin" : "Aktualisierung"}${aiData.payment ? " + Zahlungsart " + aiData.payment.toLowerCase() : ""}`,
            type: "auto", actionType: "update_order_pickup"
          });
        }
        if (matchedCustomer) {
          proposedActions.push({
            id: "cust", title: "Kundenkarte: Notiz",
            subtitle: `${matchedCustomer.name} · Anruf ${new Date().toLocaleDateString("de-DE", { day: "numeric", month: "numeric" })} ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`,
            type: "auto", actionType: "add_customer_note"
          });
        }
        if (aiData.theme === "Zahlungsfrage" || aiData.payment) {
          proposedActions.push({
            id: "pay", title: "Offene Rechnung 248 €",
            subtitle: "Bei Abholung erwähnen — kein Mahnlauf nötig",
            type: "review", actionType: "create_invoice_reminder"
          });
        }

        setResult({
          matchedCustomer,
          matchedOrder,
          allCustomerOrders,
          matchedMaterial: aiData.material || null,
          matchedTheme: aiData.theme || null,
          matchedTime,
          matchedPayment: aiData.payment || null,
          matchedKeywords: [],
          suggestedAnswer: aiData.suggestedAnswer || "Guten Tag, wie kann ich helfen?",
          overallConfidence: aiData.overallConfidence || 80,
          fields,
          proposedActions,
          highlights: aiData.highlights || [],
          customerCandidates,
          needsCustomerSelection,
          orderCandidates,
          needsOrderSelection,
        });
      } catch (error) {
        console.error("Analysis error:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return { result, analyze, isAnalyzing };
}
