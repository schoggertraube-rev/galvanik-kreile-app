"use server";

import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  communicationDrafts,
  complaints,
  customers,
  events,
  items,
  orders,
  phoneNotes,
  priceAgreements,
} from "@/db/schema";
import { ausgangsrechnung } from "@/db/schema_buchhaltung";
import type { PermissionKey } from "@/lib/auth/authorizationContract";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";

const ENTITY_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CUSTOMER_SOURCE_IS_LIVE = ["seed", "test", "demo", "integration-test"] as const;

type CustomerKpiRow = {
  customer_id: string;
  kunde: string;
  classification: string | null;
  kunde_seit: Date | string;
  umsatz_ltv: number | string | null;
  gewinn_ltv: number | string | null;
  offene_posten: number | string;
  aktive_auftraege: number | string;
  puenktlichkeit_pct: number | string | null;
  reklamationen: number | string;
};

function finiteNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("CUSTOMER_KPI_NUMBER_INVALID");
  return parsed;
}

function nullableFiniteNumber(value: unknown): number | null {
  return value === null ? null : finiteNumber(value);
}

type CustomerAccess =
  | { ok: true; auth: AuthorizationSnapshot; customer: typeof customers.$inferSelect }
  | { ok: false; error: "UNAUTHORIZED" | "FORBIDDEN" | "INVALID_ID" | "NOT_FOUND" };

async function authorizeCustomer(
  customerId: string,
  permissions: readonly PermissionKey[],
): Promise<CustomerAccess> {
  if (!ENTITY_ID.test(customerId)) return { ok: false, error: "INVALID_ID" };

  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "UNAUTHORIZED" };
  if (permissions.some((permission) => !authorization.data.permissions.includes(permission))) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(
      eq(customers.id, customerId),
      eq(customers.tenantId, authorization.data.tenantId),
    ))
    .limit(1);

  if (!customer || CUSTOMER_SOURCE_IS_LIVE.includes((customer.source ?? "") as typeof CUSTOMER_SOURCE_IS_LIVE[number])) {
    return { ok: false, error: "NOT_FOUND" };
  }
  return { ok: true, auth: authorization.data, customer };
}

function actionError(error: unknown) {
  console.error("customer card action failed", error);
  return { ok: false as const, error: "DB_ERROR" };
}

