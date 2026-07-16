"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzePhoneNoteWithAI,
  type PhoneNoteCategory,
} from "@/app/actions/analyzePhoneNote";
import { customersRepository, type Customer } from "@/lib/repositories/customersRepository";
import { ordersRepository, type Order } from "@/lib/repositories/ordersRepository";
import { performLocalAnalysis, type LocalAnalysisResult } from "@/lib/localPhoneAnalysis";

export interface AnalysisField {
  label: string;
  value: string;
  confidence: number;
  type: "kunde" | "auftrag" | "thema" | "material" | "zeit" | "zahlung";
}

export interface LivePhoneAction {
  id: string;
  type: "create_order" | "create_customer";
  title: string;
  subtitle: string;
  confidence: number;
  priority: "low" | "medium" | "high" | "critical";
  source: "local" | "ai";
  payload: Record<string, unknown>;
  status: "suggested";
}

export type PhoneNoteToOrderDraft = {
  source: "phone_note";
  phoneNoteId?: string;
  rawText: string;
  customerId?: string;
  customerName?: string;
  customerCandidateIds?: string[];
  material?: string;
  surfaceRequested?: string;
  requestedDate?: string;
  suggestedAction: "create_order";
};

export type PhoneNoteToCustomerDraft = {
  source: "phone_note";
  rawText: string;
  notes: string;
  intendedFirstOrder?: {
    surfaceRequested?: string;
    requestedDate?: string;
  };
};

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
  matchedCustomer: Customer | null;
  matchedOrder: Order | null;
  allCustomerOrders: Order[];
  matchedMaterial: string | null;
  matchedTheme: string | null;
  matchedTime: LocalAnalysisResult["matchedTime"];
  matchedPayment: string | null;
  suggestedAnswer: string;
  overallConfidence: number;
  fields: AnalysisField[];
  liveActions: LivePhoneAction[];
  highlights: LocalAnalysisResult["highlights"];
  customerCandidates: CustomerCandidate[];
  needsCustomerSelection: boolean;
  orderCandidates: OrderCandidate[];
  needsOrderSelection: boolean;
  usedAI: boolean;
  aiReason?: string;
}

const CLOSED_ORDER_STATUSES = new Set(["done", "completed", "cancelled", "canceled", "shipped"]);

function isOpenOrder(order: Order): boolean {
  return !CLOSED_ORDER_STATUSES.has(order.status.toLowerCase());
}

function orderCandidate(order: Order): OrderCandidate {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    task: order.task?.trim() || order.title?.trim() || "Keine Beschreibung hinterlegt",
    status: order.statusText?.trim() || order.status,
    station: order.station?.trim() || "nicht zugeordnet",
    dueDate: order.dueDate?.trim() || "kein Termin hinterlegt",
    confidence: 100,
    matchReason: "Manuell ausgewählt",
  };
}

function applyOverrides(
  result: LocalAnalysisResult,
  customers: readonly Customer[],
  orders: readonly Order[],
  overrideCustomerId?: string,
  overrideOrderIds?: string[],
): LocalAnalysisResult {
  const overridden = { ...result };
  if (overrideCustomerId) {
    const customer = customers.find((entry) => entry.id === overrideCustomerId) || null;
    overridden.matchedCustomer = customer;
    overridden.customerCandidates = [];
    if (customer && (!overrideOrderIds || overrideOrderIds.length === 0)) {
      const candidates = orders.filter((order) => order.customerId === customer.id && isOpenOrder(order));
      overridden.orderCandidates = candidates.map(orderCandidate);
      overridden.matchedOrder = candidates.length === 1 ? candidates[0] : null;
    }
  }
  if (overrideOrderIds?.length) {
    const order = orders.find((entry) => entry.id === overrideOrderIds[0]) || null;
    overridden.matchedOrder = order;
    overridden.orderCandidates = [];
    if (order) {
      overridden.matchedCustomer = customers.find((customer) => customer.id === order.customerId) || null;
      overridden.customerCandidates = [];
    }
  }
  return overridden;
}

