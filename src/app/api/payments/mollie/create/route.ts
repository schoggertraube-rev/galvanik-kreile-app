import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, priceLines } from "@/db/schema";
import { resolveAuthorization } from "@/lib/server/authorization";
import { sumPriceLinesCents } from "@/lib/payments/serverAmount";
import {
  boundedApiError,
  isValidMolliePaymentId,
  normalizeMollieCheckoutUrl,
} from "@/lib/payments/mollieClientContract";

export async function POST(request: Request) {
  const auth = await resolveAuthorization();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    auth.data.tenantId !== "galvanik-kreile" ||
    !auth.data.permissions.includes("perm_view_prices")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const keys = body && typeof body === "object" ? Object.keys(body) : [];
  const orderId = keys.length === 1 && keys[0] === "orderId" && typeof (body as { orderId?: unknown }).orderId === "string"
    ? (body as { orderId: string }).orderId.trim()
    : "";
  if (!orderId || orderId.length > 128) {
    return NextResponse.json({ error: "A valid orderId is required" }, { status: 400 });
  }

  const [order] = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    customerId: orders.customerId,
  }).from(orders).where(and(
    eq(orders.id, orderId),
    eq(orders.tenantId, auth.data.tenantId),
  )).limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lines = await db.select({
    qty: priceLines.qty,
    unitPriceEur: priceLines.unitPriceEur,
    unitTotalEur: priceLines.unitTotalEur,
  }).from(priceLines).where(and(
    eq(priceLines.orderId, order.id),
    eq(priceLines.tenantId, auth.data.tenantId),
  ));

  let amountCents: number;
  try {
    amountCents = sumPriceLinesCents(lines);
    if (amountCents > 100_000_000) throw new Error("PAYMENT_AMOUNT_TOO_LARGE");
  } catch {
    return NextResponse.json({ error: "Order has no payable amount" }, { status: 409 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Payment service not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/mollie-create-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ orderId: order.id }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    if (text.length > 1_000_000) {
      return NextResponse.json({ error: "Payment service response was invalid" }, { status: 502 });
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Payment service response was invalid" }, { status: 502 });
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: boundedApiError(data, "Payment service request failed") },
        { status: response.status >= 400 && response.status <= 599 ? response.status : 502 },
      );
    }
    const value = data !== null && typeof data === "object" && !Array.isArray(data)
      ? data as Record<string, unknown>
      : null;
    const checkoutUrl = normalizeMollieCheckoutUrl(value?.checkoutUrl);
    if (value?.success !== true || !isValidMolliePaymentId(value.intentId) || !checkoutUrl) {
      return NextResponse.json({ error: "Payment service response was invalid" }, { status: 502 });
    }
    return NextResponse.json({
      success: true,
      intentId: value.intentId,
      checkoutUrl,
      amountCents,
    });
  } catch {
    return NextResponse.json({ error: "Payment service temporarily unavailable" }, { status: 503 });
  }
}
