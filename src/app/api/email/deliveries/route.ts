import { and, desc, eq, like } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { communications, orders } from "@/db/schema";
import { parseStatusEmailOrderId } from "@/lib/email/statusEmailContract";
import { resolveAuthorization } from "@/lib/server/authorization";
import { readStatusEmailLedgerCapability } from "@/lib/server/statusEmailCapability";

export const runtime = "nodejs";
const HISTORY_LIMIT = 20;
const DELIVERY_STATUSES = new Set([
  "queued", "sending", "sent", "delivered", "opened", "bounced", "complained", "failed", "uncertain",
]);

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return response({ ok: false, code: "UNAUTHORIZED" }, 401);
  if (
    authorization.data.tenantId !== "galvanik-kreile"
    || !authorization.data.permissions.includes("perm_data_customers")
    || !authorization.data.permissions.includes("perm_data_orders")
  ) return response({ ok: false, code: "FORBIDDEN" }, 403);

  let orderId: string;
  try {
    orderId = parseStatusEmailOrderId(new URL(request.url).searchParams.get("orderId"));
  } catch {
    return response({ ok: false, code: "INVALID_REQUEST" }, 400);
  }

  const capability = await readStatusEmailLedgerCapability();
  if (!capability.available) {
    return response({ ok: false, code: "CONFIGURATION_MISSING", reason: capability.reason }, 503);
  }

  try {
    const [order] = await db.select({ id: orders.id }).from(orders).where(and(
      eq(orders.id, orderId),
      eq(orders.tenantId, authorization.data.tenantId),
    )).limit(1);
    if (!order) return response({ ok: false, code: "NOT_FOUND" }, 404);

    const rows = await db.select({
      id: communications.id,
      status: communications.status,
      subject: communications.subject,
      createdAt: communications.createdAt,
      completedAt: communications.completedAt,
      providerMessageId: communications.resendMessageId,
      errorCode: communications.errorCode,
    }).from(communications).where(and(
      eq(communications.tenantId, authorization.data.tenantId),
      eq(communications.orderId, order.id),
      eq(communications.type, "email"),
      like(communications.templateKey, "status_%"),
    )).orderBy(desc(communications.createdAt), desc(communications.id)).limit(HISTORY_LIMIT + 1);

    const deliveries = rows.slice(0, HISTORY_LIMIT).map((row) => {
      const status = row.status || "";
      if (!DELIVERY_STATUSES.has(status) || !row.subject?.trim()) throw new Error("INVALID_DELIVERY_DATA");
      return {
        id: row.id,
        status,
        subject: row.subject.trim(),
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() || null,
        providerConfirmed: Boolean(row.providerMessageId),
        errorCode: row.errorCode || null,
      };
    });
    return response({
      ok: true,
      deliveries,
      limit: HISTORY_LIMIT,
      truncated: rows.length > HISTORY_LIMIT,
    });
  } catch (error) {
    console.error("Status email history unavailable", error);
    return response({ ok: false, code: "UNAVAILABLE" }, 503);
  }
}