function categoryLabel(category: PhoneNoteCategory): string {
  const labels: Record<PhoneNoteCategory, string> = {
    pickup_request: "Abholanfrage",
    status_question: "Statusanfrage",
    payment_question: "Zahlungsfrage",
    complaint: "Reklamation",
    callback: "Rückruf",
    new_order_intake: "Neuer Auftrag",
    new_customer_request: "Neukundenanfrage",
    quote_request: "Angebotsanfrage",
    email_review: "E-Mail-Hinweis",
    attachment_review: "Anhang-Hinweis",
    photo_review: "Foto-Hinweis",
    document_review: "Dokument-Hinweis",
    appointment_request: "Terminwunsch",
    deadline_request: "Fristanfrage",
    material_or_surface_info: "Material/Oberfläche",
    shipping_question: "Versandfrage",
    technical_question: "Technische Frage",
    general: "Allgemeine Anfrage",
  };
  return labels[category];
}

function buildResult(
  text: string,
  base: LocalAnalysisResult,
  orders: readonly Order[],
  aiCategory?: PhoneNoteCategory,
  usedAI = false,
): AnalysisResult {
  const needsCustomerSelection = !base.matchedCustomer && base.customerCandidates.length > 1;
  const needsOrderSelection = !base.matchedOrder && base.orderCandidates.length > 1;
  const allCustomerOrders = base.matchedCustomer
    ? orders.filter((order) => order.customerId === base.matchedCustomer?.id)
    : [];
  const fields: AnalysisField[] = [];
  if (base.matchedCustomer) fields.push({ label: "Kunde", value: base.matchedCustomer.name, confidence: 96, type: "kunde" });
  else if (needsCustomerSelection) fields.push({ label: "Kunde", value: `${base.customerCandidates.length} mögliche Treffer`, confidence: 50, type: "kunde" });
  if (base.matchedOrder) fields.push({ label: "Auftrag", value: base.matchedOrder.orderNumber, confidence: 95, type: "auftrag" });
  else if (needsOrderSelection) fields.push({ label: "Auftrag", value: `${base.orderCandidates.length} offene Aufträge`, confidence: 50, type: "auftrag" });
  const theme = aiCategory ? categoryLabel(aiCategory) : base.matchedTheme;
  if (theme) fields.push({ label: "Thema", value: theme, confidence: usedAI ? base.overallConfidence : 85, type: "thema" });
  if (base.matchedMaterial) fields.push({ label: "Material", value: base.matchedMaterial, confidence: usedAI ? base.overallConfidence : 85, type: "material" });
  if (base.matchedTime) fields.push({ label: "Terminangabe", value: `${base.matchedTime.label} · Verfügbarkeit nicht geprüft`, confidence: 80, type: "zeit" });
  if (base.matchedPayment) fields.push({ label: "Zahlungshinweis", value: base.matchedPayment, confidence: 80, type: "zahlung" });

  const liveActions: LivePhoneAction[] = [];
  if (base.intents.wantsNewOrder || aiCategory === "new_order_intake") {
    const payload: PhoneNoteToOrderDraft = {
      source: "phone_note",
      rawText: text,
      customerId: base.matchedCustomer?.id,
      customerName: base.matchedCustomer?.name,
      customerCandidateIds: base.customerCandidates.map((candidate) => candidate.id),
      material: base.matchedMaterial || undefined,
      surfaceRequested: base.surfaceRequested || undefined,
      requestedDate: base.matchedTime?.label,
      suggestedAction: "create_order",
    };
    liveActions.push({
      id: "create_order",
      type: "create_order",
      title: "Auftragserfassung öffnen",
      subtitle: "Übernimmt den Notiztext als Entwurf; gespeichert wird erst nach Bestätigung.",
      confidence: 90,
      priority: "high",
      source: usedAI ? "ai" : "local",
      payload,
      status: "suggested",
    });
  }
  if (
    (base.intents.wantsNewCustomer || aiCategory === "new_customer_request")
    && !base.matchedCustomer
    && (base.customerCandidates.length === 0 || base.customerCandidates[0].confidence < 80)
  ) {
    const payload: PhoneNoteToCustomerDraft = {
      source: "phone_note",
      rawText: text,
      notes: `Aus Telefonnotiz vorbereitet.\n\nKundenanfrage: ${text}`,
      intendedFirstOrder: {
        surfaceRequested: base.surfaceRequested || undefined,
        requestedDate: base.matchedTime?.label,
      },
    };
    liveActions.push({
      id: "create_customer",
      type: "create_customer",
      title: "Kundenerfassung öffnen",
      subtitle: "Öffnet einen prüfbaren Entwurf; es wird noch kein Kunde angelegt.",
      confidence: 85,
      priority: "medium",
      source: usedAI ? "ai" : "local",
      payload,
      status: "suggested",
    });
  }

  return {
    matchedCustomer: base.matchedCustomer,
    matchedOrder: base.matchedOrder,
    allCustomerOrders,
    matchedMaterial: base.matchedMaterial,
    matchedTheme: theme,
    matchedTime: base.matchedTime,
    matchedPayment: base.matchedPayment,
    suggestedAnswer: base.suggestedAnswer,
    overallConfidence: base.overallConfidence,
    fields,
    liveActions,
    highlights: base.highlights,
    customerCandidates: base.customerCandidates,
    needsCustomerSelection,
    orderCandidates: base.orderCandidates,
    needsOrderSelection,
    usedAI,
    aiReason: usedAI ? "Explizit angeforderte, gemessene KI-Analyse" : base.aiReason,
  };
}

