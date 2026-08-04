"use server";

import { db } from "@/db";
import { segment } from "@/db/schema_marketing";
import { eq, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getSegments(query?: string) {
  if (query) {
    return await db.select().from(segment).where(ilike(segment.name, `%${query}%`)).orderBy(segment.name);
  }
  return await db.select().from(segment).orderBy(segment.name);
}

export async function getSegmentById(id: string) {
  const result = await db.select().from(segment).where(eq(segment.id, id)).limit(1);
  return result[0] || null;
}

export async function createSegment(formData: FormData) {
  const name = formData.get("name")?.toString();
  const icon = formData.get("icon")?.toString() || "";
  const farbe = formData.get("farbe")?.toString() || "#e91e63";
  const beschreibung = formData.get("beschreibung")?.toString() || "";
  
  if (!name) {
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
  const name = formData.get("name")?.toString();
  const icon = formData.get("icon")?.toString() || "";
  const farbe = formData.get("farbe")?.toString() || "#e91e63";
  const beschreibung = formData.get("beschreibung")?.toString() || "";
  
  if (!name) {
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
  const target = await getSegmentById(id);
  if (target?.isDemo === false) {
    // Only true demo items could be deleted if we want to restrict, 
    // but the spec says "Bestandssegmente ... nicht löschbar". 
    // Let's protect Oldtimer, Schmuck, etc. from deletion by Name or checking isDemo.
    const protectedNames = ['Oldtimer', 'Schmuck', 'Besteck/Silber', 'Kirchen', 'Museen', 'Geschäftskunden', 'Privatkunden'];
    if (protectedNames.includes(target.name)) {
      throw new Error("Bestandssegmente können nicht gelöscht werden.");
    }
  }

  await db.delete(segment).where(eq(segment.id, id));
  revalidatePath("/marketing/segmente");
}
