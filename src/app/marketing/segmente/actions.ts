"use server";

import { db } from "@/db";
import { segment } from "@/db/schema_marketing";
import { eq, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMarketingRead, requireMarketingWrite } from '@/lib/server/marketingAuthorization';

export async function getSegments(query?: string) {
  await requireMarketingRead();
  if (query && query.length > 100) throw new Error('MARKETING_SEGMENT_QUERY_TOO_LONG');
  if (query) {
    return await db.select().from(segment).where(ilike(segment.name, `%${query}%`)).orderBy(segment.name);
  }
  return await db.select().from(segment).orderBy(segment.name);
}

export async function getSegmentById(id: string) {
  await requireMarketingRead();
  const result = await db.select().from(segment).where(eq(segment.id, id)).limit(1);
  return result[0] || null;
}

export async function createSegment(formData: FormData) {
  await requireMarketingWrite();
  const name = formData.get("name")?.toString();
  const icon = formData.get("icon")?.toString() || "";
  const farbe = formData.get("farbe")?.toString() || "#e91e63";
  const beschreibung = formData.get("beschreibung")?.toString() || "";
  
  if (!name || name.length > 120 || icon.length > 20 || beschreibung.length > 2_000 || !/^#[0-9a-f]{6}$/i.test(farbe)) {
    throw new Error("Name is required");
  }

  const result = await db.insert(segment).values({
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
  await requireMarketingWrite();
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
  }).where(eq(segment.id, id)).returning();

  revalidatePath("/marketing/segmente");
  revalidatePath(`/marketing/segmente/${id}`);
  return result[0];
}

export async function deleteSegment(id: string) {
  await requireMarketingWrite();
  void id;
  throw new Error('MARKETING_SEGMENT_DELETE_REQUIRES_ARCHIVE_WORKFLOW');
}
