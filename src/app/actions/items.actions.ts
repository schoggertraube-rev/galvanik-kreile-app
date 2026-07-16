"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, orders } from "@/db/schema";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";

const TENANT_ID = "galvanik-kreile";
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const STATION_ID = /^[a-z][a-z0-9_-]{0,79}$/;

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
  internalNotes?: string;
};

type ItemCreate = Omit<ItemResponse, "id" | "photoIds" | "stationSequence"> & {
  id?: string;
  photoIds?: string[];
  stationSequence?: string[];
};

async function authorize(permission: "perm_view_leitstand" | "perm_data_orders"): Promise<ActionResult<{ tenantId: string; userId: string }>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "UNAUTHORIZED", message: "Anmeldung erforderlich." };
  if (authorization.data.tenantId !== TENANT_ID || !authorization.data.permissions.includes(permission)) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für Auftragsteile." };
  }
  return { ok: true, data: { tenantId: authorization.data.tenantId, userId: authorization.data.userId } };
}

function boundedText(value: unknown, maximum: number, required = false): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error("INVALID_ITEM");
    return undefined;
  }
  if (typeof value !== "string") throw new Error("INVALID_ITEM");
  const normalized = value.trim();
  if ((required && normalized.length === 0) || normalized.length > maximum || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) throw new Error("INVALID_ITEM");
  return normalized || undefined;
}

function parseId(value: unknown): string {
  if (typeof value !== "string" || !ENTITY_ID.test(value)) throw new Error("INVALID_ITEM");
  return value;
}

function parseCodes(value: unknown, maximum: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximum || value.some((entry) => typeof entry !== "string" || !STATION_ID.test(entry))) throw new Error("INVALID_ITEM");
  return [...new Set(value as string[])];
}

function parseEntityIds(value: unknown, maximum: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximum || value.some((entry) => typeof entry !== "string" || !ENTITY_ID.test(entry))) throw new Error("INVALID_ITEM");
  return [...new Set(value as string[])];
}

function parseCreate(value: unknown): ItemCreate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_ITEM");
  const input = value as Record<string, unknown>;
  const allowed = ["id", "orderId", "name", "quantity", "material", "surfaceRequested", "photoIds", "currentStationId", "stationSequence", "internalNotes"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) throw new Error("INVALID_ITEM");
  const quantity = Number(input.quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) throw new Error("INVALID_ITEM");
  const photoIds = input.photoIds === undefined ? [] : parseEntityIds(input.photoIds, 6);
  return {
    ...(input.id !== undefined ? { id: parseId(input.id) } : {}),
    orderId: parseId(input.orderId),
    name: boundedText(input.name, 200, true)!,
    quantity,
    ...(boundedText(input.material, 100) ? { material: boundedText(input.material, 100) } : {}),
    ...(boundedText(input.surfaceRequested, 100) ? { surfaceRequested: boundedText(input.surfaceRequested, 100) } : {}),
    photoIds,
    ...(input.currentStationId !== undefined ? { currentStationId: parseCodes([input.currentStationId], 1)[0] } : {}),
    stationSequence: parseCodes(input.stationSequence, 20),
    ...(boundedText(input.internalNotes, 2_000) ? { internalNotes: boundedText(input.internalNotes, 2_000) } : {}),
  };
}

function parseUpdate(value: unknown): Partial<Omit<ItemResponse, "id" | "orderId">> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_ITEM");
  const input = value as Record<string, unknown>;
  const allowed = ["name", "quantity", "material", "surfaceRequested", "photoIds", "currentStationId", "stationSequence", "internalNotes"];
  if (Object.keys(input).length === 0 || Object.keys(input).some((key) => !allowed.includes(key))) throw new Error("INVALID_ITEM");
  const update: Partial<Omit<ItemResponse, "id" | "orderId">> = {};
  if (input.name !== undefined) update.name = boundedText(input.name, 200, true)!;
  if (input.quantity !== undefined) {
    const quantity = Number(input.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) throw new Error("INVALID_ITEM");
    update.quantity = quantity;
  }
  if (input.material !== undefined) update.material = boundedText(input.material, 100);
  if (input.surfaceRequested !== undefined) update.surfaceRequested = boundedText(input.surfaceRequested, 100);
  if (input.photoIds !== undefined) update.photoIds = parseEntityIds(input.photoIds, 6);
  if (input.currentStationId !== undefined) update.currentStationId = parseCodes([input.currentStationId], 1)[0];
  if (input.stationSequence !== undefined) update.stationSequence = parseCodes(input.stationSequence, 20);
  if (input.internalNotes !== undefined) update.internalNotes = boundedText(input.internalNotes, 2_000);
  return update;
}

