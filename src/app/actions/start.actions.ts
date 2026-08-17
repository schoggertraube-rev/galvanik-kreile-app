"use server";

import { db } from "@/db";
import { appUsers, uiEventsTable } from "@/db/schema";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { APP_TENANT_ID } from "@/lib/server/appSession";
import {
  isValidPinLoginHandle,
  resolvePinLoginCandidate,
} from "@/lib/server/pinLoginHandle";

const RESET_EVENT_TYPE = "pin_reset_requested";
const RESET_RATE_LIMIT = 3;
const RESET_RATE_WINDOW_MS = 15 * 60 * 1000;

export async function getFeierabendEvents() {
  return {
    event: null,
    success: false
  };
}

export async function notifyAdminPinReset(loginHandle: string) {
  // Public login action: malformed, unknown and throttled targets deliberately
  // receive the same response so the endpoint cannot enumerate users.
  if (!isValidPinLoginHandle(loginHandle)) {
    return { success: true };
  }

  try {
    await db.transaction(async (tx) => {
      const candidates = await tx
        .select({ id: appUsers.id, fullName: appUsers.fullName })
        .from(appUsers)
        .where(
          and(
            eq(appUsers.tenantId, APP_TENANT_ID),
            eq(appUsers.active, true),
            ne(appUsers.role, "developer"),
          ),
        )
        .limit(32);
      const user = resolvePinLoginCandidate(loginHandle, candidates);

      if (!user) {
        return;
      }

      const throttleKey = `${APP_TENANT_ID}:${user.id}`;
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${throttleKey}, 0))`,
      );

      const windowStart = new Date(Date.now() - RESET_RATE_WINDOW_MS);
      const recentRequests = await tx
        .select({ payload: uiEventsTable.payload })
        .from(uiEventsTable)
        .where(
          and(
            eq(uiEventsTable.tenantId, APP_TENANT_ID),
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
        tenantId: APP_TENANT_ID,
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
