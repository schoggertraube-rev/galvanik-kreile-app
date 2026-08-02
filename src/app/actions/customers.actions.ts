"use server";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { InferSelectModel } from "drizzle-orm";
import { ActionResult } from "@/lib/server/authHelper";
import { Customer } from "@/lib/types/customer";
import { unstable_noStore as noStore } from "next/cache";
import { resolveFinanceDataScope } from "@/lib/server/financeDataAccess";

type DbCustomer = InferSelectModel<typeof customers>;
type CustomerInsert = typeof customers.$inferInsert;
type CustomerRecord = Partial<DbCustomer> & Pick<DbCustomer, "id" | "name" | "type">;

const customerBaseSelection = {
  id: customers.id,
  customerNumber: customers.customerNumber,
  name: customers.name,
  companyName: customers.companyName,
  type: customers.type,
  contactPerson: customers.contactPerson,
  email: customers.email,
  phone: customers.phone,
  approvalProfile: customers.approvalProfile,
  expectationProfile: customers.expectationProfile,
  technicalProfile: customers.technicalProfile,
  trustLevel: customers.trustLevel,
  internalWarning: customers.internalWarning,
  tags: customers.tags,
  imageUrls: customers.imageUrls,
  address: customers.address,
  street: customers.street,
  city: customers.city,
  zipCode: customers.zipCode,
  country: customers.country,
  createdAt: customers.createdAt,
  updatedAt: customers.updatedAt,
};

function customerSelection(canViewFinance: boolean) {
  return canViewFinance
    ? {
        ...customerBaseSelection,
        paymentProfile: customers.paymentProfile,
        creditRating: customers.creditRating,
      }
    : customerBaseSelection;
}

function mapDbCustomer(c: CustomerRecord, canViewFinance: boolean): Customer {
  const customer: Customer = {
    id: c.id,
    customerNumber: c.customerNumber || c.id.substring(0, 8),
    name: c.name,
    companyName: c.companyName || undefined,
    type: c.type as import("@/lib/types/customer").CustomerType,
    contactPerson: c.contactPerson || undefined,
    email: c.email || undefined,
    phone: c.phone || undefined,
    approvalProfile: c.approvalProfile || undefined,
    expectationProfile: c.expectationProfile || undefined,
    technicalProfile: c.technicalProfile || undefined,
    trustLevel: c.trustLevel as import("@/lib/types/customer").Customer["trustLevel"] || undefined,
    internalWarning: c.internalWarning || undefined,
    tags: (c.tags as string[]) || [],
    imageUrls: (c.imageUrls as string[]) || [],
    address: c.address || c.street || undefined, // fallback for legacy
    street: c.street || undefined,
    city: c.city || undefined,
    zipCode: c.zipCode || undefined,
    country: c.country || undefined,
    createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString(),
  };

  if (canViewFinance) {
    customer.paymentProfile = c.paymentProfile || undefined;
    customer.creditRating = c.creditRating || undefined;
  }

  return customer;
}

