"use client";
import { useMemo } from "react";
import { MockCustomer, MockOrder } from "@/lib/mockData";
const INITIAL_ORDERS: MockOrder[] = [];

export interface LiveContextData {
  customer: {
    name: string;
    city: string;
    since: string;
    totalOrders: number;
    initials: string;
  } | null;
  orders: {
    id: string;
    orderNumber: string;
    task: string;
    status: string;
    statusText: string;
    isHighlighted: boolean;
  }[];
  calendar: {
    days: { label: string; num: number; info: string; type: "normal" | "suggested" | "holiday" | "today" }[];
    hint: string;
  };
  stock: {
    name: string;
    level: string;
    status: "ok" | "low" | "empty";
  } | null;
  payment: {
    open: string;
    total: string;
    moral: string;
  } | null;
}

export function useLiveContext(
  matchedCustomer: MockCustomer | null,
  matchedOrder: MockOrder | null,
  matchedMaterial: string | null,
  matchedTime: { label: string; dayOfWeek: number; isFree: boolean } | null,
): LiveContextData {
  return useMemo(() => {
    // Customer
    let customer: LiveContextData["customer"] = null;
    if (matchedCustomer) {
      customer = {
        name: matchedCustomer.name,
        city: matchedCustomer.city || "Unbekannt",
        since: "Kunde seit 2019",
        totalOrders: matchedCustomer.orders?.length || 0,
        initials: matchedCustomer.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      };
    }

    // Orders
    let orders: LiveContextData["orders"] = [];
    if (matchedCustomer) {
      const custOrders = INITIAL_ORDERS.filter(o => o.customerId === matchedCustomer.id);
      orders = custOrders.slice(0, 3).map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        task: o.task,
        status: o.status || "active",
        statusText: o.statusText,
        isHighlighted: matchedOrder?.id === o.id,
      }));
    }

    // Calendar (next 5 days)
    const now = new Date();
    const weekdayLabels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const calDays: LiveContextData["calendar"]["days"] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isSuggested = matchedTime && !isWeekend && i > 0 && matchedTime.dayOfWeek === dow;
      calDays.push({
        label: weekdayLabels[dow],
        num: d.getDate(),
        info: i === 0 ? "heute" : isWeekend ? "zu" : isSuggested ? "frei ✓" : "—",
        type: i === 0 ? "today" : isWeekend ? "holiday" : isSuggested ? "suggested" : "normal",
      });
    }
    const calHint = matchedTime
      ? (matchedTime.isFree ? `Termin ${matchedTime.label} ist frei` : "Wochenende — Werkstatt geschlossen")
      : "Kein Termin im Gespräch erkannt";

    // Stock (demo data based on material)
    let stock: LiveContextData["stock"] = null;
    if (matchedMaterial) {
      const mat = matchedMaterial.charAt(0).toUpperCase() + matchedMaterial.slice(1);
      // Demo stock levels
      const levels: Record<string, { level: string; status: "ok" | "low" }> = {
        zink: { level: "88 % voll", status: "ok" },
        chrom: { level: "45 % voll", status: "low" },
        nickel: { level: "72 % voll", status: "ok" },
        messing: { level: "91 % voll", status: "ok" },
        kupfer: { level: "33 % voll", status: "low" },
      };
      const info = levels[matchedMaterial.toLowerCase()] || { level: "—", status: "ok" as const };
      stock = { name: `${mat}-Bad 3`, ...info };
    }

    // Payment (demo data)
    let payment: LiveContextData["payment"] = null;
    if (matchedCustomer) {
      payment = {
        open: "248,00 €",
        total: "2024 · Nr. 0231",
        moral: "pünktlich",
      };
    }

    return { customer, orders, calendar: { days: calDays, hint: calHint }, stock, payment };
  }, [matchedCustomer, matchedOrder, matchedMaterial, matchedTime]);
}
