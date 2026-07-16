"use server";

import { db } from "@/db";
import { customers, inquiries } from "@/db/schema";
import { and, count, desc, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { QuoteRequest } from "@/lib/repositories/inquiriesRepository";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";

const TENANT_ID = "galvanik-kreile";
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const STATUSES = ["offen", "angeboten", "archiviert", "angenommen", "abgelehnt"] as const;
const RUST_LEVELS = ["Leicht", "Mittel", "Stark", "Sehr stark"] as const;
const DIRT_LEVELS = ["Sauber", "Leicht", "Stark"] as const;
const PRICING_KEYS = ["grundarbeit", "reinigung", "entmetallisierung", "schleifaufwand", "badchemie", "risikopuffer", "marge"] as const;
const EMPTY_PRICING: QuoteRequest["pricing"] = {
  grundarbeit: 0,
  reinigung: 0,
  entmetallisierung: 0,
  schleifaufwand: 0,
  badchemie: 0,
  risikopuffer: 0,
  marge: 0,
};

type InquiryActor = { tenantId: string; canWrite: boolean };

async function authorizeInquiry(): Promise<ActionResult<InquiryActor>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "UNAUTHORIZED", message: "Anmeldung erforderlich." };
  if (
    authorization.data.tenantId !== TENANT_ID
    || (!authorization.data.permissions.includes("perm_view_leitstand") && !authorization.data.permissions.includes("perm_data_orders"))
  ) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für Anfragen." };
  }
  return { ok: true, data: { tenantId: authorization.data.tenantId, canWrite: authorization.data.role !== "readonly" } };
}

function boundedText(value: unknown, maximum: number, required = false): string {
  if (value === undefined || value === null) {
    if (required) throw new Error("INVALID_INQUIRY");
    return "";
  }
  if (typeof value !== "string") throw new Error("INVALID_INQUIRY");
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maximum || /[\u0000-\u001F\u007F]/.test(normalized)) throw new Error("INVALID_INQUIRY");
  return normalized;
}

function mapInquiry(row: typeof inquiries.$inferSelect): QuoteRequest {
  return {
    id: row.id,
    customerName: row.customerName,
    customerId: row.customerId || "",
    subject: row.subject,
    description: row.description,
    receivedAt: row.receivedAt.toISOString(),
    rustLevel: (row.rustLevel || "Leicht") as QuoteRequest["rustLevel"],
    dirtLevel: (row.dirtLevel || "Sauber") as QuoteRequest["dirtLevel"],
    partCount: row.partCount,
    material: row.material,
    status: row.status as QuoteRequest["status"],
    photo: row.photo || undefined,
    pricing: row.pricing || { ...EMPTY_PRICING },
  };
}

function parsePricing(value: unknown): QuoteRequest["pricing"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_INQUIRY");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== PRICING_KEYS.length || Object.keys(record).some((key) => !PRICING_KEYS.includes(key as typeof PRICING_KEYS[number]))) {
    throw new Error("INVALID_INQUIRY");
  }
  const parsed = { ...EMPTY_PRICING };
  for (const key of PRICING_KEYS) {
    const amount = Number(record[key]);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) throw new Error("INVALID_INQUIRY");
    parsed[key] = Math.round(amount * 100) / 100;
  }
  return parsed;
}

export async function getInquiries(): Promise<ActionResult<QuoteRequest[]>> {
  const actor = await authorizeInquiry();
  if (!actor.ok) return actor;
  try {
    const rows = await db
      .select()
      .from(inquiries)
      .where(eq(inquiries.tenantId, actor.data.tenantId))
      .orderBy(desc(inquiries.receivedAt));
    return { ok: true, data: rows.map(mapInquiry) };
  } catch (error) {
    console.error("Failed to get inquiries from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Anfragen konnten nicht geladen werden." };
  }
}

export async function getOpenInquiriesCount(): Promise<ActionResult<number>> {
  const actor = await authorizeInquiry();
  if (!actor.ok) return actor;
  try {
    const [{ value }] = await db
      .select({ value: count() })
      .from(inquiries)
      .where(and(eq(inquiries.tenantId, actor.data.tenantId), eq(inquiries.status, "offen")));
    return { ok: true, data: value };
  } catch (error) {
    console.error("Failed to get open inquiries count from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Offene Anfragen konnten nicht gezählt werden." };
  }
}

