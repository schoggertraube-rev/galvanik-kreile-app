"use server";

const NOT_AVAILABLE = "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.";

export type PhoneNoteUnavailable = {
  success: false;
  error: "NOT_AVAILABLE";
  message: typeof NOT_AVAILABLE;
};

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
  linksJson?: unknown[];
}

function notAvailable(): PhoneNoteUnavailable {
  return { success: false, error: "NOT_AVAILABLE", message: NOT_AVAILABLE };
}

export async function createPhoneNote(_input: CreatePhoneNoteInput): Promise<PhoneNoteUnavailable> {
  void _input;
  return notAvailable();
}

export async function getRecentPhoneNotes(_limit = 5): Promise<PhoneNoteUnavailable> {
  void _limit;
  return notAvailable();
}

export async function updatePhoneNote(
  _id: string,
  _input: Partial<CreatePhoneNoteInput> & { status?: string },
): Promise<PhoneNoteUnavailable> {
  void _id;
  void _input;
  return notAvailable();
}
