"use client";

import { MatchResult } from "@/app/kommunikation/smartMatcher";
import { MockCustomer } from "@/lib/mockData";
const INITIAL_ORDERS: any[] = [];
const INITIAL_CUSTOMERS: MockCustomer[] = [];

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

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export function useClientDossier(customerId: string | null, matchData: MatchResult | null): ClientDossier {
  const [dossier, setDossier] = useState<ClientDossier>(buildEmptyDossier());

  useEffect(() => {
    let isMounted = true;
    const loadDossier = async () => {
      const targetId = customerId || matchData?.matchedCustomer?.id;
      if (!targetId) return;

      // Fetch customer
      const { data: customer } = await supabase.from('customers').select('*').eq('id', targetId).single();
      if (!customer) return;

      // Fetch orders
      const { data: orders } = await supabase.from('orders').select('*').eq('customer_id', targetId);
      
      // Fetch payments
      const { data: payments } = await supabase.from('payments').select('*').in('order_id', (orders || []).map(o => o.id));

      // Fetch communications
      const { data: communications } = await supabase.from('communications').select('*').eq('customer_id', targetId);

      // Build dossier
      if (isMounted) {
        setDossier(buildDossierFromRealData(customer, orders || [], payments || [], communications || [], matchData));
      }
    };
    
    loadDossier();

    const targetId = customerId || matchData?.matchedCustomer?.id;
    if (!targetId) return;

    const channel = supabase.channel(`dossier_${targetId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communications', filter: `customer_id=eq.${targetId}` }, loadDossier)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${targetId}` }, loadDossier)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, loadDossier) // would need complex filter or just reload on all payment changes
      .subscribe();

    return () => { 
      isMounted = false; 
      supabase.removeChannel(channel);
    };
  }, [customerId, matchData]);

  return dossier;
}

function buildEmptyDossier(): ClientDossier {
  return {
    stamm: { name: "", phone: "", email: "", address: "", city: "", since: "", preferredChannel: "", paymentMethod: "", type: "", risk: "", notes: "", tags: [] },
    openOrders: [],
    orderStats: { total: 0, revenue: 0, vsLastYear: "0 %", yearlyTrend: [], materialBreakdown: [] },
    payments: { openTotal: 0, avgDays: 0, paymentQuote: 0, paymentMoral: "", preferredMethod: "", invoices: [], monthlyHistory: [] },
    complaints: { count: 0, totalOrders: 0 },
    commStats: { email: 0, phone: 0, whatsapp: 0, total: 0, monthlyHistory: [] },
    calendar: { requestedDate: "", requestedTime: "", isFree: true, conflicts: [], daySlots: [] },
    attachments: [],
    suggestedAnswer: "",
    preparedActions: [],
  };
}

function buildDossierFromRealData(cust: any, custOrders: any[], custPayments: any[], comms: any[], matchData: MatchResult | null): ClientDossier {
  const openOrdersData = custOrders.filter(o => o.status !== 'completed' && o.status !== 'delivered');
  const openTotal = custPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount_eur || 0), 0);

  return {
    stamm: {
      name: cust.name || "Unbekannt",
      phone: cust.phone || "—",
      email: cust.email || "—",
      address: cust.address || "—",
      city: cust.city || "—",
      since: "2026",
      preferredChannel: cust.pref_comm || "Telefon",
      paymentMethod: "Rechnung / Mollie",
      type: cust.type || "Privat",
      risk: cust.risk || "Niedrig",
      notes: cust.notes || "Keine Notizen vorhanden.",
      tags: ["Real-Data"],
    },
    openOrders: openOrdersData.slice(0, 4).map((o: any) => ({
      id: o.id,
      orderNumber: o.order_number || o.id.substring(0,8),
      description: o.task || "Keine Beschreibung",
      material: o.material || "—",
      status: o.status || "in_progress",
      statusLabel: o.status_text || "In Bearbeitung",
      dueDate: o.due_date,
    })),
    orderStats: {
      total: custOrders.length,
      revenue: custPayments.filter(p => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount_eur || 0), 0),
      vsLastYear: "+0 %",
      yearlyTrend: [],
      materialBreakdown: [],
    },
    payments: {
      openTotal: openTotal,
      avgDays: 0,
      paymentQuote: 100,
      paymentMoral: openTotal > 0 ? "ausstehend" : "pünktlich",
      preferredMethod: "Mollie",
      invoices: custPayments.filter(p => p.status === 'pending').map(p => ({
        number: p.provider_intent_id || "Offen",
        date: p.created_at?.substring(0, 10),
        amount: Number(p.amount_eur),
        status: "offen",
        daysOpen: 0
      })),
      monthlyHistory: [],
    },
    complaints: { count: 0, totalOrders: custOrders.length },
    commStats: {
      email: comms.filter(c => c.channel_type === 'resend').length,
      phone: comms.filter(c => c.type === 'phone').length,
      whatsapp: 0,
      total: comms.length,
      monthlyHistory: [],
    },
    calendar: { requestedDate: "", requestedTime: "", isFree: true, conflicts: [], daySlots: [] },
    attachments: [],
    suggestedAnswer: matchData?.suggestedAnswer || "",
    preparedActions: [],
  };
}
