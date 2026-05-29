"use server";

import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { QuoteRequest } from "@/lib/repositories/inquiriesRepository";

export async function getInquiries(): Promise<QuoteRequest[]> {
  if (!db) return [];
  try {
    const dbInquiries = await db.select().from(inquiries).orderBy(inquiries.createdAt);
    
    return dbInquiries.map(inq => ({
      id: inq.id,
      customerName: inq.customerName,
      customerId: inq.customerId || "",
      subject: inq.subject,
      description: inq.description,
      receivedAt: inq.receivedAt ? new Date(inq.receivedAt).toISOString() : new Date().toISOString(),
      rustLevel: (inq.rustLevel as QuoteRequest["rustLevel"]) || "Leicht",
      dirtLevel: (inq.dirtLevel as QuoteRequest["dirtLevel"]) || "Sauber",
      partCount: inq.partCount,
      material: inq.material,
      status: (inq.status as QuoteRequest["status"]) || "offen",
      photo: inq.photo || undefined,
      pricing: inq.pricing || {
        grundarbeit: 0,
        reinigung: 0,
        entmetallisierung: 0,
        schleifaufwand: 0,
        badchemie: 0,
        risikopuffer: 0,
        marge: 0,
      }
    }));
  } catch (error) {
    console.error("Failed to get inquiries from DB:", error);
    return [];
  }
}

export async function getOpenInquiriesCount(): Promise<number> {
  if (!db) return 0;
  try {
    const [{ value }] = await db.select({ value: count() }).from(inquiries).where(eq(inquiries.status, 'offen'));
    return value;
  } catch (error) {
    console.error("Failed to get open inquiries count from DB:", error);
    return 0;
  }
}

export async function createInquiry(data: Record<string, unknown>) {
  if (!db) return { success: false, error: "Database not available" };
  
  const { inquirySchema } = await import("@/lib/validation/inquirySchema");
  const parsed = inquirySchema.safeParse(data);
  
  if (!parsed.success) {
    const formattedErrors = parsed.error.flatten().fieldErrors;
    return { success: false, errors: formattedErrors };
  }
  
  const validData = parsed.data;
  
  try {
    const newId = createId();
    const pricing = {
      grundarbeit: 0,
      reinigung: 0,
      entmetallisierung: 0,
      schleifaufwand: 0,
      badchemie: 0,
      risikopuffer: 0,
      marge: 0,
    };
    
    const dbRow = {
      id: newId,
      tenantId: "galvanik-kreile",
      customerName: validData.customerName,
      customerId: validData.customerId || null,
      subject: validData.subject,
      description: validData.description,
      rustLevel: validData.rustLevel,
      dirtLevel: validData.dirtLevel,
      partCount: validData.partCount,
      material: validData.material,
      status: validData.status || "offen",
      pricing,
    };
    
    await db.insert(inquiries).values(dbRow);
    
    return {
      success: true,
      data: {
        ...validData,
        id: newId,
        receivedAt: new Date().toISOString(),
        status: validData.status || "offen",
        pricing,
      }
    };
  } catch (error) {
    console.error("Failed to create inquiry in DB:", error);
    return { success: false, error: "Database error" };
  }
}

export async function updateInquiry(id: string, changes: Partial<QuoteRequest>): Promise<QuoteRequest | null> {
  if (!db) return null;
  try {
    const updateData: Record<string, any> = {};
    if (changes.status !== undefined) updateData.status = changes.status;
    if (changes.pricing !== undefined) updateData.pricing = changes.pricing;
    if (changes.customerName !== undefined) updateData.customerName = changes.customerName;
    if (changes.subject !== undefined) updateData.subject = changes.subject;
    if (changes.description !== undefined) updateData.description = changes.description;
    
    await db.update(inquiries).set(updateData).where(eq(inquiries.id, id));
    
    // Fetch the updated inquiry to return it
    const updated = await db.select().from(inquiries).where(eq(inquiries.id, id));
    if (!updated.length) return null;
    
    const inq = updated[0];
    return {
      id: inq.id,
      customerName: inq.customerName,
      customerId: inq.customerId || "",
      subject: inq.subject,
      description: inq.description,
      receivedAt: inq.receivedAt ? new Date(inq.receivedAt).toISOString() : new Date().toISOString(),
      rustLevel: (inq.rustLevel as QuoteRequest["rustLevel"]) || "Leicht",
      dirtLevel: (inq.dirtLevel as QuoteRequest["dirtLevel"]) || "Sauber",
      partCount: inq.partCount,
      material: inq.material,
      status: (inq.status as QuoteRequest["status"]) || "offen",
      photo: inq.photo || undefined,
      pricing: inq.pricing || {
        grundarbeit: 0,
        reinigung: 0,
        entmetallisierung: 0,
        schleifaufwand: 0,
        badchemie: 0,
        risikopuffer: 0,
        marge: 0,
      }
    };
  } catch (error) {
    console.error("Failed to update inquiry in DB:", error);
    return null;
  }
}
