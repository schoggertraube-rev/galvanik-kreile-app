"use server";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { InferSelectModel } from "drizzle-orm";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";
import { Customer, type CustomerType } from "@/lib/types/customer";
import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";

type DbCustomer = InferSelectModel<typeof customers>;

function normalizedCustomerType(value: string | undefined | null, hasCompany = false): CustomerType {
  if (value === "institution" || value === "Institution") return "institution";
  if (value === "private" || value === "privat" || value === "Privatkunde") return "private";
  if (value === "business" || value === "Geschäftskunde") return "business";
  if (value === "lead") return hasCompany ? "business" : "private";
  throw new Error("CUSTOMER_DATA_INVALID:type");
}

function imageUrls(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length > 2_048)) {
    throw new Error("CUSTOMER_DATA_INVALID:image_urls");
  }
  return value;
}

function mapDbCustomer(c: DbCustomer): Customer {
  return {
    id: c.id,
    customerNumber: c.customerNumber || "Nicht vergeben",
    name: c.name,
    companyName: c.companyName || undefined,
    type: normalizedCustomerType(c.type, Boolean(c.companyName)),
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
    imageUrls: imageUrls(c.imageUrls),
    address: c.address || c.street || undefined, // fallback for legacy
    street: c.street || undefined,
    city: c.city || undefined,
    zipCode: c.zipCode || undefined,
    country: c.country || undefined,
    notes: c.notes || undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
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
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  const authRes = await resolveAuthorization();
  if (!authRes.ok) return { ok: false, error: "UNAUTHORIZED", message: authRes.message };
  const tenantId = authRes.data.tenantId;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  const { customerSchema } = await import("@/lib/validation/customerSchema");
  const parsed = customerSchema.safeParse(data);
  
  if (!parsed.success) {
    const formattedErrors = parsed.error.flatten().fieldErrors;
    return { ok: false, error: "UNKNOWN", message: "Validierungsfehler", details: formattedErrors };
  }
  
  const validData = parsed.data;

  try {
    const newId = createId();
    const companyName = validData.companyName || validData.company || null;
    const personName = validData.name || [validData.firstName, validData.lastName].filter(Boolean).join(" ");
    const nameStr = companyName || personName;
    const composedStreet = [validData.street, validData.houseNumber].filter(Boolean).join(" ").trim();
    const streetCombined = validData.address || composedStreet || null;
    const type = normalizedCustomerType(validData.type || (companyName ? "business" : "private"), Boolean(companyName));

    const newCustomerDb: typeof customers.$inferInsert = {
      id: newId,
      tenantId: tenantId,
      customerNumber: `K-${new Date().getFullYear()}-${newId.slice(0, 8).toUpperCase()}`,
      name: nameStr,
      companyName,
      type,
      address: streetCombined,
      street: streetCombined,
      city: validData.city || null,
      zipCode: validData.postalCode || validData.zipCode || null,
      country: validData.country || null,
      imageUrls: validData.imageUrls || [],
      contactPerson: [validData.firstName, validData.lastName].filter(Boolean).join(" ") || null,
      email: validData.email || null,
      phone: validData.phone || null,
      notes: validData.notes || null,
      behaviorNotes: validData.behaviorNote || null,
      source: validData.source || "manual",
      sourceRef: validData.sourceRef || null,
      isLead: validData.isLead ?? validData.type === "lead",
    };
    const [created] = await db.insert(customers).values(newCustomerDb).returning();
    if (!created) throw new Error("Insert failed to return data");
    
    try { 
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/"); 
      revalidatePath("/customers");
      revalidatePath("/orders");
      revalidatePath("/warendurchlauf");
    } catch { /* ignore when not in Next runtime */ }
    
    return { ok: true, data: mapDbCustomer(created) };
  } catch (error) {
    console.error("Failed to create customer in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Erstellen des Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function updateCustomerDb(id: string, changes: Partial<Customer>): Promise<ActionResult<Customer | null>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  const authRes = await resolveAuthorization();
  if (!authRes.ok) return { ok: false, error: "UNAUTHORIZED", message: authRes.message };
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return { ok: false, error: "UNKNOWN", message: "Ungültige Kunden-ID" };
  }

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  const { customerUpdateSchema } = await import("@/lib/validation/customerSchema");
  const parsed = customerUpdateSchema.safeParse(changes);
  if (!parsed.success) {
    return { ok: false, error: "UNKNOWN", message: "Validierungsfehler", details: parsed.error.flatten().fieldErrors };
  }

  try {
    const valid = parsed.data;
    const updateData: Partial<typeof customers.$inferInsert> = {
      ...valid,
      type: valid.type === undefined
        ? undefined
        : normalizedCustomerType(valid.type, Boolean(valid.companyName)),
      email: valid.email === "" ? null : valid.email,
      updatedAt: new Date(),
    };
    const [updated] = await db.update(customers).set(updateData).where(and(
      eq(customers.id, id),
      eq(customers.tenantId, authRes.data.tenantId),
      sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`,
    )).returning();
    return { ok: true, data: updated ? mapDbCustomer(updated) : null };
  } catch (error) {
    console.error("Failed to update customer in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Aktualisieren des Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
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
        eq(ausgangsrechnung.tenantId, tenantId),
        eq(ausgangsrechnung.isDemo, false),
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
