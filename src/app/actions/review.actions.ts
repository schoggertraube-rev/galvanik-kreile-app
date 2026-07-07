"use server";

import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";

export async function saveScanReview(scanId: string, updatedData: Record<string, unknown>) {
  try {
    const auth = await resolveAuthorization();
    if (!auth.ok) {
      return { error: "Nicht autorisiert" };
    }

    const { tenantId, userId } = auth.data;

    const result = await db
      .update(scanUploads)
      .set({
        extractedData: updatedData,
        reviewRequired: false,
        reviewedAt: new Date(),
        reviewedBy: userId,
      })
      .where(and(eq(scanUploads.id, scanId), eq(scanUploads.tenantId, tenantId)))
      .returning({ id: scanUploads.id });

    if (!result || result.length === 0) {
      return { error: "Scan nicht gefunden oder Zugriff verweigert" };
    }

    return { success: true, id: result[0].id };
  } catch (error: unknown) {
    console.error("saveScanReview error:", error);
    return { error: error instanceof Error ? error.message : "Interner Fehler beim Speichern des Reviews" };
  }
}
