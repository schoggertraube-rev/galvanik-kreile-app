"use server";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { InferSelectModel } from "drizzle-orm";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";
import { Customer } from "@/lib/types/customer";
import { unstable_noStore as noStore } from "next/cache";

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
    address: c.address || undefined,
    city: c.city || undefined,
    zipCode: c.zipCode || undefined,
    createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString(),
  };
}

function sanitizeCustomerPayload(data: Record<string, unknown>, isUpdate = false): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (['approvalProfile', 'paymentProfile', 'expectationProfile', 'technicalProfile'].includes(key)) {
      result[key] = value ?? {};
    } else if (key === 'tags') {
      result[key] = value ?? [];
    } else if (key === 'imageUrls') {
      result[key] = value ?? [];
    } else {
      if (!isUpdate && value === null) {
        continue;
      }
      result[key] = value;
    }
  }

  return result;
}

export async function getCustomersDb(): Promise<ActionResult<Customer[]>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const dbCustomers = await db.select().from(customers).where(
      and(
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo')`,
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

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const dbCustomers = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
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
    
    const rawCustomerDb = {
      id: newId,
      customerNumber: `K-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      name: validData.name,
      companyName: validData.companyName || null,
      type: validData.type || "business",
      address: validData.address || null,
      city: validData.city || null,
      zipCode: validData.zipCode || null,
      imageUrls: validData.imageUrls || [],
      contactPerson: (data as Record<string, unknown>).contactPerson as string,
      email: validData.email,
      phone: validData.phone,
      paymentProfile: (data as Record<string, unknown>).paymentProfile || null,
      approvalProfile: (data as Record<string, unknown>).approvalProfile || null,
      expectationProfile: (data as Record<string, unknown>).expectationProfile || null,
      technicalProfile: (data as Record<string, unknown>).technicalProfile || null,
      trustLevel: (data as Record<string, unknown>).trustLevel as string || null,
      internalWarning: (data as Record<string, unknown>).internalWarning as string || null,
      tags: (data as Record<string, unknown>).tags || null,
      creditRating: (data as Record<string, unknown>).creditRating as string || null,
      notes: validData.notes || null,
    };
    
    const newCustomerDb = sanitizeCustomerPayload(rawCustomerDb, false);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(customers).values(newCustomerDb as any);
    
    const dbCustomers = await db.select().from(customers).where(eq(customers.id, newId)).limit(1);
    if (dbCustomers.length === 0) throw new Error("Insert failed to return data");
    
    try { 
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/"); 
      revalidatePath("/customers");
      revalidatePath("/orders");
      revalidatePath("/warendurchlauf");
    } catch { /* ignore when not in Next runtime */ }
    
    return { ok: true, data: mapDbCustomer(dbCustomers[0]) };
  } catch (error) {
    console.error("Failed to create customer in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Erstellen des Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function updateCustomerDb(id: string, changes: Partial<Customer>): Promise<ActionResult<Customer | null>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const rawUpdateData: Record<string, unknown> = {};
    if (changes.name !== undefined) rawUpdateData.name = changes.name;
    if (changes.companyName !== undefined) rawUpdateData.companyName = changes.companyName;
    if (changes.type !== undefined) rawUpdateData.type = changes.type;
    if (changes.address !== undefined) rawUpdateData.address = changes.address;
    if (changes.city !== undefined) rawUpdateData.city = changes.city;
    if (changes.zipCode !== undefined) rawUpdateData.zipCode = changes.zipCode;
    if (changes.imageUrls !== undefined) rawUpdateData.imageUrls = changes.imageUrls;
    if (changes.contactPerson !== undefined) rawUpdateData.contactPerson = changes.contactPerson;
    if (changes.email !== undefined) rawUpdateData.email = changes.email;
    if (changes.phone !== undefined) rawUpdateData.phone = changes.phone;
    if (changes.paymentProfile !== undefined) rawUpdateData.paymentProfile = changes.paymentProfile;
    if (changes.approvalProfile !== undefined) rawUpdateData.approvalProfile = changes.approvalProfile;
    if (changes.expectationProfile !== undefined) rawUpdateData.expectationProfile = changes.expectationProfile;
    if (changes.technicalProfile !== undefined) rawUpdateData.technicalProfile = changes.technicalProfile;
    if (changes.trustLevel !== undefined) rawUpdateData.trustLevel = changes.trustLevel;
    if (changes.internalWarning !== undefined) rawUpdateData.internalWarning = changes.internalWarning;
    if (changes.tags !== undefined) rawUpdateData.tags = changes.tags;
    if (changes.creditRating !== undefined) rawUpdateData.creditRating = changes.creditRating;
    
    const updateData = sanitizeCustomerPayload(rawUpdateData, true);
    
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.update(customers).set(updateData as any).where(eq(customers.id, id));
    }
    
    return await getCustomerByIdDb(id);
  } catch (error) {
    console.error("Failed to update customer in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Aktualisieren des Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function searchCustomersDb(query: string): Promise<ActionResult<Customer[]>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  if (!query || query.trim() === "") {
    return { ok: true, data: [] };
  }
  
  try {
    const searchPattern = `%${query.trim()}%`;
    const dbCustomers = await db.select().from(customers).where(
      and(
        or(
          ilike(customers.name, searchPattern),
          ilike(customers.phone, searchPattern),
          ilike(customers.email, searchPattern)
        ),
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo')`,
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
    const { sql, desc } = await import("drizzle-orm");
    const { ausgangsrechnung } = await import("@/db/schema_buchhaltung");
    
    const top = await db.select({
      id: customers.id,
      name: customers.name,
      summe: sql<number>`sum(${ausgangsrechnung.netto})`
    })
    .from(customers)
    .innerJoin(ausgangsrechnung, eq(customers.id, ausgangsrechnung.kundeId))
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
