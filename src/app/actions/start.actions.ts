"use server";

import { db } from "@/db";
import { appUsers, orders, uiEventsTable } from "@/db/schema";
import { eq, asc, and, gte, sql } from "drizzle-orm";
import { verifyPinLoginSelector } from "@/lib/server/pinLoginSelector";
import { resolveAuthorization } from "@/lib/server/authorization";
import { canUsePinLoginRole, isAppRole } from "@/lib/auth/authorizationContract";

export async function getTodayTopPriority() {
  const auth = await resolveAuthorization();
  if (!auth.ok) {
    return {
      kind: "unauthorized" as const,
      taskText: null,
      dueAt: null,
      dueKind: null,
      success: false,
    };
  }
  try {
    const ordersList = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      title: orders.title,
      promisedDueDate: orders.promisedDueDate,
      dueDate: orders.dueDate,
    })
    .from(orders)
    .where(and(
      eq(orders.status, 'in_progress'),
      eq(orders.tenantId, auth.data.tenantId),
    ))
    .orderBy(sql`${orders.promisedDueDate} asc nulls last`, sql`${orders.dueDate} asc nulls last`, asc(orders.orderNumber))
    .limit(1);

    if (ordersList.length > 0) {
      const o = ordersList[0];
      const dueAt = o.promisedDueDate || o.dueDate || null;
      return {
        kind: "ready" as const,
        taskText: `Auftrag ${o.orderNumber} (${o.title}) abschließen.`,
        dueAt: dueAt?.toISOString() || null,
        dueKind: o.promisedDueDate ? "customer_promise" as const : o.dueDate ? "internal_due" as const : null,
        success: true
      };
    }
  } catch (error) {
    console.error("Error fetching top priority:", error);
    return {
      kind: "error" as const,
      taskText: null,
      dueAt: null,
      dueKind: null,
      success: false,
    };
  }

  return {
    kind: "empty" as const,
    taskText: null,
    dueAt: null,
    dueKind: null,
    success: false
  };
}

export async function getFeierabendEvents() {
  try {
    const res = await fetch('https://www.frankfurt-tipp.de/veranstaltungen.html', {
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    const html = await res.text();
    
    // Simple regex to find the first event title
    // Searching for <h3 itemprop="name">...</h3>
    const match = html.match(/<h3 itemprop="name">([^<]+)<\/h3>/);
    if (match && match[1]) {
      return {
        event: match[1].trim(),
        success: true
      };
    }
  } catch (error) {
    console.error("Error fetching events:", error);
  }

  // Fallback
  return {
    event: null,
    success: false
  };
}

export async function notifyAdminPinReset(selector: string) {
  try {
    const selected = await verifyPinLoginSelector(selector);
    if (!selected.ok) return { success: false };
    const [user] = await db.select({ id: appUsers.id, role: appUsers.role }).from(appUsers).where(and(
      eq(appUsers.id, selected.userId),
      eq(appUsers.tenantId, "galvanik-kreile"),
      eq(appUsers.active, true),
    ));
    if (!user || !isAppRole(user.role) || !canUsePinLoginRole(user.role)) return { success: false };
    const cooldownStart = new Date(Date.now() - 15 * 60 * 1000);
    const [existing] = await db.select({ id: uiEventsTable.id }).from(uiEventsTable).where(and(
      eq(uiEventsTable.tenantId, "galvanik-kreile"),
      eq(uiEventsTable.eventType, "pin_reset_requested"),
      gte(uiEventsTable.createdAt, cooldownStart),
      sql`${uiEventsTable.payload}->>'userId' = ${user.id}`,
    )).limit(1);
    if (existing) return { success: true, reason: "cooldown" };
    await db.insert(uiEventsTable).values({
      tenantId: "galvanik-kreile",
      eventType: "pin_reset_requested",
      payload: { userId: user.id, requestedAt: new Date().toISOString() },
    });
    return { success: true };
  } catch (error) {
    console.error("Error notifying admin:", error);
    return { success: false };
  }
}
