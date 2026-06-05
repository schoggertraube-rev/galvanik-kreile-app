"use server";

import { db } from "@/db";
import { kanal } from "@/db/schema_marketing";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getKanaele() {
  return await db.select().from(kanal).orderBy(kanal.typ);
}

export async function updateKanalConfig(id: string, verbunden: boolean, config: any) {
  await db.update(kanal).set({
    verbunden,
    config,
    status: verbunden ? 'verbunden' : 'fehler'
  }).where(eq(kanal.id, id));
  
  revalidatePath("/marketing/kanaele");
}
