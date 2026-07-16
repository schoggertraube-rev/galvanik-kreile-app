export type CustomerEnrichInput = {
  name?: string;
  company_name?: string;
  city?: string;
};

export type TextExtractInput = { text: string };
export type InquiryExtractInput = { text: string; subject?: string };

export const PHONE_NOTE_CATEGORIES = [
  "pickup_request",
  "status_question",
  "payment_question",
  "complaint",
  "callback",
  "new_order_intake",
  "new_customer_request",
  "quote_request",
  "email_review",
  "attachment_review",
  "photo_review",
  "document_review",
  "appointment_request",
  "deadline_request",
  "material_or_surface_info",
  "shipping_question",
  "technical_question",
  "general",
] as const;

export type PhoneNoteCategory = typeof PHONE_NOTE_CATEGORIES[number];

export type PhoneNoteAnalysisResult = {
  category: PhoneNoteCategory;
  material: string | null;
  surfaceRequested: string | null;
  suggestedAnswer: string;
  overallConfidence: number;
};

export type CustomerFreetextResult = {
  type: "privat" | "business" | "lead";
  company: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  zipCode: string | null;
  city: string | null;
  notes: string | null;
};

export type CustomerEnrichmentResult = {
  website: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  zipCode: string | null;
  city: string | null;
  country: "DE" | "AT" | "CH" | null;
  confidence: number;
  groundingSources: { url: string; title: string | null }[];
};

function objectWithExactKeys(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_AI_INPUT");
  }
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => !allowed.includes(key))) {
    throw new Error("INVALID_AI_INPUT");
  }
  return object;
}

function optionalText(value: unknown, maximum: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error("INVALID_AI_INPUT");
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new Error("INVALID_AI_INPUT");
  return normalized;
}

function requiredText(value: unknown, maximum: number): string {
  const normalized = optionalText(value, maximum);
  if (!normalized) throw new Error("INVALID_AI_INPUT");
  return normalized;
}

function nullableOutputText(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("INVALID_AI_OUTPUT");
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error("INVALID_AI_OUTPUT");
  }
  return normalized;
}

function exactOutputObject(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_AI_OUTPUT");
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => !allowed.includes(key))) throw new Error("INVALID_AI_OUTPUT");
  return object;
}

function validateEmail(value: string | null): string | null {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("INVALID_AI_OUTPUT");
  return value;
}

export function parseCustomerFreetextResult(value: unknown): CustomerFreetextResult {
  const object = exactOutputObject(value, [
    "type", "company", "contactName", "email", "phone", "street", "zipCode", "city", "notes",
  ]);
  if (object.type !== "privat" && object.type !== "business" && object.type !== "lead") {
    throw new Error("INVALID_AI_OUTPUT");
  }
  return {
    type: object.type,
    company: nullableOutputText(object.company, 200),
    contactName: nullableOutputText(object.contactName, 200),
    email: validateEmail(nullableOutputText(object.email, 320)),
    phone: nullableOutputText(object.phone, 80),
    street: nullableOutputText(object.street, 240),
    zipCode: nullableOutputText(object.zipCode, 20),
    city: nullableOutputText(object.city, 160),
    notes: nullableOutputText(object.notes, 2_000),
  };
}

export function parseCustomerEnrichmentResult(value: unknown): CustomerEnrichmentResult {
  const object = exactOutputObject(value, [
    "website", "phone", "email", "street", "zipCode", "city", "country", "confidence", "groundingSources",
  ]);
  const website = nullableOutputText(object.website, 2_048);
  if (website) {
    let parsed: URL;
    try { parsed = new URL(website); } catch { throw new Error("INVALID_AI_OUTPUT"); }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("INVALID_AI_OUTPUT");
  }
  if (object.country !== null && object.country !== undefined && !["DE", "AT", "CH"].includes(String(object.country))) {
    throw new Error("INVALID_AI_OUTPUT");
  }
  if (typeof object.confidence !== "number" || !Number.isFinite(object.confidence) || object.confidence < 0 || object.confidence > 1) {
    throw new Error("INVALID_AI_OUTPUT");
  }
  if (!Array.isArray(object.groundingSources) || object.groundingSources.length > 20) throw new Error("INVALID_AI_OUTPUT");
  const groundingSources = object.groundingSources.map((entry) => {
    const source = exactOutputObject(entry, ["url", "title"]);
    const url = nullableOutputText(source.url, 2_048);
    const title = nullableOutputText(source.title, 300);
    if (!url) throw new Error("INVALID_AI_OUTPUT");
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error("INVALID_AI_OUTPUT"); }
    if (parsed.protocol !== "https:") throw new Error("INVALID_AI_OUTPUT");
    return { url: parsed.toString(), title };
  });
  const result = {
    website,
    phone: nullableOutputText(object.phone, 80),
    email: validateEmail(nullableOutputText(object.email, 320)),
    street: nullableOutputText(object.street, 240),
    zipCode: nullableOutputText(object.zipCode, 20),
    city: nullableOutputText(object.city, 160),
    country: object.country ? object.country as "DE" | "AT" | "CH" : null,
    confidence: object.confidence,
    groundingSources,
  };
  if ([result.website, result.phone, result.email, result.street, result.zipCode, result.city]
    .some(Boolean) && groundingSources.length === 0) {
    throw new Error("INVALID_AI_OUTPUT");
  }
  return result;
}

export function parseCustomerEnrichInput(value: unknown): CustomerEnrichInput {
  const object = objectWithExactKeys(value, ["name", "company_name", "city"]);
  const name = optionalText(object.name, 160);
  const companyName = optionalText(object.company_name, 200);
  const city = optionalText(object.city, 120);
  if (!name && !companyName) throw new Error("INVALID_AI_INPUT");
  return {
    ...(name ? { name } : {}),
    ...(companyName ? { company_name: companyName } : {}),
    ...(city ? { city } : {}),
  };
}

export function parseFreetextInput(value: unknown): TextExtractInput {
  const object = objectWithExactKeys(value, ["text"]);
  return { text: requiredText(object.text, 8_000) };
}

export function parseInquiryInput(value: unknown): InquiryExtractInput {
  const object = objectWithExactKeys(value, ["text", "subject"]);
  const subject = optionalText(object.subject, 300);
  return {
    text: requiredText(object.text, 12_000),
    ...(subject ? { subject } : {}),
  };
}

export function parseNotesInput(value: unknown): TextExtractInput {
  const object = objectWithExactKeys(value, ["text"]);
  return { text: requiredText(object.text, 12_000) };
}

export function parsePhoneNoteAnalysisResult(value: unknown): PhoneNoteAnalysisResult {
  const object = exactOutputObject(value, [
    "category", "material", "surfaceRequested", "suggestedAnswer", "overallConfidence",
  ]);
  if (typeof object.category !== "string" || !PHONE_NOTE_CATEGORIES.includes(object.category as PhoneNoteCategory)) {
    throw new Error("INVALID_AI_OUTPUT");
  }
  if (
    typeof object.overallConfidence !== "number"
    || !Number.isInteger(object.overallConfidence)
    || object.overallConfidence < 0
    || object.overallConfidence > 100
  ) {
    throw new Error("INVALID_AI_OUTPUT");
  }
  const suggestedAnswer = nullableOutputText(object.suggestedAnswer, 2_000);
  if (!suggestedAnswer) throw new Error("INVALID_AI_OUTPUT");
  return {
    category: object.category as PhoneNoteCategory,
    material: nullableOutputText(object.material, 120),
    surfaceRequested: nullableOutputText(object.surfaceRequested, 160),
    suggestedAnswer,
    overallConfidence: object.overallConfidence,
  };
}
