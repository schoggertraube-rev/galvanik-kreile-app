"use server";

import { getOperationalOrdersByStation, getOperationalOrdersReadyForStation } from "@/lib/server/operationalOrders";
import type { getOperationalOrders } from "@/lib/server/operationalOrders";
import { checkAppAuth } from "@/lib/server/authHelper";

export type WarendurchlaufOrder = Awaited<ReturnType<typeof getOperationalOrders>>[number];

export interface WarendurchlaufKpiData {
  termintreue: number;
  durchlaufzeitTage: number;
  engpassStation: string;
  engpassCount: number;
  offeneAuftraege: number;
  orders: WarendurchlaufOrder[];
}

export type WarendurchlaufActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "AUTH_ERROR" | "QUERY_ERROR" | "NOT_AVAILABLE"; message: string };

export async function getStationOrders(stationId: string): Promise<WarendurchlaufActionResult<WarendurchlaufOrder[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: "AUTH_ERROR", message: auth.message };
  try {
    const orders = await getOperationalOrdersByStation(stationId);
    return { ok: true, data: orders };
  } catch (error) {
    return { ok: false, error: "QUERY_ERROR", message: String(error) };
  }
}

export async function getStationReadyOrders(stationId: string): Promise<WarendurchlaufActionResult<WarendurchlaufOrder[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: "AUTH_ERROR", message: auth.message };
  try {
    const orders = await getOperationalOrdersReadyForStation(stationId);
    return { ok: true, data: orders };
  } catch (error) {
    return { ok: false, error: "QUERY_ERROR", message: String(error) };
  }
}

export async function startProcessingStation(orderId: string, stationId: string) {
  void orderId;
  void stationId;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Stationsstart benötigt den W3-Command-Vertrag." };
}

export async function getWarendurchlaufKPIs(): Promise<WarendurchlaufActionResult<WarendurchlaufKpiData>> {
  return { ok: false, error: "NOT_AVAILABLE", message: "NOT_AVAILABLE: Warendurchlauf-KPIs benötigen einen kanonischen SQL-Read-Model-Vertrag." };
}
