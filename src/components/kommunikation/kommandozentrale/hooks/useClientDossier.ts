"use client";

import type { MatchResult } from "@/app/kommunikation/smartMatcher";

export interface DossierStamm {
  name: string; phone: string; email: string; address: string; city: string; since: string;
  preferredChannel: string; paymentMethod: string; type: string; risk: string; notes: string; tags: string[];
}
export interface DossierOrder {
  id: string; orderNumber: string; description: string; material: string; status: string; statusLabel: string; dueDate: string;
}
export interface DossierPayment {
  openTotal: number; avgDays: number; paymentQuote: number; paymentMoral: string; preferredMethod: string;
  invoices: { number: string; date: string; amount: number; status: string; daysOpen: number }[];
  monthlyHistory: { month: string; paid: number; open: number }[];
}
export interface DossierComplaint { count: number; totalOrders: number; }
export interface DossierCommStats { email: number; phone: number; whatsapp: number; total: number; monthlyHistory: { month: string; count: number }[]; }
export interface DossierOrderStats {
  total: number; revenue: number; vsLastYear: string;
  yearlyTrend: { year: string; count: number }[];
  materialBreakdown: { label: string; value: number; color: string }[];
}
export interface DossierCalendar {
  requestedDate: string; requestedTime: string; isFree: boolean; conflicts: string[];
  daySlots: { time: string; label: string; status: "free" | "booked" | "suggested" }[];
}
export interface DossierAttachment { name: string; orderId: string; date: string; type: "image" | "pdf" | "doc"; }
export interface DossierAction { id: string; label: string; tag: "auto" | "prüfen"; }
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

/**
 * A customer dossier previously combined browser reads, realtime subscriptions,
 * and fixed example values.  Throwing an explicit unavailable error is safer
 * than presenting empty/zero values as a real dossier.
 */
export function useClientDossier(_customerId: string | null, _matchData: MatchResult | null): ClientDossier {
  throw new Error("NOT_CONFIGURED: Kundendossier benötigt einen geprüften Server-, Tenant- und Evidenzvertrag.");
}
