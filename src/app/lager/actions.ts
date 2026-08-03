"use server";

import { db } from "@/db";
import { lagerArtikel } from "@/db/schema";
import { checkAppAuth } from "@/lib/server/authHelper";
import type { InferSelectModel } from "drizzle-orm";

export type LagerArtikel = InferSelectModel<typeof lagerArtikel>;
export type LagerbestandActionResult =
  | { ok: true; data: LagerArtikel[] }
  | { ok: false; error: string; message: string };

export async function getLagerbestandAction(): Promise<LagerbestandActionResult> {
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
