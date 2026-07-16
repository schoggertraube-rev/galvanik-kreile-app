"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, items, orders } from "@/db/schema";
import {
  parseEventLimit,
  parseOperationalEntityId,
  parseOperationalEvent,
  type CreateOperationalEventInput,
  type OperationalEventMetadata,
  type OperationalEventType,
} from "@/lib/events/operationalEventContract";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";

const TENANT_ID = "galvanik-kreile";

export type OperationalEventReceipt = {
  id: string;
  clientEventId: string;
  orderId: string;
  itemId?: string;
  eventType: OperationalEventType;
  metadata?: OperationalEventMetadata;
  createdAt: string;
  replayed: boolean;
};

export type OperationalEventResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "UNAUTHORIZED" | "FORBIDDEN" | "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "STORAGE_UNAVAILABLE"; message: string };

const DOCUMENTARY_EVENT_TYPES: readonly OperationalEventType[] = [
  "LABEL_PREPARED",
  "PHOTO_CAPTURED",
  "NOTE_ADDED",
];

function authorize(snapshot: Awaited<ReturnType<typeof resolveAuthorization>>, permission: "perm_op_status" | "perm_view_leitstand"): OperationalEventResult<AuthorizationSnapshot> {
  if (!snapshot.ok) return { ok: false, error: "UNAUTHORIZED", message: "Anmeldung erforderlich." };
  if (snapshot.data.tenantId !== TENANT_ID || !snapshot.data.permissions.includes(permission)) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für Betriebsereignisse." };
  }
  return { ok: true, data: snapshot.data };
}

function receipt(row: {
  id: string;
  clientEventId: string | null;
  orderId: string;
  itemId: string | null;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}, replayed: boolean): OperationalEventReceipt {
  return {
    id: row.id,
    clientEventId: row.clientEventId || "",
    orderId: row.orderId,
    ...(row.itemId ? { itemId: row.itemId } : {}),
    eventType: row.eventType as OperationalEventType,
    ...(row.payload ? { metadata: row.payload as OperationalEventMetadata } : {}),
    createdAt: new Date(row.createdAt).toISOString(),
    replayed,
  };
}

const receiptSelection = {
  id: events.id,
  clientEventId: events.clientEventId,
  orderId: events.orderId,
  itemId: events.itemId,
  eventType: events.eventType,
  payload: events.payload,
  createdAt: events.createdAt,
};

export async function createStatusEvent(value: unknown): Promise<OperationalEventResult<OperationalEventReceipt>> {
  const actorResult = authorize(await resolveAuthorization(), "perm_op_status");
  if (!actorResult.ok) return actorResult;

  let input: CreateOperationalEventInput;
  try {
    input = parseOperationalEvent(value);
  } catch {
    return { ok: false, error: "INVALID_INPUT", message: "Ungültiges Betriebsereignis." };
  }
  if (!DOCUMENTARY_EVENT_TYPES.includes(input.eventType)) {
    return {
      ok: false,
      error: "FORBIDDEN",
      message: "Fachliche Erfolgsereignisse dürfen nur atomar in der zuständigen Domain-Transaktion entstehen.",
    };
  }

  try {
    const order = (await db.select({ id: orders.id }).from(orders).where(and(
      eq(orders.id, input.orderId),
      eq(orders.tenantId, actorResult.data.tenantId),
    )).limit(1))[0];
    if (!order) return { ok: false, error: "NOT_FOUND", message: "Auftrag nicht gefunden." };

    if (input.itemId) {
      const item = (await db.select({ id: items.id }).from(items).where(and(
        eq(items.id, input.itemId),
        eq(items.orderId, input.orderId),
        eq(items.tenantId, actorResult.data.tenantId),
      )).limit(1))[0];
      if (!item) return { ok: false, error: "NOT_FOUND", message: "Teil gehört nicht zu diesem Auftrag." };
    }

    const inserted = await db.insert(events).values({
      id: createId(),
      tenantId: actorResult.data.tenantId,
      clientEventId: input.clientEventId,
      orderId: input.orderId,
      itemId: input.itemId,
      eventType: input.eventType,
      payload: input.metadata,
      status: "success",
      userId: actorResult.data.userId,
    }).onConflictDoNothing({
      target: [events.tenantId, events.clientEventId],
    }).returning(receiptSelection);

    const persisted = inserted[0] || (await db.select(receiptSelection).from(events).where(and(
      eq(events.tenantId, actorResult.data.tenantId),
      eq(events.clientEventId, input.clientEventId),
    )).limit(1))[0];
    if (!persisted || !persisted.clientEventId) {
      return { ok: false, error: "STORAGE_UNAVAILABLE", message: "Ereignis wurde nicht bestätigt." };
    }
    if (inserted.length === 0) {
      const sameRequest = persisted.orderId === input.orderId
        && (persisted.itemId || undefined) === input.itemId
        && persisted.eventType === input.eventType
        && JSON.stringify(persisted.payload || {}) === JSON.stringify(input.metadata || {});
      if (!sameRequest) {
        return { ok: false, error: "CONFLICT", message: "Diese Ereignis-ID wurde bereits mit anderen Daten verwendet." };
      }
    }
    return { ok: true, data: receipt(persisted, inserted.length === 0) };
  } catch {
    return { ok: false, error: "STORAGE_UNAVAILABLE", message: "Ereignis konnte nicht dauerhaft gespeichert werden." };
  }
}

