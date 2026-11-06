"use server";

import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { sql } from "drizzle-orm";
import QRCode from "qrcode";
import { createOrderLabelPdfDocument } from "@/lib/pdf/OrderLabel";
import { normaliseOrderPositionUnit, orderPositionUnitLabel } from "@/lib/orderPositionContract";
import { hasAuthorizationArea, resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

type OrderLabelRow = {
  id: string;
  order_number: string;
  customer_name: string;
  due_date: string | null;
  intake_date: string | null;
  positions: unknown;
};

type LabelPosition = { quantity: string | number; unit: string | null };

function singleOrderId(orderIds: string | string[]): string {
  const values = Array.isArray(orderIds) ? orderIds : [orderIds];
  if (values.length !== 1 || typeof values[0] !== "string" || !values[0].trim() || values[0] !== values[0].trim() || values[0].length > 128) {
    throw new Error("LABEL_INPUT_INVALID");
  }
  return values[0];
}

function positionSummary(value: unknown): string {
  let positions = value;
  if (typeof positions === "string") {
    try {
      positions = JSON.parse(positions);
    } catch (cause) {
      console.error("[ORDER_LABEL_POSITION_PARSE_FAILED]", { code: cause instanceof Error ? cause.message : "LABEL_POSITION_INVALID" });
      throw new Error("LABEL_POSITION_INVALID");
    }
  }
  if (!Array.isArray(positions)) throw new Error("LABEL_POSITION_INVALID");
  if (positions.length === 0) return "fehlt";
  const totals = new Map<string, number>();
  for (const entry of positions) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("LABEL_POSITION_INVALID");
    const position = entry as Partial<LabelPosition>;
    const quantity = Number(String(position.quantity ?? "").replace(",", "."));
    const unit = normaliseOrderPositionUnit(position.unit);
    if (!Number.isFinite(quantity) || quantity <= 0 || !unit) throw new Error("LABEL_POSITION_INVALID");
    totals.set(unit, (totals.get(unit) ?? 0) + quantity);
  }
  return [...totals.entries()]
    .map(([unit, quantity]) => `${Number.isInteger(quantity) ? quantity : quantity.toLocaleString("de-DE", { maximumFractionDigits: 3 })} ${orderPositionUnitLabel(unit)}`)
    .join(" · ");
}

export async function generateOrderLabel(orderIds: string | string[]): Promise<string> {
  const orderId = singleOrderId(orderIds);
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") console.error("[ORDER_LABEL_AUTHORIZATION_UNAVAILABLE]", { orderId, reason: authorization.reason });
    throw new Error(authorization.reason === "AUTHORIZATION_UNAVAILABLE" ? "LABEL_AUTHORIZATION_UNAVAILABLE" : "LABEL_UNAUTHENTICATED");
  }
  if (!hasAuthorizationArea(authorization.data, "eingang") && !hasAuthorizationArea(authorization.data, "auftraege")) {
    throw new Error("LABEL_FORBIDDEN");
  }

  try {
    const rows = await withPrivilegedTenantTransaction(authorization.data, (tx) => tx.execute<OrderLabelRow>(sql`
      SELECT
        orders.id::text,
        orders.order_number,
        customer.name AS customer_name,
        orders.due_date::date::text AS due_date,
        orders.intake_date::date::text AS intake_date,
        COALESCE(
          jsonb_agg(
            jsonb_build_object('quantity', item.quantity::text, 'unit', item.unit)
            ORDER BY item.id
          ) FILTER (WHERE item.id IS NOT NULL),
          '[]'::jsonb
        ) AS positions
      FROM public.orders orders
      JOIN public.customers customer
        ON customer.tenant_id = orders.tenant_id
       AND customer.id = orders.customer_id
      LEFT JOIN public.items item
        ON item.tenant_id = orders.tenant_id
       AND item.order_id = orders.id
      WHERE orders.tenant_id = ${authorization.data.tenantId}
        AND orders.id = ${orderId}
      GROUP BY orders.id, customer.name
      LIMIT 2
    `));
    if (rows.length !== 1) throw new Error("LABEL_NOT_FOUND");
    const row = rows[0];
    const qrCodeDataUrl = await QRCode.toDataURL(`KREILE:${row.order_number}`, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 256,
    });
    const pdf = await renderToBuffer(createOrderLabelPdfDocument({
      orderNumber: row.order_number,
      customerName: row.customer_name,
      partSummary: positionSummary(row.positions),
      dueDate: row.due_date,
      intakeDate: row.intake_date,
      qrCodeDataUrl,
    }));
    if (pdf.byteLength === 0) throw new Error("LABEL_RENDER_EMPTY");
    return Buffer.from(pdf).toString("base64");
  } catch (cause) {
    console.error("[ORDER_LABEL_GENERATION_FAILED]", {
      orderId,
      code: cause instanceof Error ? cause.message : "LABEL_GENERATION_FAILED",
    });
    throw cause;
  }
}

export async function generateDeliveryNote(orderIds: string | string[]): Promise<string> {
  void orderIds;
  throw new Error("NOT_AVAILABLE: Firmendaten-Anzeige benötigt einen tenant- und capability-geprüften W3-Read-Vertrag.");
}
