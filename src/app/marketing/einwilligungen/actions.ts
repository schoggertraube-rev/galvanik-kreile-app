"use server";

import { db } from "@/db";
import { einwilligung } from "@/db/schema_marketing";
import { customers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function getEinwilligungen() {
  const data = await db
    .select({
      id: einwilligung.id,
      kundeId: einwilligung.kundeId,
      kundeName: customers.name,
      kundeEmail: customers.email,
      kanal: einwilligung.kanal,
      status: einwilligung.status,
      quelle: einwilligung.quelle,
      zeitpunkt: einwilligung.zeitpunkt,
    })
    .from(einwilligung)
    .leftJoin(customers, eq(einwilligung.kundeId, customers.id))
    .orderBy(desc(einwilligung.zeitpunkt));
  return data;
}

export async function checkEinwilligung(kundeId: string, kanalTyp: string): Promise<boolean> {
  const result = await db
    .select({ status: einwilligung.status })
    .from(einwilligung)
    .where(
      and(
        eq(einwilligung.kundeId, kundeId),
        eq(einwilligung.kanal, kanalTyp)
      )
    )
    .orderBy(desc(einwilligung.zeitpunkt))
    .limit(1);

  if (!result || result.length === 0) return false;
  return result[0].status === "erteilt";
}
