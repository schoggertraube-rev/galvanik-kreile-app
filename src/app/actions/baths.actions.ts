"use server";

import { db } from "@/db";
import { appUsers, baeder, badMesswerte } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";
import { createId } from "@paralleldrive/cuid2";
import { computeBathStatus, type BathStatus, type BathTargetValues } from "@/lib/baths/computeBathStatus";

// Server-side actions for galvanik baths and bath measurements access.

const TENANT_ID = "galvanik-kreile";
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const BATH_STATUSES: readonly BathStatus[] = ["critical", "watch", "stable", "not_evaluated"];

type BathActor = {
  tenantId: string;
  userId: string;
  displayName: string;
  canWrite: boolean;
};

export type BathRecord = typeof baeder.$inferSelect;
export type BathMeasurementRecord = typeof badMesswerte.$inferSelect & {
  measuredByDisplayName: string | null;
};
export type BathMeasurementReceipt = {
  bath: BathRecord;
  measurement: BathMeasurementRecord;
  status: BathStatus;
};

async function authorizeBaths(): Promise<ActionResult<BathActor>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "UNAUTHORIZED", message: "Anmeldung erforderlich." };
  if (authorization.data.tenantId !== TENANT_ID || !authorization.data.permissions.includes("perm_view_leitstand")) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung fÃ¼r Baddaten." };
  }
  return {
    ok: true,
    data: {
      tenantId: authorization.data.tenantId,
      userId: authorization.data.userId,
      displayName: authorization.data.displayName,
      canWrite: authorization.data.role !== "readonly",
    },
  };
}

function validEntityId(value: unknown): value is string {
  return typeof value === "string" && ENTITY_ID.test(value);
}

function finiteMeasurement(value: unknown, minimum: number, maximum: number): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error("INVALID_MEASUREMENT");
  }
  return value;
}

function boundedNote(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("INVALID_MEASUREMENT");
  const note = value.trim();
  if (note.length > 2_000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(note)) {
    throw new Error("INVALID_MEASUREMENT");
  }
  return note || null;
}

function targetValues(bath: BathRecord): BathTargetValues {
  const configured = bath.targetValues && typeof bath.targetValues === "object" && !Array.isArray(bath.targetValues)
    ? bath.targetValues as BathTargetValues
    : {};
  return {
    ...configured,
    temperatureMin: configured.temperatureMin ?? (bath.temperatureMin == null ? undefined : Number(bath.temperatureMin)),
    temperatureMax: configured.temperatureMax ?? (bath.temperatureMax == null ? undefined : Number(bath.temperatureMax)),
    phMin: configured.phMin ?? (bath.phMin == null ? undefined : Number(bath.phMin)),
    phMax: configured.phMax ?? (bath.phMax == null ? undefined : Number(bath.phMax)),
  };
}