export async function createInquiry(data: unknown): Promise<ActionResult<QuoteRequest>> {
  const actor = await authorizeInquiry();
  if (!actor.ok) return actor;
  if (!actor.data.canWrite) return { ok: false, error: "FORBIDDEN", message: "Keine Schreibberechtigung für Anfragen." };

  try {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("INVALID_INQUIRY");
    const value = data as Record<string, unknown>;
    const allowed = ["customerName", "customerId", "subject", "description", "partCount", "material", "rustLevel", "dirtLevel", "quelleTyp"];
    if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("INVALID_INQUIRY");

    const customerName = boundedText(value.customerName, 200, true);
    const customerId = value.customerId === undefined || value.customerId === null || value.customerId === ""
      ? null
      : boundedText(value.customerId, 100, true);
    if (customerId && !ENTITY_ID.test(customerId)) throw new Error("INVALID_INQUIRY");
    const subject = boundedText(value.subject, 200, true);
    const description = boundedText(value.description, 5_000);
    const material = boundedText(value.material, 200);
    const partCount = Number(value.partCount);
    if (!Number.isSafeInteger(partCount) || partCount < 1 || partCount > 1_000_000) throw new Error("INVALID_INQUIRY");
    const rustLevel = value.rustLevel === undefined || value.rustLevel === null ? "Leicht" : value.rustLevel;
    const dirtLevel = value.dirtLevel === undefined || value.dirtLevel === null ? "Sauber" : value.dirtLevel;
    if (!RUST_LEVELS.includes(rustLevel as typeof RUST_LEVELS[number]) || !DIRT_LEVELS.includes(dirtLevel as typeof DIRT_LEVELS[number])) {
      throw new Error("INVALID_INQUIRY");
    }
    const quelleTyp = boundedText(value.quelleTyp ?? "unbekannt", 50, true);
    if (!/^[a-z][a-z0-9_-]{0,49}$/i.test(quelleTyp)) throw new Error("INVALID_INQUIRY");

    if (customerId) {
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.tenantId, actor.data.tenantId)))
        .limit(1);
      if (!customer) return { ok: false, error: "EMPTY_RESULT", message: "Kunde wurde nicht gefunden." };
    }

    const [created] = await db
      .insert(inquiries)
      .values({
        id: createId(),
        tenantId: actor.data.tenantId,
        customerName,
        customerId,
        subject,
        description,
        rustLevel: rustLevel as string,
        dirtLevel: dirtLevel as string,
        partCount,
        material,
        status: "offen",
        pricing: { ...EMPTY_PRICING },
        quelleTyp,
      })
      .returning();
    return { ok: true, data: mapInquiry(created) };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_INQUIRY") {
      return { ok: false, error: "UNKNOWN", message: "Ungültige Anfrage.", details: { form: ["Bitte Eingaben prüfen."] } };
    }
    console.error("Failed to create inquiry in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Anfrage konnte nicht gespeichert werden." };
  }
}

export async function updateInquiry(id: unknown, changes: unknown): Promise<ActionResult<QuoteRequest>> {
  const actor = await authorizeInquiry();
  if (!actor.ok) return actor;
  if (!actor.data.canWrite) return { ok: false, error: "FORBIDDEN", message: "Keine Schreibberechtigung für Anfragen." };
  if (typeof id !== "string" || !ENTITY_ID.test(id) || !changes || typeof changes !== "object" || Array.isArray(changes)) {
    return { ok: false, error: "UNKNOWN", message: "Ungültige Anfrageänderung." };
  }
  try {
    const value = changes as Record<string, unknown>;
    if (Object.keys(value).length !== 1 || !Object.keys(value).every((key) => key === "status" || key === "pricing")) {
      throw new Error("INVALID_INQUIRY");
    }
    const updateData: { status?: string; pricing?: QuoteRequest["pricing"]; updatedAt: Date } = { updatedAt: new Date() };
    if (value.status !== undefined) {
      if (!STATUSES.includes(value.status as typeof STATUSES[number])) throw new Error("INVALID_INQUIRY");
      updateData.status = value.status as string;
    }
    if (value.pricing !== undefined) updateData.pricing = parsePricing(value.pricing);

    const [updated] = await db
      .update(inquiries)
      .set(updateData)
      .where(and(eq(inquiries.id, id), eq(inquiries.tenantId, actor.data.tenantId)))
      .returning();
    if (!updated) return { ok: false, error: "EMPTY_RESULT", message: "Anfrage wurde nicht gefunden." };
    return { ok: true, data: mapInquiry(updated) };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_INQUIRY") {
      return { ok: false, error: "UNKNOWN", message: "Ungültige Anfrageänderung." };
    }
    console.error("Failed to update inquiry in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Anfrage konnte nicht aktualisiert werden." };
  }
}
