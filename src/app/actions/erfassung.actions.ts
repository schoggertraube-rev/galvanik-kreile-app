"use server"

import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { checkAppAuth } from "@/lib/server/authHelper";
import { revalidatePath } from "next/cache";

export async function startZeit(input: {
  auftrag_id: string;
  employee_id: string;
  station_kuerzel: string;
}) {
  void input;
  return { error: 'NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.' };
}

export async function stopZeit(input: {
  buchung_id: string;
  korrektur_minuten?: number;
}) {
  void input;
  return { error: 'NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.' };
}

export async function erfasseZeitDirekt(input: {
  auftrag_id: string;
  employee_id: string;
  station_kuerzel: string;
  dauer_minuten: number;
  datum?: string;
  war_aus_vorlage?: boolean;
  vorlage_id?: string;
}) {
  void input;
  return { error: 'NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.' };
}

export async function erfasseVerbrauch(input: {
  auftrag_id: string;
  inventory_item_id: string;
  menge: number;
  station_kuerzel: string;
  employee_id: string;
  war_aus_vorlage?: boolean;
  vorlage_id?: string;
}) {
  void input;
  return { error: 'NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.' };
}

export async function uebernehmeVorlage(input: {
  auftrag_id: string;
  employee_id: string;
  schluessel: string;
}) {
  void input;
  return { error: 'NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.' };
}

type ErfassungCustomerInput = {
  customerType?: string;
  customer_type?: string;
  name?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  company?: string;
  contactName?: string;
  source?: string;
  type?: string;
  isLead?: boolean;
  email?: string;
  phone?: string;
  street?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  address?: string;
  sourceRef?: string | null;
  notes?: string;
  behaviorNote?: string;
};

type ErfassungOrderInput = Record<string, unknown>;

type ErfassungOrderResult = {
  ok: false;
  error: 'CONFLICT';
  message: string;
};

type CustomerNumberRow = {
  id: string;
  customerNumber: string | null;
  source: string | null;
};

function getErrorContext(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { message: undefined, details: undefined, hint: undefined };
  }

  const message = error instanceof Error
    ? error.message
    : "message" in error && typeof error.message === "string"
      ? error.message
      : undefined;

  return {
    message,
    details: "details" in error ? error.details : undefined,
    hint: "hint" in error ? error.hint : undefined,
  };
}

export async function createCustomerFromErfassung(input: ErfassungCustomerInput) {
  console.info("[CAPTURE_CUSTOMER_START]", {
    hasInput: Boolean(input),
    customerType: input?.customerType ?? input?.customer_type,
    name: input?.name,
    firstName: input?.firstName ?? input?.first_name,
    lastName: input?.lastName ?? input?.last_name,
    company: input?.company,
    source: input?.source,
  });
  // Check write permissions
  const auth = await checkAppAuth("write");
  if (!auth.ok) return { ok: false, error: auth.message };

  // Validate required fields per spec
  const validationErrors: string[] = [];
  // Accept 'name' as an alias for 'contactName' to support different payload shapes
  const contactName = input.contactName || input.name;
  if (!contactName && !input.company) validationErrors.push("Name oder Firma ist erforderlich");
  if (!input.source) validationErrors.push("Quelle (source) ist erforderlich");
  if (validationErrors.length) {
    return { ok: false, error: validationErrors.join(", ") };
  }

  if (!db) return { ok: false, error: "DB_ERROR" };

  try {
    const customerId = createId();
    const isCompany = !!input.company;
    const customerType = input.type || (input.isLead ? "lead" : (isCompany ? "business" : "privat"));

    // Generate robust customer number
    const year = new Date().getFullYear();
    const prefix = "K";
    // const pattern = `${prefix}-${year}-%`; // unused pattern removed
    const result = await db.execute(sql`SELECT id, customer_number, source FROM customers WHERE source = ${input.source}`);
    // rows are typed as any – map to expected shape
    const allCustomers = (result as unknown as { rows: CustomerNumberRow[] }).rows;
    const existingCustomers = allCustomers.filter(c => c.customerNumber?.startsWith(`${prefix}-${year}-`));

    let maxNum = 0;
    for (const ec of existingCustomers) {
      if (ec.customerNumber) {
        const parts = ec.customerNumber.split("-");
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    }
    const sequenceNum = maxNum + 1;
    const sequenceString = sequenceNum.toString().padStart(4, "0");
    const customerNumber = `${prefix}-${year}-${sequenceString}`;

    const newCustomer = {
      id: customerId,
      customerNumber,
      name: contactName || input.company || "Unbenannter Kunde",
      companyName: input.company || null,
      contactPerson: contactName || null,
      email: input.email || null,
      phone: input.phone || null,
      street: input.street || null,
      zipCode: input.zipCode || null,
      city: input.city || null,
      country: input.country || null,
      address: input.address || null,
      type: customerType,
      isLead: input.isLead || false,
      source: input.source || "manual",
      sourceRef: input.sourceRef || null,
      notes: input.notes || null,
      behaviorNotes: input.behaviorNote || null,
      // No spreading of arbitrary input fields to prevent schema crashes
    };

    await db.insert(customers).values(newCustomer);
    const verify = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    if (verify.length === 0) {
      throw new Error("Insert failed silently");
    }
    try { revalidatePath("/"); } catch { /* ignore when not in Next runtime */ }
    return { ok: true, customer: verify[0] };
  } catch (err: unknown) {
    const error = getErrorContext(err);
    console.error("Failed to create customer:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { ok: false, error: error.message || "Failed to create customer" };
  }
}

export async function createOrderFromErfassung(input: ErfassungOrderInput): Promise<ErfassungOrderResult> {
  void input;
  return { ok: false, error: 'CONFLICT', message: 'NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.' };
}
