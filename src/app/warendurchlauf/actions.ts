"use server";

import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  readTenantOrderStationReceipt,
  readTenantStationOrders,
  type OrderStationReceiptReadInput,
} from "@/lib/server/orderStationRead";
import type { OrderStationTransitionReceipt } from "@/lib/server/commands/orderStationCommand";
import type {
  FinalizeOrderStationAttachmentInput,
  GetOrderStationAttachmentOriginalInput,
  GetOrderStationAttachmentsInput,
  OrderStationAttachmentResult,
  ReserveOrderStationAttachmentInput,
} from "@/lib/server/orderStationAttachment";
import type { EvidenceReadRecord, ReadEvidenceTargetInput } from "@/lib/server/evidenceRead";
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

async function authorizeOrderStationAttachment(
  permission: "perm_view_leitstand" | "perm_op_photos",
): Promise<
  | { ok: true; data: AuthorizationSnapshot }
  | { ok: false; result: OrderStationAttachmentResult<never> }
> {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return {
      ok: false,
      result: { code: "UNAVAILABLE", message: "Berechtigungen sind derzeit nicht verfügbar." },
    };
  }
  if (!authorization.ok) {
    return {
      ok: false,
      result: authorization.reason === "AUTHORIZATION_UNAVAILABLE"
        ? { code: "UNAVAILABLE", message: "Berechtigungen sind derzeit nicht verfügbar." }
        : { code: "UNAUTHENTICATED", message: "Sitzung ist nicht verfügbar." },
    };
  }
  if (!authorization.data.permissions.includes(permission)) {
    return {
      ok: false,
      result: { code: "FORBIDDEN", message: "Übergabeoriginale sind nicht erlaubt." },
    };
  }
  return { ok: true, data: authorization.data };
}

export async function getGalvanikHandoffAttachmentsAction(
  input: GetOrderStationAttachmentsInput,
) {
  noStore();
  const authorization = await authorizeOrderStationAttachment("perm_view_leitstand");
  if (!authorization.ok) return authorization.result;
  const domain = await import("@/lib/server/orderStationAttachment");
  const result = await domain.readOrderStationAttachments(authorization.data, input);
  if (result.code !== "OK") return result;
  const evidenceDomain = await import("@/lib/server/evidenceRead");
  const evidence = await evidenceDomain.readOrderEvidenceRecords(authorization.data, input);
  if (evidence.code !== "OK") return evidence;
  return {
    code: "OK" as const,
    data: {
      receipts: result.data,
      evidenceRecords: evidence.data satisfies EvidenceReadRecord[],
      canOperate: authorization.data.permissions.includes("perm_op_photos"),
      currentActorId: authorization.data.userId,
    },
  };
}

export async function getGalvanikEvidenceByTargetAction(
  input: ReadEvidenceTargetInput,
) {
  noStore();
  const authorization = await authorizeOrderStationAttachment("perm_view_leitstand");
  if (!authorization.ok) return authorization.result;
  const evidenceDomain = await import("@/lib/server/evidenceRead");
  return evidenceDomain.readEvidenceRecordsByTarget(authorization.data, input);
}

export async function reserveGalvanikHandoffAttachmentAction(
  input: ReserveOrderStationAttachmentInput,
) {
  noStore();
  const authorization = await authorizeOrderStationAttachment("perm_op_photos");
  if (!authorization.ok) return authorization.result;
  const domain = await import("@/lib/server/orderStationAttachment");
  return domain.reserveOrderStationAttachment(authorization.data, input);
}

export async function finalizeGalvanikHandoffAttachmentAction(
  input: FinalizeOrderStationAttachmentInput,
) {
  noStore();
  const authorization = await authorizeOrderStationAttachment("perm_op_photos");
  if (!authorization.ok) return authorization.result;
  const domain = await import("@/lib/server/orderStationAttachment");
  return domain.finalizeOrderStationAttachment(authorization.data, input);
}

export async function getGalvanikHandoffAttachmentOriginalAction(
  input: GetOrderStationAttachmentOriginalInput,
) {
  noStore();
  const authorization = await authorizeOrderStationAttachment("perm_op_photos");
  if (!authorization.ok) return authorization.result;
  const domain = await import("@/lib/server/orderStationAttachment");
  return domain.getOrderStationAttachmentOriginal(authorization.data, input);
}

export async function startProcessingStation(orderId: string, stationId: string) {
  void orderId;
  void stationId;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Stationsstart benötigt den W3-Command-Vertrag." };
}

export async function getWarendurchlaufKPIs(): Promise<WarendurchlaufActionResult<WarendurchlaufKpiData>> {
  return { ok: false, error: "NOT_AVAILABLE", message: "NOT_AVAILABLE: Warendurchlauf-KPIs benötigen einen kanonischen SQL-Read-Model-Vertrag." };
}
