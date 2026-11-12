"use server";
import {deferredLegacyResult} from "@/lib/server/authHelper";
import type {baeder,badMesswerte} from "@/db/schema";
import type {InferSelectModel} from "drizzle-orm";
export type Bad = InferSelectModel<typeof baeder>;

export type BadMesswert = InferSelectModel<typeof badMesswerte>;

export type BaederListItem = Bad & { messwerte: BadMesswert[] };

export type BaederListActionResult =
  | { ok: true; data: BaederListItem[] }
  | { ok: false; error: string; message: string };

export async function getBaederListAction(): Promise<BaederListActionResult> {
  return deferredLegacyResult("auftraege");
}
