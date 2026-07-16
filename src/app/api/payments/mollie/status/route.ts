import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { isValidMolliePaymentId } from "@/lib/payments/mollieClientContract";
import { resolveAuthorization } from "@/lib/server/authorization";

function boundedStatus(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 80 ? normalized : null;
}

export async function GET(request: Request) {
  const auth = await resolveAuthorization();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    auth.data.tenantId !== "galvanik-kreile"
    || !auth.data.permissions.includes("perm_view_prices")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  if (
    [...url.searchParams.keys()].some((key) => key !== "intentId")
    || url.searchParams.getAll("intentId").length !== 1
  ) {
    return NextResponse.json({ error: "Only intentId is accepted" }, { status: 400 });
  }
  const intentId = url.searchParams.get("intentId");
  if (!isValidMolliePaymentId(intentId)) {
    return NextResponse.json({ error: "Invalid intentId" }, { status: 400 });
  }

  const rows = await db.select({
    status: payments.status,
    providerStatus: payments.mollieStatus,
  }).from(payments).where(and(
    eq(payments.tenantId, auth.data.tenantId),
    eq(payments.providerIntentId, intentId),
  )).limit(2);

  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rows.length !== 1) return NextResponse.json({ error: "Payment identity conflict" }, { status: 409 });
  const status = boundedStatus(rows[0].status);
  const providerStatus = boundedStatus(rows[0].providerStatus);
  if (!status || (rows[0].providerStatus !== null && !providerStatus)) {
    return NextResponse.json({ error: "Stored payment state is invalid" }, { status: 500 });
  }
  return NextResponse.json({ success: true, status, providerStatus });
}
