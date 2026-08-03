"use server";

import { db } from "@/db";
import { baeder, badMesswerte } from "@/db/schema";
import { checkAppAuth } from "@/lib/server/authHelper";
import type { InferSelectModel } from "drizzle-orm";

export type Bad = InferSelectModel<typeof baeder>;
export type BadMesswert = InferSelectModel<typeof badMesswerte>;
export type BaederListItem = Bad & { messwerte: BadMesswert[] };
export type BaederListActionResult =
  | { ok: true; data: BaederListItem[] }
  | { ok: false; error: string; message: string };

export async function getBaederListAction(): Promise<BaederListActionResult> {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: "AUTH_ERROR", message: auth.message };

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const baederRecords = await db.select().from(baeder).orderBy(baeder.name);
    const messwerteRecords = await db.select().from(badMesswerte);

    const enriched = baederRecords.map(b => {
      const bMesswerte = messwerteRecords.filter(m => m.badId === b.id).sort((x, y) => {
        const t1 = y.measuredAt ? new Date(y.measuredAt).getTime() : 0;
        const t2 = x.measuredAt ? new Date(x.measuredAt).getTime() : 0;
        return t1 - t2;
      });
      return {
        ...b,
        messwerte: bMesswerte
      };
    });

    return {
      ok: true,
      data: enriched
    };
  } catch (error) {
    console.error("Error in getBaederListAction:", error);
    return { ok: false, error: "QUERY_ERROR", message: String(error) };
  }
}
