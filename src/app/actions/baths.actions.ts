"use server";
import {deferredLegacyResult} from "@/lib/server/authHelper";
import type {baeder,badMesswerte} from "@/db/schema";
import type {ActionResult} from "@/lib/server/authHelper";
import type {InferSelectModel} from "drizzle-orm";
type Bath = InferSelectModel<typeof baeder>;

type BathMeasurement = InferSelectModel<typeof badMesswerte>;

export async function getBathsDb(): Promise<ActionResult<Bath[]>> {
  return deferredLegacyResult("auftraege");
}

export async function getBathByIdDb(id: string): Promise<ActionResult<Bath | null>> {
  void id;
  return deferredLegacyResult("auftraege");
}

export async function getBathMeasurementsDb(bathId?: string): Promise<ActionResult<BathMeasurement[]>> {
  void bathId;
  return deferredLegacyResult("auftraege");
}

export async function createBathMeasurementDb(payload: {
  bathId: string;
  temperature?: number | null;
  phValue?: number | null;
  notes?: string;
  measuredAt?: string;
}): Promise<ActionResult<BathMeasurement>> {
  void payload;
  return deferredLegacyResult("auftraege");
}

export async function updateBathDb(id: string, payload: {
  status?: string;
  letzteWartung?: string;
}): Promise<ActionResult<Bath | null>> {
  void id;
  void payload;
  return deferredLegacyResult("auftraege");
}
