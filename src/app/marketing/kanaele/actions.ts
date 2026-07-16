"use server";

import { db } from "@/db";
import { kanal } from "@/db/schema_marketing";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMarketingRead, requireMarketingWrite } from '@/lib/server/marketingAuthorization';

export async function getKanaele() {
  await requireMarketingRead();
  return await db.select().from(kanal).orderBy(kanal.typ);
}

export async function updateKanalConfig(id: string, verbunden: boolean, config: unknown) {
  await requireMarketingWrite();
  if (verbunden) {
    throw new Error('MARKETING_CHANNEL_CONNECTION_MUST_BE_VERIFIED');
  }
  if (config !== null && (typeof config !== 'object' || Array.isArray(config))) {
    throw new Error('MARKETING_CHANNEL_CONFIG_INVALID');
  }
  const serialized = JSON.stringify(config || {});
  if (serialized.length > 16_384 || /token|secret|password/i.test(serialized)) {
    throw new Error('MARKETING_CHANNEL_CONFIG_SENSITIVE_OR_TOO_LARGE');
  }
  await db.update(kanal).set({
    verbunden: false,
    config,
    accessTokenEncrypted: null,
    status: 'nicht_verbunden'
  }).where(eq(kanal.id, id));
  
  revalidatePath("/marketing/kanaele");
}
