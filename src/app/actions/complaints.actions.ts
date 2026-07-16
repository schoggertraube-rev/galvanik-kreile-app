"use server";

import { db } from "@/db";
import { complaints, customers, items, orders } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Complaint } from "@/lib/repositories/complaintsRepository";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";

const TENANT_ID = "galvanik-kreile";
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const REASONS = ["surface_quality", "wrong_surface", "damage", "delay", "communication", "customer_expectation", "transport", "other"] as const;
const STATUSES = ["open", "in_review", "resolved", "rejected"] as const;

type ComplaintActor = { tenantId: string; canWrite: boolean };

async function authorizeComplaints(): Promise<ActionResult<ComplaintActor>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "UNAUTHORIZED", message: "Anmeldung erforderlich." };
  if (
    authorization.data.tenantId !== TENANT_ID
    || (!authorization.data.permissions.includes("perm_view_customers") && !authorization.data.permissions.includes("perm_data_orders"))
  ) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für Reklamationen." };
  }
  return {
    ok: true,
    data: {
      tenantId: authorization.data.tenantId,
      canWrite: authorization.data.permissions.includes("perm_op_qa"),
    },
  };
}

function mapComplaint(row: typeof complaints.$inferSelect): Complaint {
  return {
    id: row.id,
    customerId: row.customerId,
    orderId: row.orderId,
    itemId: row.itemId || undefined,
    reason: row.reason as Complaint["reason"],
    stationId: row.stationId || undefined,
    description: row.description,
    photoIds: row.photoIds || [],
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
    resolution: row.resolution || undefined,
    status: row.status || "open",
  };
}

function boundedText(value: unknown, maximum: number, required = false): string {
  if (value === undefined || value === null) {
    if (required) throw new Error("INVALID_COMPLAINT");
    return "";
  }
  if (typeof value !== "string") throw new Error("INVALID_COMPLAINT");
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maximum || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
    throw new Error("INVALID_COMPLAINT");
  }
  return normalized;
}

function entityId(value: unknown, optional = false): string | undefined {
  if (optional && (value === undefined || value === null || value === "")) return undefined;
  if (typeof value !== "string" || !ENTITY_ID.test(value)) throw new Error("INVALID_COMPLAINT");
  return value;
}

function photoIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 6 || value.some((entry) => typeof entry !== "string" || !ENTITY_ID.test(entry))) {
    throw new Error("INVALID_COMPLAINT");
  }
  return [...new Set(value as string[])];
}

export async function getComplaints(): Promise<ActionResult<Complaint[]>> {
  const actor = await authorizeComplaints();
  if (!actor.ok) return actor;
  try {
    const rows = await db
      .select()
      .from(complaints)
      .where(eq(complaints.tenantId, actor.data.tenantId))
      .orderBy(desc(complaints.createdAt));
    return { ok: true, data: rows.map(mapComplaint) };
  } catch (error) {
    console.error("Failed to get complaints from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Reklamationen konnten nicht geladen werden." };
  }
}

export async function getByOrder(orderId: unknown): Promise<ActionResult<Complaint[]>> {
  const actor = await authorizeComplaints();
  if (!actor.ok) return actor;
  if (typeof orderId !== "string" || !ENTITY_ID.test(orderId)) return { ok: false, error: "UNKNOWN", message: "Ungültige Auftrags-ID." };
  try {
    const rows = await db
      .select()
      .from(complaints)
      .where(and(eq(complaints.tenantId, actor.data.tenantId), eq(complaints.orderId, orderId)))
      .orderBy(desc(complaints.createdAt));
    return { ok: true, data: rows.map(mapComplaint) };
  } catch (error) {
    console.error("Failed to get complaints for order from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Reklamationen konnten nicht geladen werden." };
  }
}

export async function getComplaintsByCustomer(customerId: unknown): Promise<ActionResult<Complaint[]>> {
  const actor = await authorizeComplaints();
  if (!actor.ok) return actor;
  if (typeof customerId !== "string" || !ENTITY_ID.test(customerId)) return { ok: false, error: "UNKNOWN", message: "Ungültige Kunden-ID." };
  try {
    const rows = await db
      .select()
      .from(complaints)
      .where(and(eq(complaints.tenantId, actor.data.tenantId), eq(complaints.customerId, customerId)))
      .orderBy(desc(complaints.createdAt));
    return { ok: true, data: rows.map(mapComplaint) };
  } catch (error) {
    console.error("Failed to get customer complaints", error);
    return { ok: false, error: "DB_ERROR", message: "Reklamationen konnten nicht geladen werden." };
  }
}

