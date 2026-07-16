"use server";

import { db } from "@/db";
import { customers, orders, phoneNotes } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";

export interface CreatePhoneNoteInput {
  rawText: string;
  generatedAnswer?: string;
  category?: string;
  urgency?: string;
  customerId?: string;
  orderId?: string;
  callerName?: string;
  company?: string;
  phone?: string;
  status?: string;
  extractionJson?: unknown;
  linksJson?: unknown;
}

export type PhoneNoteRecord = typeof phoneNotes.$inferSelect;
export type PhoneNoteMutationResult =
  | { success: true; data: PhoneNoteRecord }
  | { success: false; error: string };

const TENANT_ID = "galvanik-kreile";
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const PHONE_NOTE_STATUSES = ["new", "open", "parked", "waiting_callback", "waiting_customer", "done", "archived"] as const;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

type PhoneNoteActor = { tenantId: string; userId: string; canWrite: boolean };

async function authorizePhoneNotes(): Promise<ActionResult<PhoneNoteActor>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "UNAUTHORIZED", message: "Anmeldung erforderlich." };
  if (authorization.data.tenantId !== TENANT_ID || !authorization.data.permissions.includes("perm_view_customers")) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für Telefonnotizen." };
  }
  return {
    ok: true,
    data: {
      tenantId: authorization.data.tenantId,
      userId: authorization.data.userId,
      canWrite: authorization.data.role !== "readonly",
    },
  };
}

function text(value: unknown, maximum: number, required = false): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error("INVALID_PHONE_NOTE");
    return null;
  }
  if (typeof value !== "string") throw new Error("INVALID_PHONE_NOTE");
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maximum || CONTROL_CHARACTERS.test(normalized)) {
    throw new Error("INVALID_PHONE_NOTE");
  }
  return normalized || null;
}

function entityId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !ENTITY_ID.test(value)) throw new Error("INVALID_PHONE_NOTE");
  return value;
}

function boundedJson(value: unknown, fallback: Record<string, never> | never[]): unknown {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "object") throw new Error("INVALID_PHONE_NOTE");
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("INVALID_PHONE_NOTE");
  }
  if (!serialized || Buffer.byteLength(serialized, "utf8") > 32_768) throw new Error("INVALID_PHONE_NOTE");
  return JSON.parse(serialized) as unknown;
}

function status(value: unknown, fallback: typeof PHONE_NOTE_STATUSES[number]): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !PHONE_NOTE_STATUSES.includes(value as typeof PHONE_NOTE_STATUSES[number])) {
    throw new Error("INVALID_PHONE_NOTE");
  }
  return value;
}

export async function createPhoneNote(input: unknown): Promise<PhoneNoteMutationResult> {
  const actor = await authorizePhoneNotes();
  if (!actor.ok) return { success: false, error: actor.message };
  if (!actor.data.canWrite) return { success: false, error: "Keine Schreibberechtigung für Telefonnotizen." };
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_PHONE_NOTE");
    const value = input as Record<string, unknown>;
    const allowed = [
      "rawText", "generatedAnswer", "category", "urgency", "customerId", "orderId",
      "callerName", "company", "phone", "status", "extractionJson", "linksJson",
    ];
    if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("INVALID_PHONE_NOTE");
    const customerId = entityId(value.customerId);
    const orderId = entityId(value.orderId);
    const created = await db.transaction(async (tx) => {
      let canonicalCustomerId = customerId;
      if (orderId) {
        const [order] = await tx
          .select({ id: orders.id, customerId: orders.customerId })
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.tenantId, actor.data.tenantId)))
          .limit(1);
        if (!order || (customerId && order.customerId !== customerId)) throw new Error("PARENT_MISMATCH");
        canonicalCustomerId = order.customerId;
      }
      if (canonicalCustomerId) {
        const [customer] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.id, canonicalCustomerId), eq(customers.tenantId, actor.data.tenantId)))
          .limit(1);
        if (!customer) throw new Error("PARENT_MISMATCH");
      }
      const [row] = await tx
        .insert(phoneNotes)
        .values({
          tenantId: actor.data.tenantId,
          rawText: text(value.rawText, 12_000, true)!,
          generatedAnswer: text(value.generatedAnswer, 4_000),
          category: text(value.category, 100) || "Neuanfrage",
          urgency: text(value.urgency, 50) || "Normal",
          customerId: canonicalCustomerId,
          orderId,
          callerName: text(value.callerName, 200),
          company: text(value.company, 200),
          phone: text(value.phone, 80),
          extractionJson: boundedJson(value.extractionJson, {}),
          linksJson: boundedJson(value.linksJson, []),
          status: status(value.status, "open"),
          createdBy: actor.data.userId,
        })
        .returning();
      if (!row) throw new Error("WRITE_RECEIPT_MISSING");
      return row;
    });
    return { success: true, data: created };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_PHONE_NOTE") return { success: false, error: "Ungültige Telefonnotiz." };
    if (code === "PARENT_MISMATCH") return { success: false, error: "Kunde und Auftrag gehören nicht zusammen." };
    console.error("Failed to insert phone note:", error);
    return { success: false, error: "Telefonnotiz konnte nicht gespeichert werden." };
  }
}

