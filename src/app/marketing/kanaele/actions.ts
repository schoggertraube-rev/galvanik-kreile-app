"use server";
import {rejectDeferredLegacy} from "@/lib/server/authHelper";


import { db } from "@/db";
import { kanal } from "@/db/schema_marketing";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getKanaele() {
  await rejectDeferredLegacy("geld");

  return await db.select().from(kanal).orderBy(kanal.typ);
}

export async function updateKanalConfig(id: string, verbunden: boolean, config: Record<string, unknown>) {
  await rejectDeferredLegacy("geld");

  throw new Error("NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.");

  await db.update(kanal).set({
    verbunden,
    config,
    status: verbunden ? 'verbunden' : 'fehler'
  }).where(eq(kanal.id, id));
  
  revalidatePath("/marketing/kanaele");
}
