"use server";

import { db } from "@/db";
import { phoneNotes } from "@/db/schema";
import { desc } from "drizzle-orm";

export interface CreatePhoneNoteInput {
  rawText: string;
  generatedAnswer?: string;
  category?: string;
  urgency?: string;
  customerId?: string;
  orderId?: string;
  callerName?: string;
  company?: string;
  phone?: string;
  extractionJson?: any;
  linksJson?: any;
}

export async function createPhoneNote(input: CreatePhoneNoteInput) {
  if (!db) {
    throw new Error("Database connection not available.");
  }

  if (!input.rawText || input.rawText.trim() === "") {
    throw new Error("Der Rohtext der Notiz darf nicht leer sein.");
  }

  try {
    const isMockCustomer = input.customerId?.startsWith("inst_") || input.customerId?.startsWith("cust_");
    const isMockOrder = input.orderId?.startsWith("ord_");
    
    const extractionJson = {
      ...(input.extractionJson || {}),
      mockCustomerId: isMockCustomer ? input.customerId : undefined,
      mockOrderId: isMockOrder ? input.orderId : undefined
    };

    const inserted = await db.insert(phoneNotes).values({
      rawText: input.rawText,
      generatedAnswer: input.generatedAnswer || null,
      category: input.category || "Neuanfrage",
      urgency: input.urgency || "Normal",
      customerId: isMockCustomer ? null : (input.customerId || null),
      orderId: isMockOrder ? null : (input.orderId || null),
      callerName: input.callerName || null,
      company: input.company || null,
      phone: input.phone || null,
      extractionJson: extractionJson,
      linksJson: input.linksJson || [],
      status: "open",
      tenantId: "galvanik-kreile"
    }).returning();

    return { success: true, data: inserted[0] };
  } catch (error: any) {
    console.error("Failed to insert phone note:", error.message || error);
    return { success: false, error: error.message || "Failed to save phone note" };
  }
}

export async function getRecentPhoneNotes(limit = 5) {
  if (!db) return [];

  try {
    const notes = await db.select()
      .from(phoneNotes)
      .orderBy(desc(phoneNotes.createdAt))
      .limit(limit);
    
    return notes;
  } catch (error) {
    console.error("Failed to fetch recent phone notes:", error);
    return [];
  }
}
