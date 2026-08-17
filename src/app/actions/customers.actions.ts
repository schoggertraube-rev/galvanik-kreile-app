"use server";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";
import { Customer } from "@/lib/types/customer";
import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";

type DbCustomer = InferSelectModel<typeof customers>;

function mapDbCustomer(c: DbCustomer): Customer {
  return {
    id: c.id,
    customerNumber: c.customerNumber || c.id.substring(0, 8),
    name: c.name,
    companyName: c.companyName || undefined,
    type: c.type as import("@/lib/types/customer").CustomerType,
    contactPerson: c.contactPerson || undefined,
    email: c.email || undefined,
    phone: c.phone || undefined,
    paymentProfile: c.paymentProfile || undefined,
    approvalProfile: c.approvalProfile || undefined,
    expectationProfile: c.expectationProfile || undefined,
    technicalProfile: c.technicalProfile || undefined,
    trustLevel: c.trustLevel as import("@/lib/types/customer").Customer["trustLevel"] || undefined,
    internalWarning: c.internalWarning || undefined,
    tags: (c.tags as string[]) || [],
    creditRating: c.creditRating || undefined,
    imageUrls: (c.imageUrls as string[]) || [],
    address: c.address || c.street || undefined, // fallback for legacy
    street: c.street || undefined,
    city: c.city || undefined,
    zipCode: c.zipCode || undefined,
    country: c.country || undefined,
    createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export async function getCustomersDb(): Promise<ActionResult<Customer[]>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  const authRes = await resolveAuthorization();
  if (!authRes.ok) return { ok: false, error: "UNAUTHORIZED", message: authRes.message };
  const tenantId = authRes.data.tenantId;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const dbCustomers = await db.select().from(customers).where(
      and(
        eq(customers.tenantId, tenantId),
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`,
        sql`coalesce(${customers.name}, '') NOT LIKE 'Capture%'`
      )
    ).orderBy(customers.createdAt);
    const data = dbCustomers.map(mapDbCustomer).reverse(); // Order by createdAt desc
    return { ok: true, data };
  } catch (error) {
    console.error("Failed to get customers from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getCustomerByIdDb(id: string): Promise<ActionResult<Customer | null>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  const authRes = await resolveAuthorization();
  if (!authRes.ok) return { ok: false, error: "UNAUTHORIZED", message: authRes.message };
  const tenantId = authRes.data.tenantId;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const dbCustomers = await db.select().from(customers).where(
      and(
        eq(customers.id, id),
        eq(customers.tenantId, tenantId),
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`
      )
    ).limit(1);
    if (dbCustomers.length === 0) return { ok: true, data: null };
    
    return { ok: true, data: mapDbCustomer(dbCustomers[0]) };
  } catch (error) {
    console.error("Failed to get customer by id from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden des Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function createCustomerDb(data: Record<string, unknown>): Promise<ActionResult<Customer>> {
  void data;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Kundenerstellung benötigt den W3-Command-Vertrag." };
}

export async function updateCustomerDb(id: string, changes: Partial<Customer>): Promise<ActionResult<Customer | null>> {
  void id;
  void changes;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Kundenänderungen benötigen den W3-Command-Vertrag." };
}

export async function searchCustomersDb(query: string): Promise<ActionResult<Customer[]>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  const authRes = await resolveAuthorization();
  if (!authRes.ok) return { ok: false, error: "UNAUTHORIZED", message: authRes.message };
  const tenantId = authRes.data.tenantId;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  if (!query || query.trim() === "") {
    return { ok: true, data: [] };
  }
  
  try {
    const searchPattern = `%${query.trim()}%`;
    const dbCustomers = await db.select().from(customers).where(
      and(
        eq(customers.tenantId, tenantId),
        or(
          ilike(customers.name, searchPattern),
          ilike(customers.phone, searchPattern),
          ilike(customers.email, searchPattern)
        ),
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`,
        sql`coalesce(${customers.name}, '') NOT LIKE 'Capture%'`
      )
    );
    
    return { ok: true, data: dbCustomers.map(mapDbCustomer) };
  } catch (error) {
    console.error("Failed to search customers in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Suchen der Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getTopKunden(limit = 5) {
  try {
    const authRes = await resolveAuthorization();
    if (!authRes.ok) return [];
    const tenantId = authRes.data.tenantId;

    const { sql, desc } = await import("drizzle-orm");
    const { ausgangsrechnung } = await import("@/db/schema_buchhaltung");
    
    const top = await db.select({
      id: customers.id,
      name: customers.name,
      summe: sql<number>`sum(${ausgangsrechnung.netto})`
    })
    .from(customers)
    .innerJoin(ausgangsrechnung, eq(customers.id, ausgangsrechnung.kundeId))
    .where(
      and(
        eq(customers.tenantId, tenantId),
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`
      )
    )
    .groupBy(customers.id)
    .orderBy(desc(sql`sum(${ausgangsrechnung.netto})`))
    .limit(limit);

    return top.map((t, idx) => ({
      id: t.id || String(idx),
      name: t.name,
      wert: Number(t.summe) || 0
    }));
  } catch (error) {
    console.error("Failed to get top customers:", error);
    return [];
  }
}