function projectCustomer(customer: typeof customers.$inferSelect, canViewPrices: boolean) {
  const base = {
    id: customer.id,
    customerNumber: customer.customerNumber,
    name: customer.name,
    type: customer.type,
    street: customer.street,
    city: customer.city,
    zipCode: customer.zipCode,
    country: customer.country,
    address: customer.address,
    companyName: customer.companyName,
    contactPerson: customer.contactPerson,
    phone: customer.phone,
    email: customer.email,
    prefComm: customer.prefComm,
    risk: customer.risk,
    riskNote: customer.riskNote,
    notes: customer.notes,
    imageUrls: customer.imageUrls,
    approvalProfile: customer.approvalProfile,
    expectationProfile: customer.expectationProfile,
    technicalProfile: customer.technicalProfile,
    trustLevel: customer.trustLevel,
    internalWarning: customer.internalWarning,
    tags: customer.tags,
    shippingPreference: customer.shippingPreference,
    classification: customer.classification,
    internalNotes: customer.internalNotes,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
  return canViewPrices
    ? {
        ...base,
        paymentProfile: customer.paymentProfile,
        paymentPreference: customer.paymentPreference,
        creditRating: customer.creditRating,
      }
    : base;
}

export async function getCustomerCard(customerId: string) {
  try {
    const access = await authorizeCustomer(customerId, ["perm_view_customers"]);
    if (!access.ok) return access;

    const openOrders = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.customerId, customerId),
        eq(orders.tenantId, access.auth.tenantId),
        eq(orders.status, "in_progress"),
      ))
      .orderBy(desc(orders.createdAt))
      .limit(5);

    const canViewPrices = access.auth.permissions.includes("perm_view_prices");
    const canCreateOrders = access.auth.permissions.includes("perm_data_orders");
    const canManageQa = access.auth.permissions.includes("perm_op_qa");
    const kpiRows = canViewPrices
      ? await db.execute(sql<CustomerKpiRow>`
          SELECT
            kpi.customer_id,
            kpi.kunde,
            kpi.classification,
            kpi.kunde_seit,
            kpi.umsatz_ltv,
            kpi.gewinn_ltv,
            kpi.offene_posten,
            kpi.aktive_auftraege,
            kpi.puenklichkeit_pct AS puenktlichkeit_pct,
            kpi.reklamationen
          FROM public.v_analyse_kunden_kpi kpi
          JOIN public.customers customer
            ON customer.tenant_id = kpi.tenant_id
           AND customer.id = kpi.customer_id
          WHERE kpi.tenant_id = ${access.auth.tenantId}
            AND kpi.customer_id = ${customerId}
          LIMIT 1
        `)
      : [];
    const kpiRow = kpiRows[0];
    const kpi = kpiRow ? {
      customer_id: kpiRow.customer_id,
      kunde: kpiRow.kunde,
      classification: kpiRow.classification ?? "nicht_klassifiziert",
      kunde_seit: kpiRow.kunde_seit instanceof Date
        ? kpiRow.kunde_seit.toISOString()
        : String(kpiRow.kunde_seit),
      umsatz_ltv: nullableFiniteNumber(kpiRow.umsatz_ltv),
      gewinn_ltv: nullableFiniteNumber(kpiRow.gewinn_ltv),
      offene_posten: finiteNumber(kpiRow.offene_posten),
      aktive_auftraege: finiteNumber(kpiRow.aktive_auftraege),
      puenktlichkeit_pct: nullableFiniteNumber(kpiRow.puenktlichkeit_pct),
      reklamationen: finiteNumber(kpiRow.reklamationen),
    } : null;

    return {
      ok: true as const,
      data: {
        ...projectCustomer(access.customer, canViewPrices),
        kpi,
        kpiAvailability: canViewPrices
          ? (kpi ? "available" as const : "not_found" as const)
          : "forbidden" as const,
        openOrders,
        capabilities: { canViewPrices, canCreateOrders, canManageQa },
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function getCustomerOrders(customerId: string) {
  try {
    const access = await authorizeCustomer(customerId, ["perm_view_customers"]);
    if (!access.ok) return access;
    const data = await db
      .select()
      .from(orders)
      .where(and(eq(orders.customerId, customerId), eq(orders.tenantId, access.auth.tenantId)))
      .orderBy(desc(orders.createdAt));
    return { ok: true as const, data };
  } catch (error) {
    return actionError(error);
  }
}

export async function getCustomerTimeline(customerId: string) {
  try {
    const access = await authorizeCustomer(customerId, ["perm_view_customers"]);
    if (!access.ok) return access;
    const timeline: Array<{
      id: string;
      type: "status" | "note" | "email";
      title: string;
      subtitle: string | null;
      timestamp: string;
      relatedOrderId?: string;
      severity: "critical" | "neutral";
    }> = [];

    const dbEvents = await db
      .select()
      .from(events)
      .innerJoin(orders, and(
        eq(events.orderId, orders.id),
        eq(events.tenantId, orders.tenantId),
      ))
      .where(and(
        eq(orders.customerId, customerId),
        eq(orders.tenantId, access.auth.tenantId),
        eq(events.tenantId, access.auth.tenantId),
      ))
      .orderBy(desc(events.createdAt))
      .limit(50);

    for (const entry of dbEvents) {
      timeline.push({
        id: entry.events.id,
        type: "status",
        title: entry.events.eventType,
        subtitle: entry.events.description,
        timestamp: entry.events.createdAt.toISOString(),
        relatedOrderId: entry.events.orderId,
        severity: entry.events.status === "warning" ? "critical" : "neutral",
      });
    }

    const dbNotes = await db
      .select()
      .from(phoneNotes)
      .where(and(
        eq(phoneNotes.customerId, customerId),
        eq(phoneNotes.tenantId, access.auth.tenantId),
      ))
      .orderBy(desc(phoneNotes.createdAt))
      .limit(20);
    for (const note of dbNotes) {
      if (!note.createdAt) continue;
      timeline.push({
        id: note.id,
        type: "note",
        title: "Telefonnotiz",
        subtitle: note.rawText,
        timestamp: note.createdAt.toISOString(),
        severity: "neutral",
      });
    }

    const dbComms = await db
      .select()
      .from(communicationDrafts)
      .where(and(
        eq(communicationDrafts.customerId, customerId),
        eq(communicationDrafts.tenantId, access.auth.tenantId),
      ))
      .orderBy(desc(communicationDrafts.createdAt))
      .limit(20);
    for (const communication of dbComms) {
      timeline.push({
        id: communication.id,
        type: "email",
        title: communication.subject,
        subtitle: communication.status,
        timestamp: communication.createdAt.toISOString(),
        severity: "neutral",
      });
    }

    timeline.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
    return { ok: true as const, data: timeline };
  } catch (error) {
    return actionError(error);
  }
}

export async function getCustomerFinancials(customerId: string) {
  try {
    const access = await authorizeCustomer(customerId, ["perm_view_customers", "perm_view_prices"]);
    if (!access.ok) return access;
    const invoices = await db
      .select({
        id: ausgangsrechnung.id,
        belegnr: ausgangsrechnung.nummer,
        datum: ausgangsrechnung.datum,
        faellig_am: ausgangsrechnung.faelligAm,
        brutto: ausgangsrechnung.brutto,
        status: ausgangsrechnung.status,
      })
      .from(ausgangsrechnung)
      .where(and(
        eq(ausgangsrechnung.kundeId, customerId),
        eq(ausgangsrechnung.tenantId, access.auth.tenantId),
        eq(ausgangsrechnung.isDemo, false),
      ))
      .orderBy(desc(ausgangsrechnung.datum));
    return { ok: true as const, data: { invoices } };
  } catch (error) {
    return actionError(error);
  }
}

export async function getCustomerSimilarOrders(customerId: string, orderId?: string) {
  try {
    const access = await authorizeCustomer(customerId, ["perm_view_customers"]);
    if (!access.ok) return access;
    const similar = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.customerId, customerId),
        eq(orders.tenantId, access.auth.tenantId),
        eq(orders.status, "abgeschlossen"),
      ))
      .orderBy(desc(orders.createdAt))
      .limit(10);
    return { ok: true as const, data: orderId ? similar.filter((order) => order.id !== orderId) : similar };
  } catch (error) {
    return actionError(error);
  }
}