export async function getBathsDb(): Promise<ActionResult<BathRecord[]>> {
  const actor = await authorizeBaths();
  if (!actor.ok) return actor;
  try {
    const data = await db
      .select()
      .from(baeder)
      .where(eq(baeder.tenantId, actor.data.tenantId))
      .orderBy(baeder.name);
    return { ok: true, data };
  } catch (error) {
    console.error("Failed to get baths from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Bäder", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getBathByIdDb(id: unknown): Promise<ActionResult<BathRecord | null>> {
  const actor = await authorizeBaths();
  if (!actor.ok) return actor;
  if (!validEntityId(id)) return { ok: false, error: "UNKNOWN", message: "UngÃ¼ltige Bad-ID." };
  try {
    const data = await db
      .select()
      .from(baeder)
      .where(and(eq(baeder.id, id), eq(baeder.tenantId, actor.data.tenantId)))
      .limit(1);
    if (data.length === 0) return { ok: true, data: null };
    return { ok: true, data: data[0] };
  } catch (error) {
    console.error("Failed to get bath by ID from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden des Bades", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getBathMeasurementsDb(bathId?: unknown): Promise<ActionResult<BathMeasurementRecord[]>> {
  const actor = await authorizeBaths();
  if (!actor.ok) return actor;
  if (bathId !== undefined && !validEntityId(bathId)) {
    return { ok: false, error: "UNKNOWN", message: "UngÃ¼ltige Bad-ID." };
  }
  try {
    const base = db
      .select({ measurement: badMesswerte, measuredByDisplayName: appUsers.fullName })
      .from(badMesswerte)
      .innerJoin(
        baeder,
        and(eq(badMesswerte.badId, baeder.id), eq(baeder.tenantId, actor.data.tenantId)),
      )
      .leftJoin(
        appUsers,
        and(
          eq(badMesswerte.measuredByUserId, appUsers.id),
          eq(badMesswerte.tenantId, appUsers.tenantId),
        ),
      );
    const rows = typeof bathId === "string"
      ? await base
          .where(and(eq(badMesswerte.tenantId, actor.data.tenantId), eq(badMesswerte.badId, bathId)))
          .orderBy(desc(badMesswerte.measuredAt))
      : await base
          .where(eq(badMesswerte.tenantId, actor.data.tenantId))
          .orderBy(desc(badMesswerte.measuredAt));
    return {
      ok: true,
      data: rows.map(({ measurement, measuredByDisplayName }) => ({
        ...measurement,
        measuredByDisplayName,
      })),
    };
  } catch (error) {
    console.error("Failed to get bath measurements from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Messwerte", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function recordBathMeasurementDb(payload: unknown): Promise<ActionResult<BathMeasurementReceipt>> {
  const actor = await authorizeBaths();
  if (!actor.ok) return actor;
  if (!actor.data.canWrite) return { ok: false, error: "FORBIDDEN", message: "Keine Schreibberechtigung fÃ¼r Badmessungen." };

  try {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("INVALID_MEASUREMENT");
    const value = payload as Record<string, unknown>;
    const allowed = ["bathId", "temperature", "phValue", "notes", "measuredAt"];
    if (Object.keys(value).some((key) => !allowed.includes(key)) || !validEntityId(value.bathId)) {
      throw new Error("INVALID_MEASUREMENT");
    }
    const temperature = finiteMeasurement(value.temperature, -50, 250);
    const phValue = finiteMeasurement(value.phValue, 0, 14);
    if (temperature === null && phValue === null) throw new Error("INVALID_MEASUREMENT");
    const notes = boundedNote(value.notes);
    const measuredAt = value.measuredAt === undefined ? new Date() : new Date(String(value.measuredAt));
    const now = Date.now();
    if (
      Number.isNaN(measuredAt.getTime())
      || measuredAt.getTime() > now + 5 * 60_000
      || measuredAt.getTime() < now - 30 * 24 * 60 * 60_000
    ) {
      throw new Error("INVALID_MEASUREMENT");
    }

    const receipt = await db.transaction(async (tx) => {
      const [bath] = await tx
        .select()
        .from(baeder)
        .where(and(eq(baeder.id, value.bathId as string), eq(baeder.tenantId, actor.data.tenantId)))
        .limit(1)
        .for("update");
      if (!bath) throw new Error("BATH_NOT_FOUND");

      const status = computeBathStatus({ temperature, ph: phValue }, targetValues(bath));
      const [measurement] = await tx
        .insert(badMesswerte)
        .values({
          id: createId(),
          tenantId: actor.data.tenantId,
          badId: bath.id,
          temperature: temperature === null ? null : String(temperature),
          phValue: phValue === null ? null : String(phValue),
          notes,
          statusAfterMeasurement: status,
          measuredByUserId: actor.data.userId,
          measuredAt,
          createdAt: new Date(),
        })
        .returning();
      const [updatedBath] = await tx
        .update(baeder)
        .set({ status, letzteWartung: measuredAt })
        .where(and(eq(baeder.id, bath.id), eq(baeder.tenantId, actor.data.tenantId)))
        .returning();
      if (!measurement || !updatedBath) throw new Error("WRITE_RECEIPT_MISSING");
      return {
        bath: updatedBath,
        measurement: { ...measurement, measuredByDisplayName: actor.data.displayName },
        status,
      };
    });
    return { ok: true, data: receipt };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_MEASUREMENT") return { ok: false, error: "UNKNOWN", message: "UngÃ¼ltige Badmessung." };
    if (code === "BATH_NOT_FOUND") return { ok: false, error: "EMPTY_RESULT", message: "Bad wurde nicht gefunden." };
    console.error("Failed to record bath measurement in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Badmessung konnte nicht gespeichert werden." };
  }
}

export async function createBathMeasurementDb(payload: unknown): Promise<ActionResult<BathMeasurementRecord>> {
  const result = await recordBathMeasurementDb(payload);
  return result.ok ? { ok: true, data: result.data.measurement } : result;
}

export async function updateBathDb(id: unknown, payload: unknown): Promise<ActionResult<BathRecord>> {
  const actor = await authorizeBaths();
  if (!actor.ok) return actor;
  if (!actor.data.canWrite) return { ok: false, error: "FORBIDDEN", message: "Keine Schreibberechtigung fÃ¼r Baddaten." };

  try {
    if (!validEntityId(id) || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("INVALID_BATH_UPDATE");
    }
    const value = payload as Record<string, unknown>;
    const allowed = ["status", "letzteWartung", "notes"];
    if (Object.keys(value).length === 0 || Object.keys(value).some((key) => !allowed.includes(key))) {
      throw new Error("INVALID_BATH_UPDATE");
    }
    const updateData: { status?: string; letzteWartung?: Date | null; notes?: string | null } = {};
    if (value.status !== undefined) {
      if (!BATH_STATUSES.includes(value.status as BathStatus)) throw new Error("INVALID_BATH_UPDATE");
      updateData.status = value.status as BathStatus;
    }
    if (value.letzteWartung !== undefined) {
      if (value.letzteWartung === null || value.letzteWartung === "") {
        updateData.letzteWartung = null;
      } else {
        const timestamp = new Date(String(value.letzteWartung));
        if (Number.isNaN(timestamp.getTime())) throw new Error("INVALID_BATH_UPDATE");
        updateData.letzteWartung = timestamp;
      }
    }
    if (value.notes !== undefined) updateData.notes = boundedNote(value.notes);

    const [updated] = await db
      .update(baeder)
      .set(updateData)
      .where(and(eq(baeder.id, id), eq(baeder.tenantId, actor.data.tenantId)))
      .returning();
    if (!updated) return { ok: false, error: "EMPTY_RESULT", message: "Bad wurde nicht gefunden." };
    return { ok: true, data: updated };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_BATH_UPDATE") {
      return { ok: false, error: "UNKNOWN", message: "UngÃ¼ltige BadÃ¤nderung." };
    }
    console.error("Failed to update bath in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Bad konnte nicht aktualisiert werden." };
  }
}
