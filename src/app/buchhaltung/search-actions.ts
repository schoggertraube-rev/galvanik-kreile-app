"use server";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

import { db } from "@/db";
import { beleg } from "@/db/schema_buchhaltung";
import { ilike, or } from "drizzle-orm";

export async function searchBelegeByOcrTextAction(term: string) {
  if (!isFoundationAreaEnabled("Belegsuche")) {
    return foundationUnavailableAction("Belegsuche");
  }
  if (!term || term.length < 2) return [];

  try {
    const results = await db.select({
      id: beleg.id,
      lieferantText: beleg.lieferantText,
      brutto: beleg.brutto,
      belegdatum: beleg.belegdatum,
      ocrRohtext: beleg.ocrRohtext,
      belegart: beleg.belegart,
      status: beleg.status
    })
    .from(beleg)
    .where(
      or(
        ilike(beleg.ocrRohtext, `%${term}%`),
        ilike(beleg.lieferantText, `%${term}%`)
      )
    )
    .limit(5);

    return results;
  } catch (err) {
    console.error("searchBelegeByOcrTextAction Error:", err);
    return [];
  }
}
