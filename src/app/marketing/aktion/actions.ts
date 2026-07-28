"use server";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

import { db } from "@/db";
import { aktion, touchpoint, kanal, segment } from "@/db/schema_marketing";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getAktionen() {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
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
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  const result = await db.select().from(aktion).where(eq(aktion.id, id)).limit(1);
  return result[0] || null;
}

export async function createAktion(formData: FormData) {
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  const titel = formData.get("titel")?.toString();
  const typ = formData.get("typ")?.toString(); // post, mail, review_request
  const kanalId = formData.get("kanalId")?.toString();
  const segmentId = formData.get("segmentId")?.toString();
  const inhalt = formData.get("inhalt")?.toString();

  if (!titel || !typ || !kanalId) throw new Error("Pflichtfelder fehlen");

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
  if (!isFoundationAreaEnabled("Marketing")) {
    return foundationUnavailableAction("Marketing");
  }
  const target = await getAktionById(id);
  if (!target) throw new Error("Aktion nicht gefunden");

  // Status transitions: vorschlag -> freigegeben -> ausgefuehrt
  if (newStatus === "ausgefuehrt" && target.status !== "ausgefuehrt") {
    // Erzeuge Touchpoint
    await db.insert(touchpoint).values({
      aktionId: id,
      kanalId: target.kanalId,
      externeRef: `akt-${id.substring(0,8)}`,
      utmCampaign: target.titel.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    });
  }

  await db.update(aktion).set({
    status: newStatus,
    ...(newStatus === "ausgefuehrt" ? { ausgefuehrtAm: new Date() } : {})
  }).where(eq(aktion.id, id));

  revalidatePath("/marketing/aktion");
  revalidatePath(`/marketing/aktion/${id}`);
}
