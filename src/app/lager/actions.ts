"use server";

import { db } from "@/db";
import { lagerArtikel } from "@/db/schema";
import { checkAppAuth } from "@/lib/server/authHelper";

export async function getLagerbestandAction() {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: "AUTH_ERROR", message: auth.message };

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const artikel = await db.select().from(lagerArtikel).orderBy(lagerArtikel.name);

    return {
      ok: true,
      data: artikel
    };
  } catch (error) {
    console.error("Error in getLagerbestandAction:", error);
    return { ok: false, error: "QUERY_ERROR", message: String(error) };
  }
}
