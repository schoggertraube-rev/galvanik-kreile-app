"use server";

import { db } from "@/db";
import { phoneNotes } from "@/db/schema";
import { desc } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

type JsonObject = Record<string, unknown>;
type PhoneNoteUpdate = Partial<InferInsertModel<typeof phoneNotes>>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

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
  extractionJson?: JsonObject;
  linksJson?: unknown[];
}

export async function createPhoneNote(input: CreatePhoneNoteInput) {
  if (!db) {
    throw new Error("Database connection not available.");
  }

  if (!input.rawText || input.rawText.trim() === "") {
    throw new Error("Der Rohtext der Notiz darf nicht leer sein.");
  }

  try {
    const extractionJson = {
      ...(input.extractionJson || {})
    };

    const inserted = await db.insert(phoneNotes).values({
      rawText: input.rawText,
      generatedAnswer: input.generatedAnswer || null,
      category: input.category || "Neuanfrage",
      urgency: input.urgency || "Normal",
      customerId: input.customerId || null,
      orderId: input.orderId || null,
      callerName: input.callerName || null,
      company: input.company || null,
      phone: input.phone || null,
      extractionJson: extractionJson,
      linksJson: input.linksJson || [],
      status: "open",
      tenantId: "galvanik-kreile"
    }).returning();

    return { success: true, data: inserted[0] };
  } catch (error: unknown) {
    const message = getErrorMessage(error, "Failed to save phone note");
    console.error("Failed to insert phone note:", message);
    return { success: false, error: message };
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

export async function updatePhoneNote(id: string, input: Partial<CreatePhoneNoteInput> & { status?: string }) {
  if (!db) throw new Error("Database connection not available.");
  
  try {

    const updateData: PhoneNoteUpdate = {};
    if (input.rawText) updateData.rawText = input.rawText;
    if (input.generatedAnswer !== undefined) updateData.generatedAnswer = input.generatedAnswer;
    if (input.category) updateData.category = input.category;
    if (input.urgency) updateData.urgency = input.urgency;
    if (input.status) updateData.status = input.status;
    if (input.callerName !== undefined) updateData.callerName = input.callerName;
    if (input.company !== undefined) updateData.company = input.company;
    if (input.phone !== undefined) updateData.phone = input.phone;
    
    if (input.customerId !== undefined) {
      updateData.customerId = input.customerId;
    }
    if (input.orderId !== undefined) {
      updateData.orderId = input.orderId;
    }
    
    if (input.extractionJson) {
      updateData.extractionJson = {
        ...input.extractionJson
      };
    }
    
    if (input.linksJson) updateData.linksJson = input.linksJson;
    
    updateData.updatedAt = new Date();

    // Use eq from drizzle-orm
    const { eq } = await import("drizzle-orm");
    const updated = await db.update(phoneNotes)
      .set(updateData)
      .where(eq(phoneNotes.id, id))
      .returning();

    return { success: true, data: updated[0] };
  } catch (error: unknown) {
    const message = getErrorMessage(error, "Failed to update phone note");
    console.error("Failed to update phone note:", message);
    return { success: false, error: message };
  }
}
