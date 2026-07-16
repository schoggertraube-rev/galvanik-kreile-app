"use server";

import { db } from "@/db";
import { aktion, kanal, segment } from "@/db/schema_marketing";
import { and, eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMarketingRead, requireMarketingWrite } from '@/lib/server/marketingAuthorization';

export async function getAktionen() {
  await requireMarketingRead();
  const data = await db
    .select({
      id: aktion.id,
      titel: aktion.titel,
      typ: aktion.typ,
      status: aktion.status,
      kanalName: kanal.name,
      segmentName: segment.name,
      erstelltAm: aktion.erstelltAm
    })
    .from(aktion)
    .leftJoin(kanal, eq(aktion.kanalId, kanal.id))
    .leftJoin(segment, eq(aktion.segmentId, segment.id))
    .orderBy(desc(aktion.erstelltAm));
  return data;
}

export async function getAktionById(id: string) {
  await requireMarketingRead();
  const result = await db.select().from(aktion).where(eq(aktion.id, id)).limit(1);
  return result[0] || null;
}

export async function createAktion(formData: FormData) {
  await requireMarketingWrite();
  const titel = formData.get("titel")?.toString();
  const typ = formData.get("typ")?.toString(); // post, mail, review_request
  const kanalId = formData.get("kanalId")?.toString();
  const segmentId = formData.get("segmentId")?.toString();
  const inhalt = formData.get("inhalt")?.toString();

  if (!titel || titel.length > 200 || !typ || !['post', 'mail', 'review_request', 'ad'].includes(typ) || !kanalId || (inhalt?.length || 0) > 10_000) {
    throw new Error("Pflichtfelder fehlen oder sind ungültig");
  }

  const result = await db.insert(aktion).values({
    titel,
    typ,
    kanalId,
    segmentId: segmentId || null,
    inhalt: inhalt ? { text: inhalt } : null,
    status: "vorschlag"
  }).returning();

  revalidatePath("/marketing/aktion");
  return result[0];
}

export async function changeAktionStatus(id: string, newStatus: string) {
  const actor = await requireMarketingWrite();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('MARKETING_ACTION_ID_INVALID');
  }
  const [target] = await db.select().from(aktion).where(eq(aktion.id, id)).limit(1);
  if (!target) throw new Error("Aktion nicht gefunden");

  const transitions: Record<string, readonly string[]> = {
    vorschlag: ['geplant', 'freigegeben'],
    geplant: ['freigegeben'],
    freigegeben: ['fehler'],
    fehler: ['freigegeben'],
    ausgefuehrt: [],
  };
  if (!transitions[target.status]?.includes(newStatus)) {
    throw new Error('MARKETING_ACTION_STATUS_TRANSITION_INVALID');
  }

  const [updated] = await db.update(aktion).set({
    status: newStatus,
    freigegebenVon: newStatus === 'freigegeben' ? actor.userId : target.freigegebenVon,
  }).where(and(eq(aktion.id, id), eq(aktion.status, target.status))).returning({
    id: aktion.id,
    status: aktion.status,
  });
  if (!updated) throw new Error('MARKETING_ACTION_STATUS_CONFLICT');

  revalidatePath("/marketing/aktion");
  revalidatePath(`/marketing/aktion/${id}`);
  return updated;
}