export async function createComplaint(data: {
  id?: string;
  orderId: string;
  customerId: string;
  itemId?: string;
  reason: string;
  stationId?: string;
  description?: string;
  photoIds?: string[];
}): Promise<ActionResult<Complaint>> {
  const actor = await authorizeComplaints();
  if (!actor.ok) return actor;
  if (!actor.data.canWrite) return { ok: false, error: "FORBIDDEN", message: "Keine Schreibberechtigung für Reklamationen." };
  try {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("INVALID_COMPLAINT");
    const allowed = ["id", "orderId", "customerId", "itemId", "reason", "stationId", "description", "photoIds"];
    if (Object.keys(data).some((key) => !allowed.includes(key))) throw new Error("INVALID_COMPLAINT");
    const complaintId = data.id ? entityId(data.id)! : createId();
    const orderId = entityId(data.orderId)!;
    const customerId = entityId(data.customerId)!;
    const itemId = entityId(data.itemId, true);
    if (!REASONS.includes(data.reason as typeof REASONS[number])) throw new Error("INVALID_COMPLAINT");
    const stationId = data.stationId ? boundedText(data.stationId, 100, true) : undefined;
    const description = boundedText(data.description ?? "", 5_000);
    const photos = photoIds(data.photoIds);

    const created = await db.transaction(async (tx) => {
      const [order] = await tx
        .select({ id: orders.id, customerId: orders.customerId })
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.tenantId, actor.data.tenantId)))
        .limit(1);
      if (!order || order.customerId !== customerId) throw new Error("PARENT_MISMATCH");
      const [customer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.tenantId, actor.data.tenantId)))
        .limit(1);
      if (!customer) throw new Error("PARENT_MISMATCH");
      if (itemId) {
        const [item] = await tx
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.id, itemId), eq(items.orderId, orderId), eq(items.tenantId, actor.data.tenantId)))
          .limit(1);
        if (!item) throw new Error("PARENT_MISMATCH");
      }

      const [row] = await tx
        .insert(complaints)
        .values({
          id: complaintId,
          tenantId: actor.data.tenantId,
          orderId,
          customerId,
          itemId: itemId || null,
          reason: data.reason,
          stationId: stationId || null,
          description,
          photoIds: photos,
          status: "open",
        })
        .returning();
      return row;
    });
    return { ok: true, data: mapComplaint(created) };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_COMPLAINT") return { ok: false, error: "UNKNOWN", message: "Ungültige Reklamation." };
    if (code === "PARENT_MISMATCH") return { ok: false, error: "EMPTY_RESULT", message: "Auftrag, Kunde oder Teil gehören nicht zusammen." };
    console.error("Failed to create complaint in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Reklamation konnte nicht gespeichert werden." };
  }
}

export async function updateComplaint(id: string, changes: {
  reason?: string;
  description?: string;
  status?: string;
  resolution?: string;
  resolvedAt?: Date;
  photoIds?: string[];
}): Promise<ActionResult<Complaint>> {
  const actor = await authorizeComplaints();
  if (!actor.ok) return actor;
  if (!actor.data.canWrite) return { ok: false, error: "FORBIDDEN", message: "Keine Schreibberechtigung für Reklamationen." };
  if (typeof id !== "string" || !ENTITY_ID.test(id) || !changes || typeof changes !== "object" || Array.isArray(changes)) {
    return { ok: false, error: "UNKNOWN", message: "Ungültige Reklamationsänderung." };
  }
  try {
    const allowed = ["reason", "description", "status", "resolution", "resolvedAt", "photoIds"];
    if (Object.keys(changes).length === 0 || Object.keys(changes).some((key) => !allowed.includes(key))) throw new Error("INVALID_COMPLAINT");
    const update: {
      reason?: string;
      description?: string;
      status?: string;
      resolution?: string | null;
      resolvedAt?: Date | null;
      photoIds?: string[];
    } = {};
    if (changes.reason !== undefined) {
      if (!REASONS.includes(changes.reason as typeof REASONS[number])) throw new Error("INVALID_COMPLAINT");
      update.reason = changes.reason;
    }
    if (changes.description !== undefined) update.description = boundedText(changes.description, 5_000);
    if (changes.status !== undefined) {
      if (!STATUSES.includes(changes.status as typeof STATUSES[number])) throw new Error("INVALID_COMPLAINT");
      update.status = changes.status;
    }
    if (changes.resolution !== undefined) update.resolution = boundedText(changes.resolution, 5_000) || null;
    if (changes.resolvedAt !== undefined) {
      if (!(changes.resolvedAt instanceof Date) || Number.isNaN(changes.resolvedAt.getTime())) throw new Error("INVALID_COMPLAINT");
      update.resolvedAt = changes.resolvedAt;
    }
    if (changes.photoIds !== undefined) update.photoIds = photoIds(changes.photoIds);

    const [row] = await db
      .update(complaints)
      .set(update)
      .where(and(eq(complaints.id, id), eq(complaints.tenantId, actor.data.tenantId)))
      .returning();
    if (!row) return { ok: false, error: "EMPTY_RESULT", message: "Reklamation wurde nicht gefunden." };
    return { ok: true, data: mapComplaint(row) };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_COMPLAINT") {
      return { ok: false, error: "UNKNOWN", message: "Ungültige Reklamationsänderung." };
    }
    console.error("Failed to update complaint in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Reklamation konnte nicht aktualisiert werden." };
  }
}

export async function resolveComplaint(id: string, resolution: string): Promise<ActionResult<Complaint>> {
  return updateComplaint(id, { status: "resolved", resolution, resolvedAt: new Date() });
}
