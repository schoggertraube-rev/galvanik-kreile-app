"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { MockCustomer, MockOrder } from "@/lib/mockData";
const INITIAL_CUSTOMERS: MockCustomer[] = [];
const INITIAL_ORDERS: MockOrder[] = [];
import { analyzePhoneNoteWithAI, AIAnalysisInput, PhoneNoteCategory } from "@/app/actions/analyzePhoneNote";
import { performLocalAnalysis, LocalAnalysisResult } from "@/lib/localPhoneAnalysis";

/* ===== Types ===== */
export interface AnalysisField {
  label: string;
  value: string;
  confidence: number;
  type: "kunde" | "auftrag" | "thema" | "material" | "zeit" | "zahlung";
}

export type PhoneNoteToOrderDraft = {
  source: "phone_note";
  phoneNoteId?: string;
  rawText: string;
  customerId?: string;
  customerName?: string;
  customerCandidateIds?: string[];
  title?: string;
  itemName?: string;
  material?: string;
  surfaceRequested?: string;
  requestedDate?: string;
  notes?: string;
  relatedEmailIds?: string[];
  relatedAttachmentIds?: string[];
  suggestedAction?: "create_order";
};

export type PhoneNoteToCustomerDraft = {
  source: "phone_note";
  rawText: string;
  proposedName?: string;
  phone?: string;
  email?: string;
  city?: string;
  notes?: string;
  intendedFirstOrder?: {
    itemName?: string;
    surfaceRequested?: string;
    requestedDate?: string;
  };
};

type LivePhoneActionPayload =
  | PhoneNoteToOrderDraft
  | PhoneNoteToCustomerDraft
  | { text: string }
  | { customerId?: string }
  | { orderId?: string }
  | { date: NonNullable<LocalAnalysisResult["matchedTime"]> };

export type LivePhoneActionType =
  | "create_order"
  | "create_customer"
  | "prepare_quote"
  | "review_email"
  | "review_attachments"
  | "review_photos"
  | "open_customer"
  | "open_order"
  | "check_payment"
  | "schedule_pickup"
  | "schedule_dropoff"
  | "clarify_customer"
  | "clarify_order"
  | "create_calendar_event"
  | "update_order_pickup"
  | "add_customer_note"
  | "create_complaint";

type LivePhoneActionPayloadFor<T extends LivePhoneActionType> =
  T extends "create_order" ? PhoneNoteToOrderDraft
  : T extends "create_customer" ? PhoneNoteToCustomerDraft
  : T extends "prepare_quote" ? { text: string }
  : T extends "review_email" | "add_customer_note" ? { customerId?: string }
  : T extends "create_complaint" | "update_order_pickup" ? { orderId?: string }
  : T extends "create_calendar_event" ? { date: NonNullable<LocalAnalysisResult["matchedTime"]> }
  : LivePhoneActionPayload;

