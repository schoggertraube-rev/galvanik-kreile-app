"use server";

import { db } from "@/db";
import { orders, uiEventsTable } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getTodayTopPriority() {
  try {
    const ordersList = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      title: orders.title,
    })
    .from(orders)
    .where(eq(orders.status, 'in_progress'))
    .orderBy(asc(orders.dueDate))
    .limit(1);

    if (ordersList.length > 0) {
      const o = ordersList[0];
      return {
        taskText: `Auftrag ${o.orderNumber} (${o.title}) abschließen.`,
        success: true
      };
    }
  } catch (error) {
    console.error("Error fetching top priority:", error);
  }

  // Fallback if no order found or error
  return {
    taskText: "Eilaufträge für den heutigen Versand abschließen.",
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

export async function notifyAdminPinReset(userId: string, userName: string) {
  try {
    await db.insert(uiEventsTable).values({
      tenantId: "galvanik-kreile",
      eventType: "pin_reset_requested",
      payload: { userId, userName, requestedAt: new Date().toISOString() },
    });
    return { success: true };
  } catch (error) {
    console.error("Error notifying admin:", error);
    return { success: false };
  }
}
