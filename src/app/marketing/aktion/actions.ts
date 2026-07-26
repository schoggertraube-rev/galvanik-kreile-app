"use server";

import { db } from "@/db";
import { aktion, kanal, segment } from "@/db/schema_marketing";
import { and, eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMarketingRead, requireMarketingWrite } from '@/lib/server/marketingAuthorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getAktionen() {
  const actor = await requireMarketingRead();
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
    .leftJoin(kanal, and(
      eq(aktion.kanalId, kanal.id),
      eq(kanal.tenantId, actor.tenantId),
      eq(kanal.truthStatus, 'verified')
    ))
    .leftJoin(segment, and(
      eq(aktion.segmentId, segment.id),
      eq(segment.tenantId, actor.tenantId),
      eq(segment.truthStatus, 'verified')
    ))
    .where(and(
      eq(aktion.tenantId, actor.tenantId),
      eq(aktion.truthStatus, 'verified'),
      eq(aktion.isDemo, false)
    ))
    .orderBy(desc(aktion.erstelltAm));
  return data;
}

export async function getAktionById(id: string) {
  const actor = await requireMarketingRead();
  if (!UUID_PATTERN.test(id)) throw new Error('MARKETING_ACTION_ID_INVALID');
  const result = await db.select().from(aktion).where(and(
    eq(aktion.tenantId, actor.tenantId),
    eq(aktion.truthStatus, 'verified'),
    eq(aktion.isDemo, false),
    eq(aktion.id, id)
  )).limit(1);
  return result[0] || null;
}

export async function createAktion(formData: FormData) {
  const actor = await requireMarketingWrite();
  const clientRequestId = formData.get("clientRequestId")?.toString();
  const titel = formData.get("titel")?.toString();
  const typ = formData.get("typ")?.toString(); // post, mail, review_request
  const kanalId = formData.get("kanalId")?.toString();
  const segmentId = formData.get("segmentId")?.toString();
  const inhalt = formData.get("inhalt")?.toString();

  if (!clientRequestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)
    || !titel || titel.length > 200 || !typ || !['post', 'mail', 'review_request', 'ad'].includes(typ)
    || !kanalId || !UUID_PATTERN.test(kanalId)
    || (segmentId && !UUID_PATTERN.test(segmentId))
    || (inhalt?.length || 0) > 10_000) {
    throw new Error("Pflichtfelder fehlen oder sind ungültig");
  }

  const content = inhalt ? { text: inhalt } : null;
  const [targetChannel] = await db.select({ id: kanal.id }).from(kanal).where(and(
    eq(kanal.tenantId, actor.tenantId),
    eq(kanal.truthStatus, 'verified'),
    eq(kanal.id, kanalId)
  )).limit(1);
  if (!targetChannel) throw new Error('MARKETING_CHANNEL_NOT_FOUND');

  if (segmentId) {
    const [targetSegment] = await db.select({ id: segment.id }).from(segment).where(and(
    eq(segment.tenantId, actor.tenantId),
    eq(segment.truthStatus, 'verified'),
    eq(segment.isDemo, false),
      eq(segment.id, segmentId)
    )).limit(1);
    if (!targetSegment) throw new Error('MARKETING_SEGMENT_NOT_FOUND');
  }

  const result = await db.insert(aktion).values({
    id: clientRequestId,
    tenantId: actor.tenantId,
    truthStatus: 'verified',
    isDemo: false,
    titel,
    typ,
    kanalId,
    segmentId: segmentId || null,
    inhalt: content,
    status: "vorschlag"
  }).onConflictDoNothing({ target: aktion.id }).returning();

  if (!result[0]) {
    const [existing] = await db.select().from(aktion).where(and(
      eq(aktion.tenantId, actor.tenantId),
      eq(aktion.truthStatus, 'verified'),
      eq(aktion.isDemo, false),
      eq(aktion.id, clientRequestId)
    )).limit(1);
    const existingText = existing?.inhalt && typeof existing.inhalt === 'object' && !Array.isArray(existing.inhalt)
      ? (existing.inhalt as Record<string, unknown>).text
      : null;
    if (!existing
      || existing.titel !== titel
      || existing.typ !== typ
      || existing.kanalId !== kanalId
      || existing.segmentId !== (segmentId || null)
      || existingText !== (inhalt || null)
      || existing.status !== 'vorschlag') {
      throw new Error('MARKETING_ACTION_REQUEST_CONFLICT');
    }
    revalidatePath("/marketing/aktion");
    return existing;
  }

  revalidatePath("/marketing/aktion");
  return result[0];
}

export async function changeAktionStatus(id: string, newStatus: string) {
  const actor = await requireMarketingWrite();
  if (!UUID_PATTERN.test(id)) {
    throw new Error('MARKETING_ACTION_ID_INVALID');
  }
  const [target] = await db.select().from(aktion).where(and(
    eq(aktion.tenantId, actor.tenantId),
    eq(aktion.truthStatus, 'verified'),
    eq(aktion.isDemo, false),
    eq(aktion.id, id)
  )).limit(1);
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
  }).where(and(
    eq(aktion.tenantId, actor.tenantId),
    eq(aktion.truthStatus, 'verified'),
    eq(aktion.isDemo, false),
    eq(aktion.id, id),
    eq(aktion.status, target.status)
  )).returning({
    id: aktion.id,
    status: aktion.status,
  });
  if (!updated) throw new Error('MARKETING_ACTION_STATUS_CONFLICT');

  revalidatePath("/marketing/aktion");
  revalidatePath(`/marketing/aktion/${id}`);
  return updated;
}