export async function getCustomerItems(customerId: string) {
  try {
    const access = await authorizeCustomer(customerId, ["perm_view_customers"]);
    if (!access.ok) return access;
    const rows = await db
      .select({
        id: items.id,
        bezeichnung: items.name,
        material: items.material,
        oberflaeche: items.surfaceRequested,
        lastSeen: items.createdAt,
      })
      .from(items)
      .innerJoin(orders, and(eq(items.orderId, orders.id), eq(items.tenantId, orders.tenantId)))
      .where(and(
        eq(items.customerId, customerId),
        eq(items.tenantId, access.auth.tenantId),
        eq(orders.tenantId, access.auth.tenantId),
      ));

    const grouped = new Map<string, {
      bezeichnung: string;
      material: string | null;
      oberflaeche: string | null;
      count: number;
      last_seen: Date;
      avg_price: null;
    }>();
    for (const row of rows) {
      const key = JSON.stringify([row.bezeichnung, row.material, row.oberflaeche]);
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, {
          bezeichnung: row.bezeichnung,
          material: row.material,
          oberflaeche: row.oberflaeche,
          count: 1,
          last_seen: row.lastSeen,
          avg_price: null,
        });
      } else {
        current.count += 1;
        if (row.lastSeen > current.last_seen) current.last_seen = row.lastSeen;
      }
    }
    return { ok: true as const, data: [...grouped.values()].sort((a, b) => b.count - a.count) };
  } catch (error) {
    return actionError(error);
  }
}

export async function getCustomerPrices(customerId: string) {
  try {
    const access = await authorizeCustomer(customerId, ["perm_view_customers", "perm_view_prices"]);
    if (!access.ok) return access;
    const data = await db
      .select()
      .from(priceAgreements)
      .innerJoin(customers, eq(priceAgreements.customerId, customers.id))
      .where(and(
        eq(customers.id, customerId),
        eq(customers.tenantId, access.auth.tenantId),
      ))
      .orderBy(desc(priceAgreements.date));
    return { ok: true as const, data: data.map((entry) => entry.price_agreements) };
  } catch (error) {
    return actionError(error);
  }
}

