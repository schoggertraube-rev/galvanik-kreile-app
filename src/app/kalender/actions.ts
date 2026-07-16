"use server";

import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents } from "@/db/schema";
import { resolveAuthorization } from "@/lib/server/authorization";

export async function listCalendarEventsAction(fromIso: string, toIso: string) {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false as const, message: authorization.message };
  if (!authorization.data.permissions.includes("perm_view_leitstand")) {
    return { ok: false as const, message: "Keine Berechtigung für betriebliche Termine." };
  }

  const from = new Date(fromIso);
  const to = new Date(toIso);
  const duration = to.getTime() - from.getTime();
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || duration <= 0 || duration > 40 * 86_400_000) {
    return { ok: false as const, message: "Ungültiger Kalenderzeitraum." };
  }

  try {
    const data = await db
      .select({
        id: calendarEvents.id,
        orderId: calendarEvents.orderId,
        customerId: calendarEvents.customerId,
        title: calendarEvents.title,
        eventType: calendarEvents.eventType,
        startsAt: calendarEvents.startsAt,
        endsAt: calendarEvents.endsAt,
        timeSlot: calendarEvents.timeSlot,
        status: calendarEvents.status,
        source: calendarEvents.source,
      })
      .from(calendarEvents)
      .where(and(
        eq(calendarEvents.tenantId, authorization.data.tenantId),
        gte(calendarEvents.startsAt, from),
        lt(calendarEvents.startsAt, to),
        sql`coalesce(${calendarEvents.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`,
      ))
      .orderBy(asc(calendarEvents.startsAt))
      .limit(200);
    return { ok: true as const, data };
  } catch (error) {
    console.error("calendar events query failed", error);
    return { ok: false as const, message: "Betriebliche Termine konnten nicht geladen werden." };
  }
}