export async function getCustomersDb(): Promise<ActionResult<Customer[]>> {
  noStore();
  const scope = await resolveFinanceDataScope(["perm_view_customers"]);
  if (!scope.ok) return scope;
  const { tenantId, canViewFinance } = scope.data;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const dbCustomers = await db.select(customerSelection(canViewFinance)).from(customers).where(
      and(
        eq(customers.tenantId, tenantId),
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`,
        sql`coalesce(${customers.name}, '') NOT LIKE 'Capture%'`
      )
    ).orderBy(customers.createdAt);
    const data = dbCustomers.map((customer) => mapDbCustomer(customer, canViewFinance)).reverse(); // Order by createdAt desc
    return { ok: true, data };
  } catch (error) {
    console.error("Failed to get customers from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getCustomerByIdDb(id: string): Promise<ActionResult<Customer | null>> {
  noStore();
  const scope = await resolveFinanceDataScope(["perm_view_customers"]);
  if (!scope.ok) return scope;
  const { tenantId, canViewFinance } = scope.data;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const dbCustomers = await db.select(customerSelection(canViewFinance)).from(customers).where(
      and(
        eq(customers.id, id),
        eq(customers.tenantId, tenantId),
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`
      )
    ).limit(1);
    if (dbCustomers.length === 0) return { ok: true, data: null };
    
    return { ok: true, data: mapDbCustomer(dbCustomers[0], canViewFinance) };
  } catch (error) {
    console.error("Failed to get customer by id from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden des Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function createCustomerDb(data: Record<string, unknown>): Promise<ActionResult<Customer>> {
  const scope = await resolveFinanceDataScope(["perm_data_customers"]);
  if (!scope.ok) return scope;
  const { tenantId, canViewFinance } = scope.data;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  const { customerSchema } = await import("@/lib/validation/customerSchema");
  const parsed = customerSchema.safeParse(data);
  
  if (!parsed.success) {
    const formattedErrors = parsed.error.flatten().fieldErrors;
    return { ok: false, error: "UNKNOWN", message: "Validierungsfehler", details: formattedErrors };
  }
  
  const validData = parsed.data;

  try {
    const newId = (typeof data.id === 'string' ? data.id : undefined) || createId();
    
    const nameStr = validData.company || [validData.firstName, validData.lastName].filter(Boolean).join(" ");
    const streetCombined = validData.street + " " + validData.houseNumber;

    const newCustomerDb: CustomerInsert = {
      id: newId,
      tenantId: tenantId,
      customerNumber: `K-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      name: nameStr,
      companyName: validData.company || null,
      type: "business",
      address: streetCombined,
      street: streetCombined,
      city: validData.city || null,
      zipCode: validData.postalCode || null,
      country: validData.country || null,
      imageUrls: validData.imageUrls || [],
      contactPerson: [validData.firstName, validData.lastName].filter(Boolean).join(" ") || null,
      email: validData.email,
      phone: validData.phone,
      paymentProfile: {},
      approvalProfile: {},
      expectationProfile: {},
      technicalProfile: {},
      tags: [],
      notes: validData.notes || undefined,
    };

    await db.insert(customers).values(newCustomerDb);
    
    const dbCustomers = await db.select(customerSelection(canViewFinance)).from(customers).where(
      and(
        eq(customers.id, newId),
        eq(customers.tenantId, tenantId)
      )
    ).limit(1);
    if (dbCustomers.length === 0) throw new Error("Insert failed to return data");
    
    try { 
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/"); 
      revalidatePath("/customers");
      revalidatePath("/orders");
      revalidatePath("/warendurchlauf");
    } catch { /* ignore when not in Next runtime */ }
    
    return { ok: true, data: mapDbCustomer(dbCustomers[0], canViewFinance) };
  } catch (error) {
    console.error("Failed to create customer in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Erstellen des Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function updateCustomerDb(id: string, changes: Partial<Customer>): Promise<ActionResult<Customer | null>> {
  const scope = await resolveFinanceDataScope(["perm_data_customers"]);
  if (!scope.ok) return scope;
  const { tenantId, canViewFinance } = scope.data;

  if (
    !canViewFinance &&
    (changes.paymentProfile !== undefined || changes.creditRating !== undefined)
  ) {
    return {
      ok: false,
      error: "FORBIDDEN",
      message: "Keine Berechtigung für Finanzdaten.",
    };
  }

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const updateData: Partial<CustomerInsert> = {};
    if (changes.name !== undefined) updateData.name = changes.name;
    if (changes.companyName !== undefined) updateData.companyName = changes.companyName;
    if (changes.type !== undefined) updateData.type = changes.type;
    if (changes.address !== undefined) updateData.address = changes.address;
    if (changes.city !== undefined) updateData.city = changes.city;
    if (changes.zipCode !== undefined) updateData.zipCode = changes.zipCode;
    if (changes.imageUrls !== undefined) updateData.imageUrls = changes.imageUrls ?? [];
    if (changes.contactPerson !== undefined) updateData.contactPerson = changes.contactPerson;
    if (changes.email !== undefined) updateData.email = changes.email;
    if (changes.phone !== undefined) updateData.phone = changes.phone;
    if (changes.paymentProfile !== undefined) updateData.paymentProfile = changes.paymentProfile ?? {};
    if (changes.approvalProfile !== undefined) updateData.approvalProfile = changes.approvalProfile ?? {};
    if (changes.expectationProfile !== undefined) updateData.expectationProfile = changes.expectationProfile ?? {};
    if (changes.technicalProfile !== undefined) updateData.technicalProfile = changes.technicalProfile ?? {};
    if (changes.trustLevel !== undefined) updateData.trustLevel = changes.trustLevel;
    if (changes.internalWarning !== undefined) updateData.internalWarning = changes.internalWarning;
    if (changes.tags !== undefined) updateData.tags = changes.tags ?? [];
    if (changes.creditRating !== undefined) updateData.creditRating = changes.creditRating;
    
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db.update(customers).set(updateData).where(
        and(eq(customers.id, id), eq(customers.tenantId, tenantId)),
      );
    }
    
    return await getCustomerByIdDb(id);
  } catch (error) {
    console.error("Failed to update customer in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Aktualisieren des Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function searchCustomersDb(query: string): Promise<ActionResult<Customer[]>> {
  noStore();
  const scope = await resolveFinanceDataScope(["perm_view_customers"]);
  if (!scope.ok) return scope;
  const { tenantId, canViewFinance } = scope.data;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  if (!query || query.trim() === "") {
    return { ok: true, data: [] };
  }
  
  try {
    const searchPattern = `%${query.trim()}%`;
    const dbCustomers = await db.select(customerSelection(canViewFinance)).from(customers).where(
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
    
    return {
      ok: true,
      data: dbCustomers.map((customer) => mapDbCustomer(customer, canViewFinance)),
    };
  } catch (error) {
    console.error("Failed to search customers in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Suchen der Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getTopKunden(limit = 5) {
  try {
    const scope = await resolveFinanceDataScope(["perm_view_prices"]);
    if (!scope.ok || !scope.data.canViewFinance) return [];
    const tenantId = scope.data.tenantId;
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 50) : 5;

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
    .limit(safeLimit);

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
