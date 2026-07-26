"use server";

import { db } from "@/db";
import { kanal } from "@/db/schema_marketing";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMarketingRead, requireMarketingWrite } from '@/lib/server/marketingAuthorization';

export async function getKanaele() {
  const actor = await requireMarketingRead();
  return await db.select().from(kanal)
    .where(and(
      eq(kanal.tenantId, actor.tenantId),
      eq(kanal.truthStatus, 'verified')
    ))
    .orderBy(kanal.typ);
}

export async function updateKanalConfig(id: string, verbunden: boolean, config: unknown) {
  const actor = await requireMarketingWrite();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('MARKETING_CHANNEL_ID_INVALID');
  }
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
  const [updated] = await db.update(kanal).set({
    verbunden: false,
    config,
    accessTokenEncrypted: null,
    status: 'nicht_verbunden'
  }).where(and(
    eq(kanal.tenantId, actor.tenantId),
    eq(kanal.truthStatus, 'verified'),
    eq(kanal.id, id)
  )).returning({ id: kanal.id });
  if (!updated) throw new Error('MARKETING_CHANNEL_NOT_FOUND');
  
  revalidatePath("/marketing/kanaele");
}
