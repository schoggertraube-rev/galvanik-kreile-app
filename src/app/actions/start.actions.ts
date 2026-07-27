"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { appUsers, orders } from "@/db/schema";
import { eq, asc, and, sql } from "drizzle-orm";
import { verifyPinLoginSelector } from "@/lib/server/pinLoginSelector";
import { resolveAuthorization } from "@/lib/server/authorization";
import { canUsePinLoginRole, isAppRole } from "@/lib/auth/authorizationContract";
import { securityRateLimitSubjectHash } from "@/lib/server/durableRateLimit";

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

type PinResetRequestState = {
  allowed: boolean;
  retry_after_seconds: number | string | null;
  recorded: boolean;
};

export async function requestAdminPinReset(selector: string) {
  try {
    const selected = await verifyPinLoginSelector(selector);
    if (!selected.ok) return { success: false as const, kind: "unavailable" as const };
    const [user] = await db.select({ id: appUsers.id, role: appUsers.role }).from(appUsers).where(and(
      eq(appUsers.id, selected.userId),
      eq(appUsers.tenantId, "galvanik-kreile"),
      eq(appUsers.active, true),
    ));
    if (!user || !isAppRole(user.role) || !canUsePinLoginRole(user.role)) {
      return { success: false as const, kind: "unavailable" as const };
    }

    const tenantId = "galvanik-kreile";
    const namespace = "pin-reset-request";
    const subjectHash = securityRateLimitSubjectHash(namespace, `${tenantId}:${user.id}`);
    const requestId = randomUUID();
    const rows = await db.execute(sql<PinResetRequestState>`
      with decision as (
        select allowed, retry_after_seconds
        from public.consume_security_rate_limit(
          ${namespace},
          ${subjectHash},
          1,
          900
        )
      ),
      recorded as (
        insert into public.audit_log (
          tenant_id,
          client_request_id,
          action,
          table_name,
          record_id,
          actor_id,
          payload
        )
        select
          ${tenantId},
          ${requestId}::uuid,
          'pin_reset_request_recorded',
          'app_users',
          ${user.id}::text,
          null::uuid,
          null::jsonb
        from decision
        where decision.allowed
        returning 1
      )
      select
        decision.allowed,
        decision.retry_after_seconds,
        exists(select 1 from recorded) as recorded
      from decision
    `);
    const state = rows[0];
    if (!state || typeof state.allowed !== "boolean" || typeof state.recorded !== "boolean") {
      throw new Error("PIN_RESET_REQUEST_STATE_INVALID");
    }
    if (!state.allowed) {
      const retryAfterSeconds = Number(state.retry_after_seconds);
      return {
        success: true as const,
        kind: "cooldown" as const,
        retryAfterSeconds: Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds
          : 900,
      };
    }
    if (!state.recorded) throw new Error("PIN_RESET_REQUEST_NOT_RECORDED");
    return { success: true as const, kind: "recorded" as const };
  } catch (error) {
    console.error("Error recording PIN reset request:", error);
    return { success: false as const, kind: "unavailable" as const };
  }
}
