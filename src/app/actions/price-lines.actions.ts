"use server";

import { db } from "@/db";
import { items, orders, priceLines } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";

export type PriceLineResponse = typeof priceLines.$inferSelect;

const ENTITY_ID = /^[A-Za-z0-9_-]{1,128}$/;

async function authorizePriceRead(): Promise<ActionResult<AuthorizationSnapshot>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    return { ok: false, error: "UNAUTHORIZED", message: authorization.message };
  }
  if (!authorization.data.permissions.includes("perm_view_prices")) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung zum Anzeigen von Preisen." };
  }
  return { ok: true, data: authorization.data };
}

export async function getPriceLinesDb(orderId: string, itemId?: string | null): Promise<ActionResult<PriceLineResponse[]>> {
  const auth = await authorizePriceRead();
  if (!auth.ok) return auth;

  if (!ENTITY_ID.test(orderId) || (itemId != null && !ENTITY_ID.test(itemId))) {
    return { ok: false, error: "UNKNOWN", message: "Ungültige Auftrags- oder Positions-ID." };
  }

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const [ownedOrder] = await db.select({ id: orders.id }).from(orders).where(and(
      eq(orders.id, orderId),
      eq(orders.tenantId, auth.data.tenantId),
    )).limit(1);
    if (!ownedOrder) return { ok: false, error: "EMPTY_RESULT", message: "Auftrag nicht gefunden." };

    if (itemId) {
      const [ownedItem] = await db.select({ id: items.id }).from(items).where(and(
        eq(items.id, itemId),
        eq(items.orderId, orderId),
        eq(items.tenantId, auth.data.tenantId),
      )).limit(1);
      if (!ownedItem) return { ok: false, error: "EMPTY_RESULT", message: "Auftragsposition nicht gefunden." };
    }

    const data = await db.select().from(priceLines).where(and(
      eq(priceLines.tenantId, auth.data.tenantId),
      eq(priceLines.orderId, orderId),
      ...(itemId ? [eq(priceLines.itemId, itemId)] : []),
    ));
    return { ok: true, data };
  } catch (error) {
    console.error("Failed to get price lines from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Preise", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

function priceMutationUnavailable(): ActionResult<never> {
  return {
    ok: false,
    error: "FORBIDDEN",
    message: "Preisänderungen sind gesperrt, bis ein versionierter, idempotenter Audit- und Freigabevertrag angebunden ist.",
  };
}

export async function createPriceLineDb(_data: unknown): Promise<ActionResult<never>> {
  void _data;
  return priceMutationUnavailable();
}

export async function updatePriceLineDb(_id: string, _data: unknown): Promise<ActionResult<never>> {
  void _id;
  void _data;
  return priceMutationUnavailable();
}

export async function deletePriceLineDb(_id: string): Promise<ActionResult<never>> {
  void _id;
  return priceMutationUnavailable();
}