export async function getRecentPhoneNotes(limit = 5): Promise<PhoneNoteRecord[]> {
  const actor = await authorizePhoneNotes();
  if (!actor.ok) throw new Error(actor.message);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Ungültiges Abfragelimit.");
  try {
    return await db.select()
      .from(phoneNotes)
      .where(eq(phoneNotes.tenantId, actor.data.tenantId))
      .orderBy(desc(phoneNotes.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("Failed to fetch recent phone notes:", error);
    throw new Error("Telefonnotizen konnten nicht geladen werden.");
  }
}

export async function getPhoneNoteById(id: unknown): Promise<PhoneNoteRecord | null> {
  const actor = await authorizePhoneNotes();
  if (!actor.ok) throw new Error(actor.message);
  let normalizedId: string | null;
  try {
    normalizedId = entityId(id);
  } catch {
    throw new Error("Ungültige Telefonnotiz-ID.");
  }
  if (!normalizedId) throw new Error("Ungültige Telefonnotiz-ID.");
  try {
    const [note] = await db
      .select()
      .from(phoneNotes)
      .where(and(eq(phoneNotes.id, normalizedId), eq(phoneNotes.tenantId, actor.data.tenantId)))
      .limit(1);
    return note || null;
  } catch (error) {
    console.error("Failed to fetch phone note:", error);
    throw new Error("Telefonnotiz konnte nicht geladen werden.");
  }
}

export async function updatePhoneNote(id: unknown, input: unknown): Promise<PhoneNoteMutationResult> {
  const actor = await authorizePhoneNotes();
  if (!actor.ok) return { success: false, error: actor.message };
  if (!actor.data.canWrite) return { success: false, error: "Keine Schreibberechtigung für Telefonnotizen." };
  try {
    if (typeof id !== "string" || !ENTITY_ID.test(id) || !input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("INVALID_PHONE_NOTE");
    }
    const value = input as Record<string, unknown>;
    const allowed = [
      "rawText", "generatedAnswer", "category", "urgency", "customerId", "orderId",
      "callerName", "company", "phone", "status", "extractionJson", "linksJson",
    ];
    if (Object.keys(value).length === 0 || Object.keys(value).some((key) => !allowed.includes(key))) {
      throw new Error("INVALID_PHONE_NOTE");
    }
    const updateData: Partial<typeof phoneNotes.$inferInsert> = { updatedAt: new Date() };
    if (value.rawText !== undefined) updateData.rawText = text(value.rawText, 12_000, true)!;
    if (value.generatedAnswer !== undefined) updateData.generatedAnswer = text(value.generatedAnswer, 4_000);
    if (value.category !== undefined) updateData.category = text(value.category, 100);
    if (value.urgency !== undefined) updateData.urgency = text(value.urgency, 50);
    if (value.callerName !== undefined) updateData.callerName = text(value.callerName, 200);
    if (value.company !== undefined) updateData.company = text(value.company, 200);
    if (value.phone !== undefined) updateData.phone = text(value.phone, 80);
    if (value.status !== undefined) updateData.status = status(value.status, "open");
    if (value.extractionJson !== undefined) updateData.extractionJson = boundedJson(value.extractionJson, {});
    if (value.linksJson !== undefined) updateData.linksJson = boundedJson(value.linksJson, []);

    const requestedCustomerId = value.customerId !== undefined ? entityId(value.customerId) : undefined;
    const requestedOrderId = value.orderId !== undefined ? entityId(value.orderId) : undefined;
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ customerId: phoneNotes.customerId, orderId: phoneNotes.orderId })
        .from(phoneNotes)
        .where(and(eq(phoneNotes.id, id), eq(phoneNotes.tenantId, actor.data.tenantId)))
        .limit(1)
        .for("update");
      if (!existing) throw new Error("PHONE_NOTE_NOT_FOUND");
      let canonicalCustomerId = requestedCustomerId === undefined ? existing.customerId : requestedCustomerId;
      const canonicalOrderId = requestedOrderId === undefined ? existing.orderId : requestedOrderId;
      if (canonicalOrderId) {
        const [order] = await tx
          .select({ customerId: orders.customerId })
          .from(orders)
          .where(and(eq(orders.id, canonicalOrderId), eq(orders.tenantId, actor.data.tenantId)))
          .limit(1);
        if (!order || (canonicalCustomerId && order.customerId !== canonicalCustomerId)) throw new Error("PARENT_MISMATCH");
        canonicalCustomerId = order.customerId;
      }
      if (canonicalCustomerId) {
        const [customer] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.id, canonicalCustomerId), eq(customers.tenantId, actor.data.tenantId)))
          .limit(1);
        if (!customer) throw new Error("PARENT_MISMATCH");
      }
      if (requestedCustomerId !== undefined || canonicalOrderId) updateData.customerId = canonicalCustomerId;
      if (requestedOrderId !== undefined) updateData.orderId = canonicalOrderId;
      const [row] = await tx
        .update(phoneNotes)
        .set(updateData)
        .where(and(eq(phoneNotes.id, id), eq(phoneNotes.tenantId, actor.data.tenantId)))
        .returning();
      if (!row) throw new Error("WRITE_RECEIPT_MISSING");
      return row;
    });
    return { success: true, data: updated };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_PHONE_NOTE") return { success: false, error: "Ungültige Telefonnotiz." };
    if (code === "PARENT_MISMATCH") return { success: false, error: "Kunde und Auftrag gehören nicht zusammen." };
    if (code === "PHONE_NOTE_NOT_FOUND") return { success: false, error: "Telefonnotiz wurde nicht gefunden." };
    console.error("Failed to update phone note:", error);
    return { success: false, error: "Telefonnotiz konnte nicht aktualisiert werden." };
  }
}
