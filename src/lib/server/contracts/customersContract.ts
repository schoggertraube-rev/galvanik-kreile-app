import { withTenant } from "@/lib/server/db/withTenant";
import { sql } from "drizzle-orm";
import type { Customer } from "@/lib/types/customer";
import { type InferSelectModel } from "drizzle-orm";
import { customers } from "@/db/schema";
import { readAppSession } from "@/lib/server/appSession";

type DbCustomer = InferSelectModel<typeof customers>;

export type CustomerShadowDiffSummary = {
  onlyLegacyCount: number;
  onlyContractCount: number;
  sharedCount: number;
};

function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }
  return new Date().toISOString();
}

function normalizeRows(result: unknown): DbCustomer[] {
  if (Array.isArray(result)) {
    return result as DbCustomer[];
  }

  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: DbCustomer[] }).rows;
  }

  return [];
}

function mapDbCustomer(c: DbCustomer): Customer {
  return {
    id: c.id,
    customerNumber: c.customerNumber || c.id.substring(0, 8),
    name: c.name,
    companyName: c.companyName || undefined,
    type: c.type as Customer["type"],
    contactPerson: c.contactPerson || undefined,
    email: c.email || undefined,
    phone: c.phone || undefined,
    paymentProfile: c.paymentProfile || undefined,
    approvalProfile: c.approvalProfile || undefined,
    expectationProfile: c.expectationProfile || undefined,
    technicalProfile: c.technicalProfile || undefined,
    trustLevel: c.trustLevel as Customer["trustLevel"] || undefined,
    internalWarning: c.internalWarning || undefined,
    tags: (c.tags as string[]) || [],
    creditRating: c.creditRating || undefined,
    imageUrls: (c.imageUrls as string[]) || [],
    address: c.address || c.street || undefined,
    street: c.street || undefined,
    city: c.city || undefined,
    zipCode: c.zipCode || undefined,
    country: c.country || undefined,
    createdAt: toIsoDate(c.createdAt),
    updatedAt: toIsoDate(c.updatedAt),
  };
}

function sessionErrorMessage(reason: "NO_COOKIE" | "MALFORMED" | "INVALID_SIGNATURE" | "EXPIRED" | "INVALID_TENANT") {
  switch (reason) {
    case "NO_COOKIE":
      return "AUTH_ERROR: Nicht angemeldet";
    case "EXPIRED":
      return "AUTH_ERROR: Sitzung abgelaufen";
    case "INVALID_TENANT":
    case "MALFORMED":
    case "INVALID_SIGNATURE":
    default:
      return "AUTH_ERROR: Ungültige Sitzung";
  }
}

/**
 * Liest Produktionskunden ueber die tenant-gebundene View.
 */
export async function list(): Promise<Customer[]> {
  const sessionResult = await readAppSession();
  if (!sessionResult.ok) {
    throw new Error(sessionErrorMessage(sessionResult.reason));
  }

  const currentRows = await withTenant(sessionResult.session.tenant, async (tx) => {
    const result = await tx.execute(sql`select * from public.v_production_customers order by created_at asc`);
    return normalizeRows(result);
  });

  return currentRows.map(mapDbCustomer).reverse();
}

export function summarizeCustomerShadowDiff(
  legacyRows: Array<{ id: string }>,
  contractRows: Array<{ id: string }>,
): CustomerShadowDiffSummary {
  const legacyIds = new Set(legacyRows.map((row) => row.id));
  const contractIds = new Set(contractRows.map((row) => row.id));

  let onlyLegacyCount = 0;
  let sharedCount = 0;
  for (const id of legacyIds) {
    if (contractIds.has(id)) {
      sharedCount++;
    } else {
      onlyLegacyCount++;
    }
  }

  let onlyContractCount = 0;
  for (const id of contractIds) {
    if (!legacyIds.has(id)) {
      onlyContractCount++;
    }
  }

  return {
    onlyLegacyCount,
    onlyContractCount,
    sharedCount,
  };
}

export function logCustomerShadowDiff(
  legacyRows: Array<{ id: string }>,
  contractRows: Array<{ id: string }>,
) {
  const summary = summarizeCustomerShadowDiff(legacyRows, contractRows);
  console.info("[customersContract] shadow diff", summary);
}