function mapItem(row: typeof items.$inferSelect): ItemResponse {
  return {
    id: row.id,
    orderId: row.orderId,
    name: row.name,
    quantity: row.quantity,
    ...(row.material ? { material: row.material } : {}),
    ...(row.surfaceRequested ? { surfaceRequested: row.surfaceRequested } : {}),
    photoIds: row.photoIds || [],
    ...(row.currentStationId ? { currentStationId: row.currentStationId } : {}),
    stationSequence: Array.isArray(row.stationSequence) ? row.stationSequence.filter((entry): entry is string => typeof entry === "string") : [],
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
    const rows = await db.select().from(items).where(and(eq(items.tenantId, actor.data.tenantId), eq(items.orderId, orderId))).orderBy(desc(items.createdAt));
    return { ok: true, data: rows.map(mapItem) };
  } catch {
    return { ok: false, error: "DB_ERROR", message: "Auftragsteile konnten nicht geladen werden." };
  }
}

export async function createItemDb(value: unknown): Promise<ActionResult<ItemResponse>> {
  const actor = await authorize("perm_data_orders");
  if (!actor.ok) return actor;
  let input: ItemCreate;
  try { input = parseCreate(value); }
  catch { return { ok: false, error: "UNKNOWN", message: "Ungültige Teiledaten." }; }
  try {
    const order = (await db.select({ customerId: orders.customerId }).from(orders).where(and(
      eq(orders.id, input.orderId), eq(orders.tenantId, actor.data.tenantId),
    )).limit(1))[0];
    if (!order) return { ok: false, error: "EMPTY_RESULT", message: "Auftrag nicht gefunden." };
    const inserted = await db.insert(items).values({
      id: input.id || createId(),
      tenantId: actor.data.tenantId,
      orderId: input.orderId,
      customerId: order.customerId,
      name: input.name,
      quantity: input.quantity,
      material: input.material,
      surfaceRequested: input.surfaceRequested,
      photoIds: input.photoIds,
      currentStationId: input.currentStationId || "wareneingang",
      stationSequence: input.stationSequence,
      internalNotes: input.internalNotes,
    }).returning();
    if (!inserted[0]) return { ok: false, error: "DB_ERROR", message: "Auftragsteil wurde nicht bestätigt." };
    return { ok: true, data: mapItem(inserted[0]) };
  } catch {
    return { ok: false, error: "DB_ERROR", message: "Auftragsteil konnte nicht erstellt werden." };
  }
}

export async function updateItemDb(idValue: unknown, value: unknown): Promise<ActionResult<ItemResponse>> {
  const actor = await authorize("perm_data_orders");
  if (!actor.ok) return actor;
  let id: string;
  let input: ReturnType<typeof parseUpdate>;
  try { id = parseId(idValue); input = parseUpdate(value); }
  catch { return { ok: false, error: "UNKNOWN", message: "Ungültige Teiledaten." }; }
  try {
    const updateSet: Partial<typeof items.$inferInsert> = {};
    if (input.name !== undefined) updateSet.name = input.name;
    if (input.quantity !== undefined) updateSet.quantity = input.quantity;
    if ("material" in input) updateSet.material = input.material ?? null;
    if ("surfaceRequested" in input) updateSet.surfaceRequested = input.surfaceRequested ?? null;
    if (input.photoIds !== undefined) updateSet.photoIds = input.photoIds;
    if (input.currentStationId !== undefined) updateSet.currentStationId = input.currentStationId;
    if (input.stationSequence !== undefined) updateSet.stationSequence = input.stationSequence;
    if ("internalNotes" in input) updateSet.internalNotes = input.internalNotes ?? null;
    const updated = await db.update(items).set(updateSet).where(and(eq(items.id, id), eq(items.tenantId, actor.data.tenantId))).returning();
    if (!updated[0]) return { ok: false, error: "EMPTY_RESULT", message: "Auftragsteil nicht gefunden." };
    return { ok: true, data: mapItem(updated[0]) };
  } catch {
    return { ok: false, error: "DB_ERROR", message: "Auftragsteil konnte nicht aktualisiert werden." };
  }
}

export async function deleteItemDb(): Promise<ActionResult<{ success: boolean }>> {
  const actor = await authorize("perm_data_orders");
  if (!actor.ok) return actor;
  return { ok: false, error: "FORBIDDEN", message: "Teile werden nicht direkt gelöscht. Ein freigegebener Storno-/Auditablauf ist erforderlich." };
}
