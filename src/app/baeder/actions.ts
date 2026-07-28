"use server";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

import { db, isDatabaseConfigured } from "@/db";
import { baeder, badMesswerte } from "@/db/schema";
import { checkAppAuth } from "@/lib/server/authHelper";
import "drizzle-orm";

export async function getBaederListAction() {
  if (!isFoundationAreaEnabled("Bäder")) {
    return foundationUnavailableAction("Bäder");
  }
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: "AUTH_ERROR", message: auth.message };

  if (!isDatabaseConfigured()) return { ok: false, error: "DB_ERROR", message: "Database not available" };

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