export type LivePhoneAction<T extends LivePhoneActionType = LivePhoneActionType> =
  T extends LivePhoneActionType ? {
    id: string;
    type: T;
    title: string;
    subtitle: string;
    confidence: number;
    priority: "low" | "medium" | "high" | "critical";
    source: "database" | "local" | "ai" | "manual";
    payload: LivePhoneActionPayloadFor<T>;
    status: "suggested" | "selected" | "dismissed";
  } : never;

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
  liveActions: LivePhoneAction[];
  highlights: { word: string; type: "kunde" | "auftrag" | "material" | "thema" | "zeit" | "aktion" }[];
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
    void forceAI;
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

      const liveActions: LivePhoneAction[] = [];
      
      // Intent-based actions (HYBRID AI + LOCAL)
      if (baseResult.intents.wantsNewOrder || aiCategory === "new_order_intake") {
        const orderPayload: PhoneNoteToOrderDraft = {
          source: "phone_note",
          rawText: text,
          customerId: baseResult.matchedCustomer?.id,
          customerName: baseResult.matchedCustomer?.name,
          customerCandidateIds: baseResult.customerCandidates.map(c => c.id),
          material: baseResult.matchedMaterial || undefined,
          surfaceRequested: baseResult.surfaceRequested || undefined,
          requestedDate: baseResult.matchedTime?.label || undefined,
          suggestedAction: "create_order"
        };
        
        liveActions.push({
          id: "create_order", title: "Auftrag anlegen",
          subtitle: `Wareneingang ${baseResult.matchedCustomer?.name ? `für ${baseResult.matchedCustomer.name}` : "vorbereiten"}`,
          type: "create_order",
          confidence: 90, priority: "high", source: "local",
          payload: orderPayload, status: "suggested"
        });
      }
      
      // Neukunde - Strict Logic
      if (baseResult.intents.wantsNewCustomer || aiCategory === "new_customer_request") {
        // Only if no strong customer match
        if (!baseResult.matchedCustomer && (!baseResult.customerCandidates || baseResult.customerCandidates.length === 0 || baseResult.customerCandidates[0].confidence < 80)) {
          const custPayload: PhoneNoteToCustomerDraft = {
            source: "phone_note",
            rawText: text,
            notes: `Aus Telefonnotiz erstellt.\n\nKundenanfrage: ${text}`,
            intendedFirstOrder: {
               surfaceRequested: baseResult.surfaceRequested || undefined,
               requestedDate: baseResult.matchedTime?.label || undefined,
            }
          };
          liveActions.push({
            id: "create_customer", title: "Neuen Kunden vorbereiten",
            subtitle: "Kein sicherer Treffer gefunden.",
            type: "create_customer",
            confidence: 85, priority: "medium", source: "local",
            payload: custPayload, status: "suggested"
          });
        }
      }

      if (baseResult.intents.wantsQuote || aiCategory === "quote_request") {
        liveActions.push({
          id: "quote", title: "KV / Angebot vorbereiten",
          subtitle: "Daten sammeln für Schätzung",
          type: "prepare_quote",
          confidence: 85, priority: "medium", source: "local",
          payload: { text }, status: "suggested"
        });
      }
      
      if (baseResult.intents.hasEmailOrAttachment || ["email_review", "attachment_review", "photo_review", "document_review"].includes(aiCategory || "")) {
         liveActions.push({
            id: "review_email", title: "E-Mail/Bilder prüfen",
            subtitle: "Letzte Mails und Anhänge sichten",
            type: "review_email",
            confidence: 95, priority: "high", source: "local",
            payload: { customerId: baseResult.matchedCustomer?.id }, status: "suggested"
         });
      }

      if (aiCategory === "complaint") {
        liveActions.push({
          id: "complaint", title: "Reklamationsfall anlegen",
          subtitle: `Auftrag ${baseResult.matchedOrder?.orderNumber || "prüfen"} & Qualitätsprüfung`,
          type: "create_complaint",
          confidence: 85, priority: "high", source: "ai",
          payload: { orderId: baseResult.matchedOrder?.id }, status: "suggested"
        });
      }

      // Fact-based actions
      if (baseResult.matchedTime) {
        liveActions.push({
          id: "cal", title: "Kalendereintrag / Frist",
          subtitle: `${baseResult.matchedTime.label} · ${baseResult.matchedTime.intent === 'deadline' ? 'Deadline' : 'Abholung'}`,
          type: "create_calendar_event",
          confidence: 90, priority: "medium", source: "database",
          payload: { date: baseResult.matchedTime }, status: "suggested"
        });
      }
      if (baseResult.matchedOrder && aiCategory !== "complaint") {
        liveActions.push({
          id: "ord", title: `Auftrag ${baseResult.matchedOrder.orderNumber}`,
          subtitle: `Aktualisierung/Notiz zum Auftrag`,
          type: "update_order_pickup",
          confidence: 90, priority: "low", source: "database",
          payload: { orderId: baseResult.matchedOrder.id }, status: "suggested"
        });
      }
      if (baseResult.matchedCustomer) {
        liveActions.push({
          id: "cust", title: "Kundenkarte: Notiz",
          subtitle: `${baseResult.matchedCustomer.name} · Anruf hinterlegen`,
          type: "add_customer_note",
          confidence: 95, priority: "low", source: "database",
          payload: { customerId: baseResult.matchedCustomer.id }, status: "suggested"
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
        liveActions,
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
              surfaceRequested: aiData.surfaceRequested || localResult.surfaceRequested,
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
