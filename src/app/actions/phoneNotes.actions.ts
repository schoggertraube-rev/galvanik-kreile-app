"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

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
  extractionJson?: Record<string, unknown>;
  linksJson?: Record<string, unknown>;
}

export type PhoneNoteRecord = Record<string, unknown> & {
  id: string;
  rawText: string;
  createdAt: string;
  status?: string;
};

export type PhoneNoteActionResult = {
  success: boolean;
  error?: string;
  data?: PhoneNoteRecord;
};

function phoneNotesUnavailable(): never {
  if (!isFoundationAreaEnabled("Telefonnotizen")) {
    return foundationUnavailableAction("Telefonnotizen");
  }
  return foundationUnavailableAction("Telefonnotizen");
}

export async function createPhoneNote(input: CreatePhoneNoteInput): Promise<PhoneNoteActionResult> {
  void input;
  return phoneNotesUnavailable();
}

export async function getRecentPhoneNotes(limit = 5): Promise<PhoneNoteRecord[]> {
  void limit;
  return phoneNotesUnavailable();
}

export async function updatePhoneNote(
  id: string,
  input: Partial<CreatePhoneNoteInput> & { status?: string },
): Promise<PhoneNoteActionResult> {
  void id;
  void input;
  return phoneNotesUnavailable();
}
