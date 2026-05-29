"use server";

import { db } from "@/db";
import { uiEventsTable } from "@/db/schema";
import { cookies, headers } from "next/headers";
import { createId } from "@paralleldrive/cuid2";

export async function logUiEvent(eventType: string, payload?: Record<string, unknown>): Promise<void> {
  try {
    if (!db) return;

    // Use default tenant_id for now as per app pattern
    const tenantId = "galvanik-kreile";
    
    // Generate session ID - simplest variant
    const sessionId = createId();

    await db.insert(uiEventsTable).values({
      id: createId(),
      tenantId,
      eventType,
      payload,
      sessionId,
    });
  } catch (error) {
    // Fail silently so tracking never breaks the UI
    console.error("Failed to log UI event:", error);
  }
}

export async function getRecentUiEvents() {
  if (!db) return [];
  try {
    const tenantId = "galvanik-kreile";
    
    const { desc, eq } = await import("drizzle-orm");
    
    return await db
      .select()
      .from(uiEventsTable)
      .where(eq(uiEventsTable.tenantId, tenantId))
      .orderBy(desc(uiEventsTable.createdAt))
      .limit(50);
  } catch (error) {
    console.error("Failed to fetch UI events:", error);
    return [];
  }
}
