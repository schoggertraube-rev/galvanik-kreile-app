"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, priceAgreements } from "@/db/schema";
import type { PriceAgreement } from "@/lib/repositories/priceAgreementsRepository";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";

const TENANT_ID = "galvanik-kreile";
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;

function mapAgreement(row: typeof priceAgreements.$inferSelect): PriceAgreement {
  const rate = Number(row.rate);
  return {
    id: row.id,
    customerId: row.customerId,
    title: row.scope,
    currency: "EUR",
    ...(Number.isFinite(rate) ? { price: rate } : {}),
    validFrom: row.date.toISOString(),
  };
}

async function tenant(): Promise<ActionResult<string>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "UNAUTHORIZED", message: "Anmeldung erforderlich." };
  if (authorization.data.tenantId !== TENANT_ID || !authorization.data.permissions.includes("perm_view_prices")) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für Preisabsprachen." };
  }
  return { ok: true, data: authorization.data.tenantId };
}

export async function getPriceAgreementsAction(customerId?: unknown): Promise<ActionResult<PriceAgreement[]>> {
  const tenantResult = await tenant();
  if (!tenantResult.ok) return tenantResult;
  if (customerId !== undefined && (typeof customerId !== "string" || !ENTITY_ID.test(customerId))) {
    return { ok: false, error: "UNKNOWN", message: "Ungültige Kunden-ID." };
  }
  try {
    const rows = customerId
      ? await db
          .select({ agreement: priceAgreements })
          .from(priceAgreements)
          .innerJoin(customers, and(eq(priceAgreements.customerId, customers.id), eq(customers.tenantId, tenantResult.data)))
          .where(eq(priceAgreements.customerId, customerId as string))
          .orderBy(desc(priceAgreements.date))
      : await db
          .select({ agreement: priceAgreements })
          .from(priceAgreements)
          .innerJoin(customers, and(eq(priceAgreements.customerId, customers.id), eq(customers.tenantId, tenantResult.data)))
          .orderBy(desc(priceAgreements.date));
    return { ok: true, data: rows.map(({ agreement }) => mapAgreement(agreement)) };
  } catch (error) {
    console.error("Price agreement read failed", error);
    return { ok: false, error: "DB_ERROR", message: "Preisabsprachen konnten nicht geladen werden." };
  }
}
