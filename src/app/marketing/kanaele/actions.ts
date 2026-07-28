"use server";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

import { db } from "@/db";
import { kanal } from "@/db/schema_marketing";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getKanaele() {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  return await db.select().from(kanal).orderBy(kanal.typ);
}

export async function updateKanalConfig(id: string, verbunden: boolean, config: Record<string, unknown>) {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  await db.update(kanal).set({
    verbunden,
    config,
    status: verbunden ? 'verbunden' : 'fehler'
  }).where(eq(kanal.id, id));
  
  revalidatePath("/marketing/kanaele");
}
