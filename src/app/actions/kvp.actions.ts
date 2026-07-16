"use server";

import { and, desc, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/db";
import { kvpItems } from "@/db/schema";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";
import type { KvpItem } from "@/lib/repositories/kvpRepository";

const TENANT_ID = "galvanik-kreile";
const STATUSES = ["neu", "prüfen", "angenommen", "umgesetzt", "abgelehnt"] as const;
const CATEGORIES = [
  "Sicherheit",
  "Qualität",
  "Ablauf",
  "Werkzeug/Maschine",
  "Kunde",
  "Kommunikation",
  "Ordnung/Sauberkeit",
  "Sonstiges",
] as const;
const BENEFITS = ["Zeit sparen", "Fehler vermeiden", "Kunde zufriedener", "Kosten senken", "Arbeit erleichtern"] as const;

type KvpActor = {
  tenantId: string;
  role: string;
  canWrite: boolean;
  canReview: boolean;
};

async function authorize(): Promise<ActionResult<KvpActor>> {
  const result = await resolveAuthorization();
  if (!result.ok) return { ok: false, error: "UNAUTHORIZED", message: "Anmeldung erforderlich." };
  if (result.data.tenantId !== TENANT_ID || !result.data.permissions.includes("perm_view_leitstand")) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für KVP." };
  }
  return {
    ok: true,
    data: {
      tenantId: result.data.tenantId,
      role: result.data.role,
      canWrite: result.data.role !== "readonly",
      canReview: ["developer", "admin", "meister"].includes(result.data.role),
    },
  };
}

function text(value: unknown, max: number, required = false): string {
  if (typeof value !== "string") throw new Error("INVALID_KVP");
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new Error("INVALID_KVP");
  }
  return normalized;
}

function mapRow(row: typeof kvpItems.$inferSelect): KvpItem {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    benefit: row.benefit,
    status: row.status as KvpItem["status"],
    problemDesc: row.problemDesc || "",
    hasPhoto: row.hasPhoto,
    date: (row.createdAt || new Date(0)).toISOString(),
  };
}

export async function getKvpItemsAction(): Promise<ActionResult<KvpItem[]>> {
  const actor = await authorize();
  if (!actor.ok) return actor;
  try {
    const rows = await db
      .select()
      .from(kvpItems)
      .where(and(eq(kvpItems.tenantId, actor.data.tenantId), eq(kvpItems.isDemo, false)))
      .orderBy(desc(kvpItems.createdAt));
    return { ok: true, data: rows.map(mapRow) };
  } catch (error) {
    console.error("KVP list failed", error);
    return { ok: false, error: "DB_ERROR", message: "KVP-Ideen konnten nicht geladen werden." };
  }
}

export async function createKvpItemAction(input: unknown): Promise<ActionResult<KvpItem>> {
  const actor = await authorize();
  if (!actor.ok) return actor;
  if (!actor.data.canWrite) return { ok: false, error: "FORBIDDEN", message: "Keine Schreibberechtigung für KVP." };

  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_KVP");
    const value = input as Record<string, unknown>;
    if (Object.keys(value).some((key) => !["title", "category", "benefit", "problemDesc", "hasPhoto", "status"].includes(key))) {
      throw new Error("INVALID_KVP");
    }
    const title = text(value.title, 200, true);
    const problemDesc = text(value.problemDesc ?? "", 2_000);
    if (!CATEGORIES.includes(value.category as typeof CATEGORIES[number])) throw new Error("INVALID_KVP");
    if (!BENEFITS.includes(value.benefit as typeof BENEFITS[number])) throw new Error("INVALID_KVP");
    if (value.hasPhoto === true) {
      return { ok: false, error: "UNKNOWN", message: "KVP-Fotos sind noch nicht an den sicheren Uploadpfad angebunden." };
    }

    const [created] = await db
      .insert(kvpItems)
      .values({
        id: `kvp_${createId()}`,
        tenantId: actor.data.tenantId,
        title,
        category: value.category as string,
        benefit: value.benefit as string,
        status: "neu",
        problemDesc: problemDesc || null,
        hasPhoto: false,
        isDemo: false,
        date: null,
      })
      .returning();
    return { ok: true, data: mapRow(created) };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_KVP") {
      return { ok: false, error: "UNKNOWN", message: "Ungültige KVP-Eingabe." };
    }
    console.error("KVP create failed", error);
    return { ok: false, error: "DB_ERROR", message: "KVP-Idee konnte nicht gespeichert werden." };
  }
}

export async function updateKvpStatusAction(id: unknown, status: unknown): Promise<ActionResult<KvpItem>> {
  const actor = await authorize();
  if (!actor.ok) return actor;
  if (!actor.data.canReview) return { ok: false, error: "FORBIDDEN", message: "Nur Leitung oder Meister dürfen KVP-Status ändern." };

  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || !STATUSES.includes(status as typeof STATUSES[number])) {
    return { ok: false, error: "UNKNOWN", message: "Ungültiger KVP-Status." };
  }

  try {
    const [updated] = await db
      .update(kvpItems)
      .set({ status: status as string })
      .where(and(eq(kvpItems.id, id), eq(kvpItems.tenantId, actor.data.tenantId), eq(kvpItems.isDemo, false)))
      .returning();
    if (!updated) return { ok: false, error: "EMPTY_RESULT", message: "KVP-Idee wurde nicht gefunden." };
    return { ok: true, data: mapRow(updated) };
  } catch (error) {
    console.error("KVP status update failed", error);
    return { ok: false, error: "DB_ERROR", message: "KVP-Status konnte nicht gespeichert werden." };
  }
}
