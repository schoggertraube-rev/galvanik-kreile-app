"use server";

import { createId } from "@paralleldrive/cuid2";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, events, orders } from "@/db/schema";
import { resolveAuthorization } from "@/lib/server/authorization";

const ALLOWED_CARRIERS = new Set(["dhl", "dpd", "spedition", "selbstabholung"]);

type ShipmentParams = {
  orderId: string;
  carrier: string;
  trackingNumber: string | null;
};

async function resolveShipmentScope() {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    return { ok: false as const, error: authorization.message };
  }

  const canShip = authorization.data.permissions.includes("perm_op_status");
  if (!canShip) {
    return { ok: false as const, error: "Keine Berechtigung für den Versand." };
  }

  return { ok: true as const, data: authorization.data };
}

function validateShipmentParams(params: ShipmentParams) {
  const orderId = params.orderId.trim();
  const carrier = params.carrier.trim().toLowerCase();
  const trackingNumber = params.trackingNumber?.trim() || null;

  if (!orderId || !ALLOWED_CARRIERS.has(carrier)) {
    return { ok: false as const, error: "Ungültige Versanddaten." };
  }

  return { ok: true as const, data: { orderId, carrier, trackingNumber } };
}

export async function saveShipmentInfo(params: ShipmentParams) {
  const scope = await resolveShipmentScope();
  if (!scope.ok) return { success: false, error: scope.error };

  const validated = validateShipmentParams(params);
  if (!validated.ok) return { success: false, error: validated.error };

  const { orderId, carrier, trackingNumber } = validated.data;
  const tenantId = scope.data.tenantId;
  const [order] = await db
    .select({
      id: orders.id,
      street: customers.street,
      zipCode: customers.zipCode,
      city: customers.city,
      country: customers.country,
    })
    .from(orders)
    .leftJoin(
      customers,
      and(
        eq(customers.id, orders.customerId),
        eq(customers.tenantId, tenantId),
      ),
    )
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1);

  if (!order) {
    return { success: false, error: "Auftrag oder Kunde nicht gefunden" };
  }

  if (carrier !== "selbstabholung") {
    const hasStreet = Boolean(order.street?.trim());
    const hasHouseNumber = Boolean(order.street && /\d/.test(order.street));
    const hasZipCode = Boolean(order.zipCode && order.zipCode.trim().length >= 4);
    const hasCity = Boolean(order.city?.trim());
    const hasCountry = Boolean(order.country?.trim());

    if (!(hasStreet && hasHouseNumber && hasZipCode && hasCity && hasCountry)) {
      const missingFields: string[] = [];
      if (!hasStreet) missingFields.push("Straße");
      if (!hasHouseNumber) missingFields.push("Hausnummer");
      if (!hasZipCode) missingFields.push("PLZ");
      if (!hasCity) missingFields.push("Ort");
      if (!hasCountry) missingFields.push("Land");

      return {
        success: false,
        error: "Unvollständige Versandadresse",
        missingFields,
        canChoosePickup: true,
        canEnterAlternativeAddress: true,
      };
    }
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${tenantId}:${orderId}`}, 0)
      )
    `);
    await tx.execute(sql`
      WITH updated AS (
        UPDATE public.shipments
        SET carrier = ${carrier},
            tracking_number = ${trackingNumber},
            status = 'pending',
            updated_at = now()
        WHERE tenant_id = ${tenantId}
          AND order_id = ${orderId}
        RETURNING id
      )
      INSERT INTO public.shipments (
        tenant_id,
        order_id,
        carrier,
        tracking_number,
        status
      )
      SELECT ${tenantId}, ${orderId}, ${carrier}, ${trackingNumber}, 'pending'
      WHERE NOT EXISTS (SELECT 1 FROM updated)
    `);
    await tx.execute(sql`
      UPDATE public.orders
      SET delivery_method = ${carrier}
      WHERE id = ${orderId}
        AND tenant_id = ${tenantId}
    `);
  });

  return { success: true };
}

export async function sendShippingConfirmation(params: ShipmentParams) {
  const scope = await resolveShipmentScope();
  if (!scope.ok) return { success: false, error: scope.error };

  const validated = validateShipmentParams(params);
  if (!validated.ok) return { success: false, error: validated.error };

  const { orderId, carrier, trackingNumber } = validated.data;
  const { tenantId, userId } = scope.data;
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1);

  if (!order) {
    return { success: false, error: "Auftrag nicht gefunden" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: "shipped" })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
    await tx.execute(sql`
      UPDATE public.shipments
      SET status = 'shipped',
          shipped_at = now(),
          updated_at = now()
      WHERE tenant_id = ${tenantId}
        AND order_id = ${orderId}
    `);
    await tx.insert(events).values({
      id: createId(),
      tenantId,
      orderId,
      eventType: "SHIPPED",
      description: `Versand via ${carrier}${trackingNumber ? ` (${trackingNumber})` : ""}`,
      userId,
    });
  });

  return { success: true };
}
