"use server";

import { db } from "@/db";
import { baeder, badMesswerte } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";
import { createId } from "@paralleldrive/cuid2";

// Server-side actions for galvanik baths and bath measurements access.

export async function getBathsDb(): Promise<ActionResult<any[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const data = await db.select().from(baeder).orderBy(baeder.name);
    return { ok: true, data };
  } catch (error) {
    console.error("Failed to get baths from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Bäder", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getBathByIdDb(id: string): Promise<ActionResult<any | null>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const data = await db.select().from(baeder).where(eq(baeder.id, id)).limit(1);
    if (data.length === 0) return { ok: true, data: null };
    return { ok: true, data: data[0] };
  } catch (error) {
    console.error("Failed to get bath by ID from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden des Bades", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getBathMeasurementsDb(bathId?: string): Promise<ActionResult<any[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    let query = db.select().from(badMesswerte);
    
    if (bathId) {
      const data = await query.where(
        and(
          eq(badMesswerte.tenantId, "galvanik-kreile"),
          eq(badMesswerte.badId, bathId)
        )
      ).orderBy(desc(badMesswerte.measuredAt));
      return { ok: true, data };
    } else {
      const data = await query.where(
        eq(badMesswerte.tenantId, "galvanik-kreile")
      ).orderBy(desc(badMesswerte.measuredAt));
      return { ok: true, data };
    }
  } catch (error) {
    console.error("Failed to get bath measurements from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Messwerte", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function createBathMeasurementDb(payload: {
  bathId: string;
  temperature?: number | null;
  phValue?: number | null;
  notes?: string;
  measuredAt?: string;
}): Promise<ActionResult<any>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const newId = createId();
    const ts = payload.measuredAt ? new Date(payload.measuredAt) : new Date();

    const insertPayload = {
      id: newId,
      tenantId: "galvanik-kreile",
      badId: payload.bathId,
      temperature: payload.temperature !== undefined && payload.temperature !== null ? String(payload.temperature) : null,
      phValue: payload.phValue !== undefined && payload.phValue !== null ? String(payload.phValue) : null,
      notes: payload.notes || null,
      measuredAt: ts,
      createdAt: new Date(),
    };

    await db.insert(badMesswerte).values(insertPayload);
    return { ok: true, data: insertPayload };
  } catch (error) {
    console.error("Failed to create bath measurement in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Speichern des Messwerts", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function updateBathDb(id: string, payload: {
  status?: string;
  letzteWartung?: string;
}): Promise<ActionResult<any>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const updateData: Record<string, any> = {};
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.letzteWartung !== undefined) updateData.letzteWartung = payload.letzteWartung ? new Date(payload.letzteWartung) : null;

    if (Object.keys(updateData).length > 0) {
      await db.update(baeder).set(updateData).where(eq(baeder.id, id));
    }

    const updated = await db.select().from(baeder).where(eq(baeder.id, id)).limit(1);
    return { ok: true, data: updated[0] || null };
  } catch (error) {
    console.error("Failed to update bath in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Aktualisieren des Bades", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}
