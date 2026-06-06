"use server";

import { db } from "@/db";
import { baeder, badMesswerte } from "@/db/schema";
import { checkAppAuth } from "@/lib/server/authHelper";
import { eq } from "drizzle-orm";

export async function getBaederListAction() {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: "AUTH_ERROR", message: auth.message };

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const baederRecords = await db.select().from(baeder).orderBy(baeder.name);
    const messwerteRecords = await db.select().from(badMesswerte);

    const enriched = baederRecords.map(b => {
      const bMesswerte = messwerteRecords.filter(m => m.badId === b.id).sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime());
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
