"use server";

import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  readTenantOrderStationReceipt,
  readTenantStationOrders,
  type OrderStationReceiptReadInput,
} from "@/lib/server/orderStationRead";
import type { OrderStationTransitionReceipt } from "@/lib/server/commands/orderStationCommand";
import type { OperationalOrder } from "@/lib/types/operationalOrder";

export type WarendurchlaufOrder = OperationalOrder;

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
  | { ok: false; error: "AUTH_ERROR" | "FORBIDDEN" | "QUERY_ERROR" | "UNAVAILABLE" | "NOT_AVAILABLE"; message: string };

export async function getStationOrders(stationId: string): Promise<WarendurchlaufActionResult<WarendurchlaufOrder[]>> {
  void stationId;
  return { ok: false, error: "NOT_AVAILABLE", message: "NOT_AVAILABLE: Generische Stationslisten sind nicht verfügbar." };
}

export async function getStationReadyOrders(stationId: string): Promise<WarendurchlaufActionResult<WarendurchlaufOrder[]>> {
  void stationId;
  return { ok: false, error: "NOT_AVAILABLE", message: "NOT_AVAILABLE: Generische Stationslisten sind nicht verfügbar." };
}

async function getFixedStationOrders(station: "wareneingang" | "galvanik"): Promise<WarendurchlaufActionResult<WarendurchlaufOrder[]>> {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { ok: false, error: "UNAVAILABLE", message: "Berechtigungen sind derzeit nicht verfügbar." };
  }

  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
      return { ok: false, error: "UNAVAILABLE", message: "Berechtigungen sind derzeit nicht verfügbar." };
    }
    return { ok: false, error: "AUTH_ERROR", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }

  if (!authorization.data.permissions.includes("perm_view_leitstand")) {
    return { ok: false, error: "FORBIDDEN", message: "Stationsliste ist nicht erlaubt." };
  }

  try {
    return { ok: true, data: await readTenantStationOrders(authorization.data, station) };
  } catch {
    return { ok: false, error: "QUERY_ERROR", message: "Stationsliste konnte nicht sicher geladen werden." };
  }
}

export async function getWareneingangOrdersAction(): Promise<WarendurchlaufActionResult<WarendurchlaufOrder[]>> {
  return getFixedStationOrders("wareneingang");
}

export async function getGalvanikOrdersAction(): Promise<WarendurchlaufActionResult<WarendurchlaufOrder[]>> {
  return getFixedStationOrders("galvanik");
}

export async function getOrderStationReceiptAction(
  input: OrderStationReceiptReadInput,
): Promise<WarendurchlaufActionResult<OrderStationTransitionReceipt | null>> {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { ok: false, error: "UNAVAILABLE", message: "Berechtigungen sind derzeit nicht verfügbar." };
  }

  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
      return { ok: false, error: "UNAVAILABLE", message: "Berechtigungen sind derzeit nicht verfügbar." };
    }
    return { ok: false, error: "AUTH_ERROR", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }

  if (!authorization.data.permissions.includes("perm_view_leitstand")) {
    return { ok: false, error: "FORBIDDEN", message: "Stationsbeleg ist nicht erlaubt." };
  }

  try {
    return {
      ok: true,
      data: await readTenantOrderStationReceipt(authorization.data, input),
    };
  } catch {
    return { ok: false, error: "QUERY_ERROR", message: "Stationsbeleg konnte nicht sicher geladen werden." };
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
