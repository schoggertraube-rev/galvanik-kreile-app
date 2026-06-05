"use client";

import React, { useMemo, useCallback } from "react";
import { MatchResult } from "@/app/kommunikation/smartMatcher";
import { INITIAL_ORDERS, INITIAL_CUSTOMERS, MockCustomer } from "@/lib/mockData";

/* ═══════════════════════════════════════════════════════════
   CLIENT DOSSIER TYPES
   ═══════════════════════════════════════════════════════════ */

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
  invoices: {
    number: string;
    date: string;
    amount: number;
    status: string;
    daysOpen: number;
  }[];
  monthlyHistory: { month: string; paid: number; open: number }[];
}

export interface DossierComplaint {
  count: number;
  totalOrders: number;
}

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

export interface DossierAttachment {
  name: string;
  orderId: string;
  date: string;
  type: "image" | "pdf" | "doc";
}

export interface DossierAction {
  id: string;
  label: string;
  tag: "auto" | "prüfen";
}

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

/* ═══════════════════════════════════════════════════════════
   BUILD DOSSIER from existing data + mock
   ═══════════════════════════════════════════════════════════ */

function buildDossier(customer: MockCustomer | null, matchData: MatchResult | null): ClientDossier {
  const cust = customer;
  const custOrders = cust ? INITIAL_ORDERS.filter(o => o.customerId === cust.id) : [];

  // Stammdaten
  const stamm: DossierStamm = {
    name: cust?.name || "Unbekannt",
    phone: cust?.phone || "—",
    email: cust?.email || "—",
    address: cust?.address || "—",
    city: cust?.city || "—",
    since: "2018",
    preferredChannel: cust?.prefComm || "Telefon",
    paymentMethod: "Bar bei Abholung",
    type: cust?.type || "Privat",
    risk: cust?.risk || "Niedrig",
    notes: cust?.notes || "Keine Notizen vorhanden.",
    tags: ["A-Kunde", cust?.type || "Privat", "Stammkunde"].filter(Boolean),
  };

  // Offene Aufträge
  const openOrders: DossierOrder[] = custOrders.slice(0, 4).map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    description: o.task,
    material: o.parts?.[0]?.material || "—",
    status: o.status || "in_progress",
    statusLabel: o.statusText || "In Bearbeitung",
    dueDate: o.dueDate,
  }));

  // Auftrags-Stats (mock enriched)
  const orderStats: DossierOrderStats = {
    total: custOrders.length || 14,
    revenue: 3840,
    vsLastYear: "+38 %",
    yearlyTrend: [
      { year: "21", count: 3 }, { year: "22", count: 5 }, { year: "23", count: 4 },
      { year: "24", count: 7 }, { year: "25", count: 9 }, { year: "26", count: 6 },
    ],
    materialBreakdown: [
      { label: "Zink", value: 50, color: "#B45309" },
      { label: "Nickel", value: 30, color: "#2563EB" },
      { label: "Chrom", value: 20, color: "#16A34A" },
    ],
  };

  // Zahlungen (mock)
  const payments: DossierPayment = {
    openTotal: 248,
    avgDays: 4.7,
    paymentQuote: 100,
    paymentMoral: "pünktlich",
    preferredMethod: "bar",
    invoices: [
      { number: "2026-0231", date: "30.5.", amount: 248, status: "offen", daysOpen: 4 },
    ],
    monthlyHistory: [
      { month: "Jan", paid: 420, open: 0 }, { month: "Feb", paid: 380, open: 0 },
      { month: "Mär", paid: 510, open: 0 }, { month: "Apr", paid: 290, open: 0 },
      { month: "Mai", paid: 340, open: 0 }, { month: "Jun", paid: 0, open: 248 },
    ],
  };

  // Reklamationen (mock)
  const complaints: DossierComplaint = {
    count: 0,
    totalOrders: custOrders.length || 14,
  };

  // Kommunikation (mock)
  const commStats: DossierCommStats = {
    email: 18, phone: 9, whatsapp: 3, total: 30,
    monthlyHistory: [
      { month: "Jan", count: 3 }, { month: "Feb", count: 2 }, { month: "Mär", count: 4 },
      { month: "Apr", count: 5 }, { month: "Mai", count: 6 }, { month: "Jun", count: 4 },
    ],
  };

  // Kalender (mock)
  const calendar: DossierCalendar = {
    requestedDate: "Donnerstag, 4. Juni",
    requestedTime: "10:00",
    isFree: true,
    conflicts: [],
    daySlots: [
      { time: "08:00", label: "", status: "free" },
      { time: "10:00", label: "Vorgeschlagen: Abholung Müller ✓", status: "suggested" },
      { time: "13:00", label: "Belegt: Lieferung Schmidt AG", status: "booked" },
      { time: "15:00", label: "", status: "free" },
    ],
  };

  // Anhänge (mock)
  const attachments: DossierAttachment[] = [
    { name: "Wasserhahn_historisch.jpg", orderId: "A-2026-0042", date: "28.5.", type: "image" },
    { name: "Lieferschein_0042.pdf", orderId: "A-2026-0042", date: "26.5.", type: "pdf" },
  ];

  // Vorbereitete Aktionen
  const preparedActions: DossierAction[] = [
    { id: "cal", label: "Kalender: Abholung Do 10:00", tag: "auto" },
    { id: "ord", label: "Auftrag: Abholung + bar", tag: "auto" },
    { id: "note", label: "Kundenkarte: Notiz", tag: "auto" },
    { id: "inv", label: "Rechnung 248 € erwähnen", tag: "prüfen" },
  ];

  // Antwort-Vorschlag
  const suggestedAnswer = matchData?.suggestedAnswer ||
    "Guten Tag Herr Müller, Ihre Zinkteile (A-2026-0042) sind ab morgen 10:00 abholbereit. Eine offene Rechnung über 248 € bitte bei Abholung mitbringen.";

  return {
    stamm,
    openOrders,
    orderStats,
    payments,
    complaints,
    commStats,
    calendar,
    attachments,
    suggestedAnswer,
    preparedActions,
  };
}

/* ═══════════════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════════════ */

export function useClientDossier(customerId: string | null, matchData: MatchResult | null): ClientDossier {
  const customer = useMemo(() => {
    if (!customerId) {
      // Try from matchData
      return matchData?.matchedCustomer || null;
    }
    return INITIAL_CUSTOMERS.find(c => c.id === customerId) || matchData?.matchedCustomer || null;
  }, [customerId, matchData]);

  const dossier = useMemo(() => buildDossier(customer, matchData), [customer, matchData]);

  return dossier;
}
