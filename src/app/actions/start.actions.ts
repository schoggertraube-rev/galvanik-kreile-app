"use server";

import { db } from "@/db";
import { appUsers, uiEventsTable } from "@/db/schema";
import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { PIN_LOGIN_ROLES } from "@/lib/auth/pinPolicy";

const TENANT_ID = "galvanik-kreile";
const RESET_EVENT_TYPE = "pin_reset_requested";
const RESET_RATE_LIMIT = 3;
const RESET_RATE_WINDOW_MS = 15 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function notifyAdminPinReset(userId: string) {
  // Public login action: malformed, unknown and throttled targets deliberately
  // receive the same response so the endpoint cannot enumerate users.
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
    return { success: true };
  }

  const canonicalUserId = userId.toLowerCase();

  try {
    await db.transaction(async (tx) => {
      const throttleKey = `${TENANT_ID}:${canonicalUserId}`;
      const lockRows = await tx.execute<{ acquired: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${throttleKey}, 0)) AS acquired`,
      );
      if (!lockRows[0]?.acquired) return;

      const [user] = await tx
        .select({ id: appUsers.id, fullName: appUsers.fullName })
        .from(appUsers)
        .where(
          and(
            eq(appUsers.id, canonicalUserId),
            eq(appUsers.tenantId, TENANT_ID),
            eq(appUsers.active, true),
            inArray(appUsers.role, [...PIN_LOGIN_ROLES]),
            isNotNull(appUsers.pinHash),
          ),
        )
        .limit(1);

      if (!user) {
        return;
      }

      const windowStart = new Date(Date.now() - RESET_RATE_WINDOW_MS);
      const recentRequests = await tx
        .select({ payload: uiEventsTable.payload })
        .from(uiEventsTable)
        .where(
          and(
            eq(uiEventsTable.tenantId, TENANT_ID),
            eq(uiEventsTable.eventType, RESET_EVENT_TYPE),
            gte(uiEventsTable.createdAt, windowStart),
            sql`${uiEventsTable.payload}->>'userId' = ${user.id}`,
          ),
        )
        .limit(RESET_RATE_LIMIT);

      if (recentRequests.length >= RESET_RATE_LIMIT) {
        return;
      }

      await tx.insert(uiEventsTable).values({
        tenantId: TENANT_ID,
        eventType: RESET_EVENT_TYPE,
        payload: {
          userId: user.id,
          userName: user.fullName,
          requestedAt: new Date().toISOString(),
        },
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Error notifying admin:", error);
    return { success: false };
  }
}
