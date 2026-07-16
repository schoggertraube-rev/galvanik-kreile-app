"use client";

import { useMemo } from "react";
import type { LocalAnalysisResult } from "@/lib/localPhoneAnalysis";
import type { Customer } from "@/lib/repositories/customersRepository";
import type { Order } from "@/lib/repositories/ordersRepository";

export interface LiveContextData {
  customer: {
    id: string;
    name: string;
    city: string | null;
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
    days: [];
    hint: string;
    availability: "not_connected";
  };
  stock: null;
  stockHint: string;
  payment: null;
  paymentHint: string;
}

export function useLiveContext(
  matchedCustomer: Customer | null,
  matchedOrder: Order | null,
  customerOrders: readonly Order[],
  matchedMaterial: string | null,
  matchedTime: LocalAnalysisResult["matchedTime"],
): LiveContextData {
  return useMemo(() => {
    const customer = matchedCustomer
      ? {
          id: matchedCustomer.id,
          name: matchedCustomer.name,
          city: matchedCustomer.city?.trim() || null,
          initials: matchedCustomer.name
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        }
      : null;
    const orders = customerOrders.slice(0, 3).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      task: order.task?.trim() || order.title?.trim() || "Keine Beschreibung hinterlegt",
      status: order.status,
      statusText: order.statusText?.trim() || order.status,
      isHighlighted: matchedOrder?.id === order.id,
    }));
    return {
      customer,
      orders,
      calendar: {
        days: [],
        hint: matchedTime
          ? `Terminangabe erkannt: ${matchedTime.label}. Kalenderverfügbarkeit ist nicht angebunden.`
          : "Kalenderverfügbarkeit ist nicht angebunden.",
        availability: "not_connected",
      },
      stock: null,
      stockHint: matchedMaterial
        ? `Material „${matchedMaterial}“ erkannt; Lagerbestand ist hier noch nicht angebunden.`
        : "Lagerbestand ist hier noch nicht angebunden.",
      payment: null,
      paymentHint: "Offene Posten und Zahlungsmoral sind hier noch nicht angebunden.",
    };
  }, [matchedCustomer, matchedOrder, customerOrders, matchedMaterial, matchedTime]);
}
