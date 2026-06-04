"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { INITIAL_CUSTOMERS, INITIAL_ORDERS, MockCustomer, MockOrder } from "@/lib/mockData";
import { analyzePhoneNoteWithAI, AIAnalysisInput, PhoneNoteCategory } from "@/app/actions/analyzePhoneNote";
import { performLocalAnalysis, LocalAnalysisResult } from "@/lib/localPhoneAnalysis";

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
  // Execution Context
  usedAI: boolean;
  aiReason?: string;
}

/* ===== Main Hook ===== */
export function usePhoneNoteAnalysis() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const analyze = useCallback((text: string, overrideCustomerId?: string, overrideOrderIds?: string[], forceAI: boolean = false) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (!text || text.trim().length < 3) {
      setResult(null);
      setIsAnalyzing(false);
      return;
    }

    // 1. FAST PATH: Synchronous Local Analysis (DATABASE FIRST)
    const localResult = performLocalAnalysis(text);
    
    // Apply Overrides to local result
    if (overrideCustomerId) {
      localResult.matchedCustomer = INITIAL_CUSTOMERS.find(c => c.id === overrideCustomerId) || null;
      localResult.customerCandidates = [];
    }
    if (overrideOrderIds && overrideOrderIds.length > 0) {
      localResult.matchedOrder = INITIAL_ORDERS.find(o => o.id === overrideOrderIds[0]) || null;
    }

    const needsCustomerSelection = !localResult.matchedCustomer && localResult.customerCandidates.length > 1;
    const needsOrderSelection = !localResult.matchedOrder && localResult.orderCandidates.length > 1 && !overrideOrderIds;
    const allCustomerOrders = localResult.matchedCustomer ? INITIAL_ORDERS.filter(o => o.customerId === localResult.matchedCustomer!.id) : [];

    const buildFieldsAndActions = (baseResult: LocalAnalysisResult, aiCategory?: PhoneNoteCategory, isAI: boolean = false): AnalysisResult => {
      const fields: AnalysisField[] = [];
      if (baseResult.matchedCustomer) fields.push({ label: "Kunde", value: baseResult.matchedCustomer.name, confidence: 96, type: "kunde" });
      else if (needsCustomerSelection) fields.push({ label: "Kunde", value: `${baseResult.customerCandidates.length} mögliche Treffer`, confidence: 50, type: "kunde" });
      
      if (baseResult.matchedOrder) fields.push({ label: "Auftrag", value: baseResult.matchedOrder.orderNumber, confidence: 95, type: "auftrag" });
      else if (needsOrderSelection) fields.push({ label: "Auftrag", value: `${baseResult.orderCandidates.length} offene Aufträge`, confidence: 50, type: "auftrag" });
      
      const displayTheme = aiCategory || baseResult.matchedTheme;
      if (displayTheme) fields.push({ label: "Thema", value: displayTheme, confidence: 92, type: "thema" });
      if (baseResult.matchedMaterial) fields.push({ label: "Material", value: baseResult.matchedMaterial, confidence: 88, type: "material" });
      if (baseResult.matchedTime) fields.push({ label: "Wunschtermin", value: baseResult.matchedTime.label, confidence: baseResult.matchedTime.isFree ? 90 : 70, type: "zeit" });
      if (baseResult.matchedPayment) fields.push({ label: "Zahlung", value: baseResult.matchedPayment, confidence: 85, type: "zahlung" });

      const proposedActions: ProposedAction[] = [];
      
      // Intent-based actions (HYBRID AI additions)
      if (aiCategory === "new_order_intake") {
        proposedActions.push({
          id: "intake", title: "Neuer Wareneingang",
          subtitle: `Erfassung für ${baseResult.matchedCustomer?.name || "Kunde"} vorbereiten`,
          type: "auto", actionType: "create_intake"
        });
      } else if (aiCategory === "quote_request") {
        proposedActions.push({
          id: "quote", title: "Angebot / KV vorbereiten",
          subtitle: "Material klären, Foto anfordern",
          type: "auto", actionType: "create_quote"
        });
      } else if (aiCategory === "complaint") {
        proposedActions.push({
          id: "complaint", title: "Reklamationsfall anlegen",
          subtitle: `Auftrag ${baseResult.matchedOrder?.orderNumber || "prüfen"} & Qualitätsprüfung`,
          type: "review", actionType: "create_complaint"
        });
      }

      // Fact-based actions (LOCAL DATABASE additions)
      if (baseResult.matchedTime) {
        proposedActions.push({
          id: "cal", title: "Kalendereintrag",
          subtitle: `${baseResult.matchedTime.label} · Abholung ${baseResult.matchedCustomer?.name || "Kunde"}`,
          type: "auto", actionType: "create_calendar_event"
        });
      }
      if (baseResult.matchedOrder && aiCategory !== "complaint") {
        proposedActions.push({
          id: "ord", title: `Auftrag ${baseResult.matchedOrder.orderNumber}`,
          subtitle: `${baseResult.matchedTime ? "Abholtermin" : "Aktualisierung"}${baseResult.matchedPayment ? " + Zahlungsart " + baseResult.matchedPayment.toLowerCase() : ""}`,
          type: "auto", actionType: "update_order_pickup"
        });
      }
      if (baseResult.matchedCustomer) {
        proposedActions.push({
          id: "cust", title: "Kundenkarte: Notiz",
          subtitle: `${baseResult.matchedCustomer.name} · Anruf ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`,
          type: "auto", actionType: "add_customer_note"
        });
      }

      return {
        matchedCustomer: baseResult.matchedCustomer,
        matchedOrder: baseResult.matchedOrder,
        allCustomerOrders,
        matchedMaterial: baseResult.matchedMaterial,
        matchedTheme: displayTheme,
        matchedTime: baseResult.matchedTime,
        matchedPayment: baseResult.matchedPayment,
        matchedKeywords: [],
        suggestedAnswer: baseResult.suggestedAnswer,
        overallConfidence: baseResult.overallConfidence,
        fields,
        proposedActions,
        highlights: baseResult.highlights || [],
        customerCandidates: baseResult.customerCandidates,
        needsCustomerSelection,
        orderCandidates: baseResult.orderCandidates,
        needsOrderSelection,
        usedAI: isAI,
        aiReason: baseResult.aiReason
      };
    };

    // Immediatley set local result so UI responds instantly
    setResult(buildFieldsAndActions(localResult));

    // 2. HYBRID AI ESCALATION PATH: Debounced AI call to formulate intent/answer based on local facts
    debounceRef.current = setTimeout(async () => {
      setIsAnalyzing(true);
      try {
        const payload: AIAnalysisInput = {
          text,
          knownFacts: {
            customerCandidates: localResult.customerCandidates.slice(0, 3).map(c => c.name),
            orderCandidates: localResult.orderCandidates.slice(0, 3).map(o => o.orderNumber),
            selectedCustomer: localResult.matchedCustomer?.name || null,
            selectedOrders: localResult.matchedOrder ? [localResult.matchedOrder.orderNumber] : [],
            detectedDate: localResult.matchedTime?.label || null,
            paymentKnown: localResult.matchedPayment || null
          }
        };

        const aiData = await analyzePhoneNoteWithAI(payload);
        if (aiData) {
          // Merge AI insights with local strict data. DB matches (customer/order overrides) always win over AI.
          const mergedResult = {
              ...localResult,
              matchedTheme: aiData.category || localResult.matchedTheme,
              matchedMaterial: aiData.material || localResult.matchedMaterial,
              suggestedAnswer: aiData.suggestedAnswer || localResult.suggestedAnswer,
              overallConfidence: aiData.overallConfidence || localResult.overallConfidence,
              aiReason: "Hybrid AI Analyse (Absicht & Formulierung)"
          };
          setResult(buildFieldsAndActions(mergedResult, aiData.category, true));
        }
      } catch (error) {
        console.error("AI Analysis error:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }, 800); // Small debounce for AI to save tokens while typing

  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return { result, analyze, isAnalyzing };
}
