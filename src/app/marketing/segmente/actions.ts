"use server";

import { db } from "@/db";
import { segment } from "@/db/schema_marketing";
import { and, eq, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMarketingRead, requireMarketingWrite } from '@/lib/server/marketingAuthorization';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getSegments(query?: string) {
  const actor = await requireMarketingRead();
  if (query && query.length > 100) throw new Error('MARKETING_SEGMENT_QUERY_TOO_LONG');
  if (query) {
    return await db.select().from(segment).where(and(
      eq(segment.tenantId, actor.tenantId),
      eq(segment.truthStatus, 'verified'),
      eq(segment.isDemo, false),
      ilike(segment.name, `%${query}%`)
    )).orderBy(segment.name);
  }
  return await db.select().from(segment)
    .where(and(
      eq(segment.tenantId, actor.tenantId),
      eq(segment.truthStatus, 'verified'),
      eq(segment.isDemo, false)
    ))
    .orderBy(segment.name);
}

export async function getSegmentById(id: string) {
  const actor = await requireMarketingRead();
  if (!UUID_PATTERN.test(id)) throw new Error('MARKETING_SEGMENT_ID_INVALID');
  const result = await db.select().from(segment).where(and(
    eq(segment.tenantId, actor.tenantId),
    eq(segment.truthStatus, 'verified'),
    eq(segment.isDemo, false),
    eq(segment.id, id)
  )).limit(1);
  return result[0] || null;
}

export async function createSegment(formData: FormData) {
  const actor = await requireMarketingWrite();
  const name = formData.get("name")?.toString();
  const icon = formData.get("icon")?.toString() || "";
  const farbe = formData.get("farbe")?.toString() || "#e91e63";
  const beschreibung = formData.get("beschreibung")?.toString() || "";
  
  if (!name || name.length > 120 || icon.length > 20 || beschreibung.length > 2_000 || !/^#[0-9a-f]{6}$/i.test(farbe)) {
    throw new Error("Name is required");
  }

  const result = await db.insert(segment).values({
    tenantId: actor.tenantId,
    truthStatus: 'verified',
    name,
    icon,
    farbe,
    beschreibung,
    isDemo: false
  }).returning();

  revalidatePath("/marketing/segmente");
  return result[0];
}

export async function updateSegment(id: string, formData: FormData) {
  const actor = await requireMarketingWrite();
  if (!UUID_PATTERN.test(id)) throw new Error('MARKETING_SEGMENT_ID_INVALID');
  const name = formData.get("name")?.toString();
  const icon = formData.get("icon")?.toString() || "";
  const farbe = formData.get("farbe")?.toString() || "#e91e63";
  const beschreibung = formData.get("beschreibung")?.toString() || "";
  
  if (!name || name.length > 120 || icon.length > 20 || beschreibung.length > 2_000 || !/^#[0-9a-f]{6}$/i.test(farbe)) {
    throw new Error("Name is required");
  }

  const result = await db.update(segment).set({
    name,
    icon,
    farbe,
    beschreibung,
  }).where(and(
    eq(segment.tenantId, actor.tenantId),
    eq(segment.truthStatus, 'verified'),
    eq(segment.isDemo, false),
    eq(segment.id, id)
  )).returning();
  if (!result[0]) throw new Error('MARKETING_SEGMENT_NOT_FOUND');

  revalidatePath("/marketing/segmente");
  revalidatePath(`/marketing/segmente/${id}`);
  return result[0];
}

export async function deleteSegment(id: string) {
  await requireMarketingWrite();
  void id;
  throw new Error('MARKETING_SEGMENT_DELETE_REQUIRES_ARCHIVE_WORKFLOW');
}
