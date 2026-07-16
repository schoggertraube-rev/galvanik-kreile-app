"use client";

import type { MatchResult } from "@/app/kommunikation/smartMatcher";

export interface DossierStamm {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  since: string;
  preferredChannel: string;
  paymentMethod: string;
  type: string;
  risk: string;
  notes: string;
  tags: string[];
}

export interface DossierOrder {
  id: string;
  orderNumber: string;
  description: string;
  material: string;
  status: string;
  statusLabel: string;
  dueDate: string;
}

export interface DossierPayment {
  openTotal: number;
  avgDays: number;
  paymentQuote: number;
  paymentMoral: string;
  preferredMethod: string;
  invoices: { number: string; date: string; amount: number; status: string; daysOpen: number }[];
  monthlyHistory: { month: string; paid: number; open: number }[];
}

export interface DossierComplaint { count: number; totalOrders: number }
export interface DossierCommStats {
  email: number;
  phone: number;
  whatsapp: number;
  total: number;
  monthlyHistory: { month: string; count: number }[];
}
export interface DossierOrderStats {
  total: number;
  revenue: number;
  vsLastYear: string;
  yearlyTrend: { year: string; count: number }[];
  materialBreakdown: { label: string; value: number; color: string }[];
}
export interface DossierCalendar {
  requestedDate: string;
  requestedTime: string;
  isFree: boolean;
  conflicts: string[];
  daySlots: { time: string; label: string; status: "free" | "booked" | "suggested" }[];
}
export interface DossierAttachment { name: string; orderId: string; date: string; type: "image" | "pdf" | "doc" }
export interface DossierAction { id: string; label: string; tag: "auto" | "prüfen" }

export interface ClientDossier {
  stamm: DossierStamm;
  openOrders: DossierOrder[];
  orderStats: DossierOrderStats;
  payments: DossierPayment;
  complaints: DossierComplaint;
  commStats: DossierCommStats;
  calendar: DossierCalendar;
  attachments: DossierAttachment[];
  suggestedAnswer: string;
  preparedActions: DossierAction[];
}

const unavailableDossier: ClientDossier = {
  stamm: {
    name: "", phone: "", email: "", address: "", city: "", since: "", preferredChannel: "",
    paymentMethod: "", type: "", risk: "",
    notes: "Der veralteten Kommandozentrale fehlt ein freigegebener Server-Datenadapter.",
    tags: [],
  },
  openOrders: [],
  orderStats: { total: 0, revenue: 0, vsLastYear: "nicht gemessen", yearlyTrend: [], materialBreakdown: [] },
  payments: { openTotal: 0, avgDays: 0, paymentQuote: 0, paymentMoral: "nicht gemessen", preferredMethod: "", invoices: [], monthlyHistory: [] },
  complaints: { count: 0, totalOrders: 0 },
  commStats: { email: 0, phone: 0, whatsapp: 0, total: 0, monthlyHistory: [] },
  calendar: { requestedDate: "", requestedTime: "", isFree: false, conflicts: [], daySlots: [] },
  attachments: [],
  suggestedAnswer: "",
  preparedActions: [],
};

/**
 * Legacy compatibility only. The routed communication surface uses its authorized
 * server actions; this inactive view must never synthesize a customer dossier.
 */
export function useClientDossier(customerId: string | null, matchData: MatchResult | null): ClientDossier {
  void customerId;
  void matchData;
  return unavailableDossier;
}
