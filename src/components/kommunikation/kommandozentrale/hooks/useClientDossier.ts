"use client";

import { useEffect, useState } from "react";
import { MatchResult } from "@/app/kommunikation/smartMatcher";
import { supabase } from "@/lib/supabase/client";
import {
  getClientDossierAction,
  type ClientDossierDataDto,
} from "../clientDossier.actions";

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
  capabilities: {
    canViewFinance: boolean;
    canViewQuality: boolean;
  };
}

function buildEmptyDossier(): ClientDossier {
  return {
    stamm: {
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      since: "",
      preferredChannel: "",
      paymentMethod: "",
      type: "",
      risk: "",
      notes: "",
      tags: [],
    },
    openOrders: [],
    orderStats: {
      total: 0,
      revenue: 0,
      vsLastYear: "—",
      yearlyTrend: [],
      materialBreakdown: [],
    },
    payments: {
      openTotal: 0,
      avgDays: 0,
      paymentQuote: 0,
      paymentMoral: "",
      preferredMethod: "",
      invoices: [],
      monthlyHistory: [],
    },
    complaints: { count: 0, totalOrders: 0 },
    commStats: {
      email: 0,
      phone: 0,
      whatsapp: 0,
      total: 0,
      monthlyHistory: [],
    },
    calendar: {
      requestedDate: "",
      requestedTime: "",
      isFree: true,
      conflicts: [],
      daySlots: [],
    },
    attachments: [],
    suggestedAnswer: "",
    preparedActions: [],
    capabilities: { canViewFinance: false, canViewQuality: false },
  };
}

function buildDossierFromDto(
  data: ClientDossierDataDto,
  matchData: MatchResult | null,
): ClientDossier {
  const openOrders = data.orders.filter(
    (order) => order.status !== "completed" && order.status !== "delivered",
  );
  const paymentRows = data.payments ?? [];
  const openPayments = paymentRows.filter((payment) => payment.status === "pending");
  const openTotal = openPayments.reduce(
    (sum, payment) => sum + Number(payment.amountEur),
    0,
  );

  return {
    stamm: {
      name: data.customer.name,
      phone: data.customer.phone ?? "—",
      email: data.customer.email ?? "—",
      address: data.customer.address ?? "—",
      city: data.customer.city ?? "—",
      since: new Date(data.customer.createdAt).getFullYear().toString(),
      preferredChannel: data.customer.prefComm ?? "Telefon",
      paymentMethod: data.capabilities.canViewFinance
        ? paymentRows[0]?.mollieMethod ?? paymentRows[0]?.provider ?? "—"
        : "",
      type: data.customer.type,
      risk: data.customer.risk ?? "Niedrig",
      notes: data.customer.notes ?? "Keine Notizen vorhanden.",
      tags: data.customer.tags,
    },
    openOrders: openOrders.slice(0, 4).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      description: order.task ?? order.title,
      material: "—",
      status: order.status,
      statusLabel: order.statusText ?? "In Bearbeitung",
      dueDate: order.dueDate ?? "",
    })),
    orderStats: {
      total: data.orders.length,
      revenue: paymentRows
        .filter((payment) => payment.status === "completed")
        .reduce((sum, payment) => sum + Number(payment.amountEur), 0),
      vsLastYear: "—",
      yearlyTrend: [],
      materialBreakdown: [],
    },
    payments: {
      openTotal,
      avgDays: 0,
      paymentQuote: 0,
      paymentMoral: openTotal > 0 ? "ausstehend" : "pünktlich",
      preferredMethod:
        paymentRows[0]?.mollieMethod ?? paymentRows[0]?.provider ?? "—",
      invoices: openPayments.map((payment) => ({
        number: payment.id,
        date: payment.createdAt.slice(0, 10),
        amount: Number(payment.amountEur),
        status: "offen",
        daysOpen: 0,
      })),
      monthlyHistory: [],
    },
    complaints: {
      count: data.quality?.length ?? 0,
      totalOrders: data.orders.length,
    },
    commStats: {
      email: data.communications.filter(
        (communication) => communication.channelType === "resend",
      ).length,
      phone: data.communications.filter(
        (communication) => communication.type === "phone",
      ).length,
      whatsapp: data.communications.filter(
        (communication) => communication.channelType === "whatsapp",
      ).length,
      total: data.communications.length,
      monthlyHistory: [],
    },
    calendar: {
      requestedDate: "",
      requestedTime: "",
      isFree: true,
      conflicts: [],
      daySlots: [],
    },
    attachments: [],
    suggestedAnswer: matchData?.suggestedAnswer ?? "",
    preparedActions: [],
    capabilities: data.capabilities,
  };
}

export function useClientDossier(
  customerId: string | null,
  matchData: MatchResult | null,
): ClientDossier {
  const [state, setState] = useState<{
    customerId: string;
    dossier: ClientDossier;
  }>({ customerId: "", dossier: buildEmptyDossier() });
  const matchedCustomerId = matchData?.matchedCustomer?.id ?? null;
  const suggestedAnswer = matchData?.suggestedAnswer ?? null;
  const targetId = customerId ?? matchedCustomerId;

  useEffect(() => {
    if (!targetId) return;

    let isMounted = true;

    const loadDossier = async () => {
      try {
        const result = await getClientDossierAction(targetId);
        if (isMounted) {
          setState({
            customerId: targetId,
            dossier: result.ok
              ? buildDossierFromDto(result.data, matchData)
              : buildEmptyDossier(),
          });
        }
      } catch {
        if (isMounted) {
          setState({ customerId: targetId, dossier: buildEmptyDossier() });
        }
      }
    };

    void loadDossier();

    const channel = supabase
      .channel(`dossier_${targetId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "communications",
          filter: `customer_id=eq.${targetId}`,
        },
        loadDossier,
      )
      .subscribe();

    const handleFocusSync = () => void loadDossier();
    window.addEventListener("kreile-sync-focus", handleFocusSync);

    return () => {
      isMounted = false;
      window.removeEventListener("kreile-sync-focus", handleFocusSync);
      void supabase.removeChannel(channel);
    };
  }, [targetId, suggestedAnswer, matchData]);

  return targetId && state.customerId === targetId
    ? state.dossier
    : buildEmptyDossier();
}
