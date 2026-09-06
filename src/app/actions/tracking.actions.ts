"use server";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

import { db } from "@/db";
import { uiEventsTable } from "@/db/schema";
import { requireAdminOrDeveloper } from "@/lib/auth/permissions";

interface UiEventPayload {
  event_type: string;
  route?: string;
  target?: string;
  meta?: Record<string, unknown>;
  device?: string;
  session_id?: string;
  occurred_at?: string;
}

export type UiTrackingDenial = {
  ok: false;
  error: "NOT_AVAILABLE";
  message: "NOT_AVAILABLE: UI-Tracking benötigt den W3-Command-Vertrag.";
};

function getPayloadText(value: unknown, fallback: string): string {
  return value ? String(value) : fallback;
}

export async function logUiEvent(event: UiEventPayload): Promise<UiTrackingDenial> {
  void event;
  return {
    ok: false,
    error: "NOT_AVAILABLE",
    message: "NOT_AVAILABLE: UI-Tracking benötigt den W3-Command-Vertrag.",
  };
}

export async function getRecentUiEvents() {
  await requireAdminOrDeveloper();
  if (!db) return [];
  try {
    const tenantId = KREILE_TENANT_SLUG;
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

export async function getRealAnalyticsStats() {
  await requireAdminOrDeveloper();
  
  if (!db) return { topEvents: [], activityData: [], recentEvents: [] };
  try {
    const tenantId = KREILE_TENANT_SLUG;
    const { desc, eq } = await import("drizzle-orm");
    
    const allEvents = await db
      .select()
      .from(uiEventsTable)
      .where(eq(uiEventsTable.tenantId, tenantId))
      .orderBy(desc(uiEventsTable.createdAt))
      .limit(500); // Analyze up to 500 recent events
      
    // Simple aggregation for top events
    const eventCounts: Record<string, number> = {};
    const activityCounts: Record<string, number> = {};
    
    allEvents.forEach(evt => {
      // Top Events (by type + route/target)
      const payload = evt.payload;
      const route = getPayloadText(payload?.route, getPayloadText(payload?.target, "unknown"));
      const key = `${evt.eventType} : ${route}`;
      eventCounts[key] = (eventCounts[key] || 0) + 1;
      
      // Activity by date (last 7 days approx, just grouping by date string)
      const dateStr = evt.createdAt.toISOString().split("T")[0];
      activityCounts[dateStr] = (activityCounts[dateStr] || 0) + 1;
    });
    
    const topEvents = Object.entries(eventCounts)
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
      
    const activityData = Object.entries(activityCounts)
      .map(([date, count]) => ({ date, events: count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
      
    const recentEvents = allEvents.slice(0, 20).map(e => {
       const p = e.payload;
       return {
         id: e.id,
         time: new Date(e.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute:'2-digit', second:'2-digit' }),
         type: e.eventType,
          user: getPayloadText(p?.actor_initials, "Anonym"),
          role: getPayloadText(p?.actor_role, "-"),
          detail: getPayloadText(p?.route, getPayloadText(p?.target, JSON.stringify(p?.meta || {})))
       };
    });

    return {
      topEvents,
      activityData,
      recentEvents,
      lastActive: recentEvents.length > 0 ? recentEvents[0].time : "Nie"
    };
  } catch (error) {
    console.error("Failed to aggregate UI events:", error);
    return { topEvents: [], activityData: [], recentEvents: [] };
  }
}