export function usePhoneNoteAnalysis() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dataStatus, setDataStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dataError, setDataError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const requestGeneration = useRef(0);

  useEffect(() => {
    let active = true;
    Promise.all([customersRepository.getAll(), ordersRepository.getAll()])
      .then(([loadedCustomers, loadedOrders]) => {
        if (!active) return;
        setCustomers(loadedCustomers);
        setOrders(loadedOrders);
        setDataStatus("ready");
        setDataError(null);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Telefonnotiz-Stammdaten konnten nicht geladen werden", error);
        setDataStatus("error");
        setDataError("Kunden und Aufträge konnten nicht geladen werden; Zuordnungen bleiben deshalb ungeprüft.");
      });
    return () => { active = false; };
  }, []);

  const analyze = useCallback((text: string, overrideCustomerId?: string, overrideOrderIds?: string[]) => {
    requestGeneration.current += 1;
    setAiError(null);
    if (!text || text.trim().length < 3) {
      setResult(null);
      setIsAnalyzing(false);
      return;
    }
    const local = applyOverrides(
      performLocalAnalysis(text, customers, orders),
      customers,
      orders,
      overrideCustomerId,
      overrideOrderIds,
    );
    setResult(buildResult(text, local, orders));
    setIsAnalyzing(false);
  }, [customers, orders]);

  const requestAi = useCallback(async (
    text: string,
    overrideCustomerId?: string,
    overrideOrderIds?: string[],
  ) => {
    if (!text || text.trim().length < 3) return;
    const generation = ++requestGeneration.current;
    const local = applyOverrides(
      performLocalAnalysis(text, customers, orders),
      customers,
      orders,
      overrideCustomerId,
      overrideOrderIds,
    );
    setIsAnalyzing(true);
    setAiError(null);
    const response = await analyzePhoneNoteWithAI({ text });
    if (generation !== requestGeneration.current) return;
    if (!response.ok) {
      setAiError(response.error);
      setResult(buildResult(text, local, orders));
      setIsAnalyzing(false);
      return;
    }
    const merged: LocalAnalysisResult = {
      ...local,
      matchedMaterial: response.data.material || local.matchedMaterial,
      surfaceRequested: response.data.surfaceRequested || local.surfaceRequested,
      suggestedAnswer: response.data.suggestedAnswer,
      overallConfidence: response.data.overallConfidence,
    };
    setResult(buildResult(text, merged, orders, response.data.category, true));
    setIsAnalyzing(false);
  }, [customers, orders]);

  return { result, analyze, requestAi, isAnalyzing, dataStatus, dataError, aiError };
}