export async function getCustomerComplaints(customerId: string) {
  try {
    const access = await authorizeCustomer(customerId, ["perm_view_customers", "perm_op_qa"]);
    if (!access.ok) return access;
    const data = await db
      .select()
      .from(complaints)
      .innerJoin(orders, and(
        eq(complaints.orderId, orders.id),
        eq(complaints.tenantId, orders.tenantId),
      ))
      .where(and(
        eq(complaints.customerId, customerId),
        eq(complaints.tenantId, access.auth.tenantId),
        eq(orders.tenantId, access.auth.tenantId),
      ))
      .orderBy(desc(complaints.createdAt));
    return { ok: true as const, data };
  } catch (error) {
    return actionError(error);
  }
}

const customerCorePatchSchema = z.object({
  shippingPreference: z.string().trim().max(80).nullable().optional(),
  paymentPreference: z.string().trim().max(80).nullable().optional(),
  classification: z.string().trim().max(40).nullable().optional(),
  internalNotes: z.string().trim().max(5_000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  name: z.string().trim().min(1).max(300).optional(),
  contactPerson: z.string().trim().max(300).nullable().optional(),
  email: z.union([z.literal(""), z.string().trim().email().max(254), z.null()]).optional(),
  phone: z.string().trim().max(50).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export async function updateCustomerCore(customerId: string, patch: unknown) {
  try {
    const access = await authorizeCustomer(customerId, ["perm_data_customers"]);
    if (!access.ok) return access;
    const parsed = customerCorePatchSchema.safeParse(patch);
    if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };

    const result = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.tenantId, access.auth.tenantId)))
        .limit(1)
        .for("update");
      if (!locked) return null;
      const [updated] = await tx
        .update(customers)
        .set({
          ...parsed.data,
          email: parsed.data.email === "" ? null : parsed.data.email,
          updatedAt: new Date(),
        })
        .where(and(eq(customers.id, customerId), eq(customers.tenantId, access.auth.tenantId)))
        .returning({ id: customers.id });
      if (!updated) return null;
      await tx.insert(auditLog).values({
        tenantId: access.auth.tenantId,
        action: "customer_core_updated",
        tableName: "customers",
        recordId: customerId,
        actorId: access.auth.userId,
        payload: { fields: Object.keys(parsed.data).sort() },
      });
      return updated;
    });
    return result ? { ok: true as const } : { ok: false as const, error: "NOT_FOUND" };
  } catch (error) {
    return actionError(error);
  }
}

const tagSchema = z.string().trim().min(1).max(80);

async function mutateCustomerTag(customerId: string, value: unknown, operation: "add" | "remove") {
  try {
    const access = await authorizeCustomer(customerId, ["perm_data_customers"]);
    if (!access.ok) return access;
    const parsed = tagSchema.safeParse(value);
    if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };

    const result = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: customers.id, tags: customers.tags })
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.tenantId, access.auth.tenantId)))
        .limit(1)
        .for("update");
      if (!locked) return null;
      const current = Array.isArray(locked.tags)
        ? locked.tags.filter((tag): tag is string => typeof tag === "string")
        : [];
      const tags = operation === "add"
        ? [...new Set([...current, parsed.data])]
        : current.filter((tag) => tag !== parsed.data);
      const [updated] = await tx
        .update(customers)
        .set({ tags, updatedAt: new Date() })
        .where(and(eq(customers.id, customerId), eq(customers.tenantId, access.auth.tenantId)))
        .returning({ id: customers.id });
      if (!updated) return null;
      await tx.insert(auditLog).values({
        tenantId: access.auth.tenantId,
        action: operation === "add" ? "customer_tag_added" : "customer_tag_removed",
        tableName: "customers",
        recordId: customerId,
        actorId: access.auth.userId,
        payload: { tag: parsed.data },
      });
      return updated;
    });
    return result ? { ok: true as const } : { ok: false as const, error: "NOT_FOUND" };
  } catch (error) {
    return actionError(error);
  }
}

export async function addCustomerTag(customerId: string, tag: unknown) {
  return mutateCustomerTag(customerId, tag, "add");
}

export async function removeCustomerTag(customerId: string, tag: unknown) {
  return mutateCustomerTag(customerId, tag, "remove");
}