async function readEvents(actor: AuthorizationSnapshot, where: ReturnType<typeof and>, limitValue: unknown): Promise<OperationalEventResult<OperationalEventReceipt[]>> {
  let limit: number;
  try {
    limit = parseEventLimit(limitValue);
  } catch {
    return { ok: false, error: "INVALID_INPUT", message: "Ungültiges Ereignislimit." };
  }
  try {
    const rows = await db.select(receiptSelection).from(events).where(and(
      eq(events.tenantId, actor.tenantId),
      where,
    )).orderBy(desc(events.createdAt)).limit(limit);
    return { ok: true, data: rows.filter((row) => row.clientEventId !== null).map((row) => receipt(row, false)) };
  } catch {
    return { ok: false, error: "STORAGE_UNAVAILABLE", message: "Ereignisse konnten nicht geladen werden." };
  }
}

export async function getStatusEventsByOrderId(orderIdValue: unknown, limitValue: unknown = 100): Promise<OperationalEventResult<OperationalEventReceipt[]>> {
  const actorResult = authorize(await resolveAuthorization(), "perm_view_leitstand");
  if (!actorResult.ok) return actorResult;
  let orderId: string;
  try { orderId = parseOperationalEntityId(orderIdValue); }
  catch { return { ok: false, error: "INVALID_INPUT", message: "Ungültige Auftrags-ID." }; }
  return readEvents(actorResult.data, eq(events.orderId, orderId), limitValue);
}

export async function getStatusEventsByItemId(itemIdValue: unknown, limitValue: unknown = 100): Promise<OperationalEventResult<OperationalEventReceipt[]>> {
  const actorResult = authorize(await resolveAuthorization(), "perm_view_leitstand");
  if (!actorResult.ok) return actorResult;
  let itemId: string;
  try { itemId = parseOperationalEntityId(itemIdValue); }
  catch { return { ok: false, error: "INVALID_INPUT", message: "Ungültige Teile-ID." }; }
  return readEvents(actorResult.data, eq(events.itemId, itemId), limitValue);
}

export async function getRecentStatusEvents(limitValue: unknown = 10): Promise<OperationalEventResult<OperationalEventReceipt[]>> {
  const actorResult = authorize(await resolveAuthorization(), "perm_view_leitstand");
  if (!actorResult.ok) return actorResult;
  return readEvents(actorResult.data, eq(events.tenantId, TENANT_ID), limitValue);
}
