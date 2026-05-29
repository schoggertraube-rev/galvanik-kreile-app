"use server";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";

import { eq } from "drizzle-orm";

export async function getCustomersDb() {
  if (!db) return [];
  try {
    const dbCustomers = await db.select().from(customers).orderBy(customers.createdAt);
    return dbCustomers.map(c => ({
      id: c.id,
      customerNumber: c.customerNumber || "",
      name: c.name,
      type: (c.type as "business" | "private") || "private",
      city: c.city || "",
      email: c.email || "",
      phone: c.phone || "",
      prefComm: "E-Mail" as const,
      risk: "Niedrig" as const,
    }));
  } catch (error) {
    console.error("Failed to get customers from DB:", error);
    return [];
  }
}

export async function createCustomerDb(data: Record<string, unknown>) {
  if (!db) return { success: false, error: "Database not available" };
  
  const { customerSchema } = await import("@/lib/validation/customerSchema");
  const parsed = customerSchema.safeParse(data);
  
  if (!parsed.success) {
    const formattedErrors = parsed.error.flatten().fieldErrors;
    return { success: false, errors: formattedErrors };
  }
  
  const validData = parsed.data;
  
  try {
    const customerId = (typeof data.id === 'string' ? data.id : undefined) || createId();
    const customerNumber = `K-${1000 + Math.floor(Math.random() * 1000)}`;
    
    const newCustomer = {
      id: customerId,
      tenantId: "galvanik-kreile",
      customerNumber,
      name: validData.name,
      type: validData.type || "private",
      city: validData.city || null,
      email: validData.email || null,
      phone: validData.phone || null,
    };
    
    await db.insert(customers).values(newCustomer);
    
    return {
      success: true,
      data: {
        id: customerId,
        customerNumber,
        name: validData.name,
        type: newCustomer.type as "business" | "private",
        city: newCustomer.city || "",
        email: newCustomer.email || "",
        phone: newCustomer.phone || "",
        prefComm: "E-Mail" as const,
        risk: "Niedrig" as const,
      }
    };
  } catch (error) {
    console.error("Failed to create customer in DB:", error);
    return { success: false, error: "Database error" };
  }
}

export async function updateCustomerDb(id: string, changes: {
  name?: string;
  type?: string;
  city?: string;
  email?: string;
  phone?: string;
}) {
  if (!db) return null;
  try {
    const updateData: Record<string, string> = {};
    if (changes.name !== undefined) updateData.name = changes.name;
    if (changes.type !== undefined) updateData.type = changes.type;
    if (changes.city !== undefined) updateData.city = changes.city;
    if (changes.email !== undefined) updateData.email = changes.email;
    if (changes.phone !== undefined) updateData.phone = changes.phone;
    
    await db.update(customers).set(updateData).where(eq(customers.id, id));
    return { id, ...changes };
  } catch (error) {
    console.error("Failed to update customer in DB:", error);
    return null;
  }
}
