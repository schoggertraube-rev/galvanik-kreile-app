"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";
import { parseRouteSnapshot, type RouteTemplateId } from "@/lib/orders/routeSnapshot";

const TENANT_ID = "galvanik-kreile";
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;

export type ItemResponse = {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  material?: string;
  surfaceRequested?: string;
  photoIds: string[];
  currentStationId?: string;
  stationSequence: string[];
  currentStep: number;
  routeTemplateId?: RouteTemplateId;
  routeSnapshotVersion?: 1;
  internalNotes?: string;
};

async function authorize(permission: "perm_view_leitstand" | "perm_data_orders"): Promise<ActionResult<{ tenantId: string; userId: string }>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "UNAUTHORIZED", message: "Anmeldung erforderlich." };
  if (authorization.data.tenantId !== TENANT_ID || !authorization.data.permissions.includes(permission)) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für Auftragsteile." };
  }
  return { ok: true, data: { tenantId: authorization.data.tenantId, userId: authorization.data.userId } };
}

function parseId(value: unknown): string {
  if (typeof value !== "string" || !ENTITY_ID.test(value)) throw new Error("INVALID_ITEM");
  return value;
}

function mapItem(row: typeof items.$inferSelect): ItemResponse {
  const snapshot = parseRouteSnapshot(row.stationSequence);
  return {
    id: row.id,
    orderId: row.orderId,
    name: row.name,
    quantity: row.quantity,
    ...(row.material ? { material: row.material } : {}),
    ...(row.surfaceRequested ? { surfaceRequested: row.surfaceRequested } : {}),
    photoIds: row.photoIds || [],
    ...(row.currentStationId ? { currentStationId: row.currentStationId } : {}),
    stationSequence: snapshot?.stations ?? (Array.isArray(row.stationSequence) ? row.stationSequence.filter((entry): entry is string => typeof entry === "string") : []),
    currentStep: row.currentStep ?? 0,
    ...(snapshot ? { routeTemplateId: snapshot.templateId, routeSnapshotVersion: snapshot.contractVersion } : {}),
    ...(row.internalNotes ? { internalNotes: row.internalNotes } : {}),
  };
}

export async function getItemsDb(): Promise<ActionResult<ItemResponse[]>> {
  const actor = await authorize("perm_view_leitstand");
  if (!actor.ok) return actor;
  try {
    const rows = await db.select().from(items).where(eq(items.tenantId, actor.data.tenantId)).orderBy(desc(items.createdAt));
    return { ok: true, data: rows.map(mapItem) };
  } catch {
    return { ok: false, error: "DB_ERROR", message: "Auftragsteile konnten nicht geladen werden." };
  }
}

export async function getItemsByOrderDb(orderIdValue: unknown): Promise<ActionResult<ItemResponse[]>> {
  const actor = await authorize("perm_view_leitstand");
  if (!actor.ok) return actor;
  let orderId: string;
  try { orderId = parseId(orderIdValue); }
  catch { return { ok: false, error: "UNKNOWN", message: "Ungültige Auftrags-ID." }; }
  try {
    const rows = await db.select().from(items).where(and(
      eq(items.tenantId, actor.data.tenantId),
      eq(items.orderId, orderId),
    )).orderBy(desc(items.createdAt));
    return { ok: true, data: rows.map(mapItem) };
  } catch {
    return { ok: false, error: "DB_ERROR", message: "Auftragsteile konnten nicht geladen werden." };
  }
}

export async function createItemDb(_value: unknown): Promise<ActionResult<ItemResponse>> {
  void _value;
  const actor = await authorize("perm_data_orders");
  if (!actor.ok) return actor;
  return {
    ok: false,
    error: "FORBIDDEN",
    message: "Zusätzliche Teile sind gesperrt, bis ein atomarer, idempotenter Rework-/Handling-Unit-Beleg verfügbar ist. Initiale Positionen werden ausschließlich mit dem Auftrag angelegt.",
  };
}

export async function updateItemDb(_idValue: unknown, _value: unknown): Promise<ActionResult<ItemResponse>> {
  void _idValue;
  void _value;
  const actor = await authorize("perm_data_orders");
  if (!actor.ok) return actor;
  return {
    ok: false,
    error: "FORBIDDEN",
    message: "Positionsänderungen sind gesperrt, bis Wareneingangsgrenze, Idempotenz und Auditbeleg atomar verbunden sind.",
  };
}

export async function deleteItemDb(): Promise<ActionResult<{ success: boolean }>> {
  const actor = await authorize("perm_data_orders");
  if (!actor.ok) return actor;
  return { ok: false, error: "FORBIDDEN", message: "Teile werden nicht direkt gelöscht. Ein freigegebener Storno-/Auditablauf ist erforderlich." };
}
