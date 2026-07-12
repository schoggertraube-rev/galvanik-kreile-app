import { readAppSession } from "@/lib/server/appSession";
import { getCustomersDb } from "@/app/actions/customers.actions";
import { withTenant } from "@/lib/server/db/withTenant";
import { sql } from "drizzle-orm";

export type ProductionCustomerRow = {
  id: string;
  [key: string]: unknown;
};

function normalizeRows(result: unknown): ProductionCustomerRow[] {
  if (Array.isArray(result)) {
    return result as ProductionCustomerRow[];
  }

  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: ProductionCustomerRow[] }).rows;
  }

  return [];
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

export function summarizeCustomerShadowDiff(currentRows: Array<{ id: string }>, legacyRows: Array<{ id: string }>) {
  const currentIds = new Set(currentRows.map((row) => row.id));
  const legacyIds = new Set(legacyRows.map((row) => row.id));

  let newCount = 0;
  for (const id of currentIds) {
    if (!legacyIds.has(id)) {
      newCount++;
    }
  }

  let missingCount = 0;
  for (const id of legacyIds) {
    if (!currentIds.has(id)) {
      missingCount++;
    }
  }

  return { newCount, missingCount };
}

export function logCustomerShadowDiff(currentRows: Array<{ id: string }>, legacyRows: Array<{ id: string }>) {
  const summary = summarizeCustomerShadowDiff(currentRows, legacyRows);
  if (summary.newCount === 0 && summary.missingCount === 0) {
    return;
  }

  console.info("[customersContract] shadow diff", summary);
}

/**
 * Liest Produktionskunden ueber die tenant-gebundene View.
 */
export async function list(): Promise<ProductionCustomerRow[]> {
  const sessionResult = await readAppSession();
  if (!sessionResult.ok) {
    throw new Error(sessionErrorMessage(sessionResult.reason));
  }

  const currentRows = await withTenant(sessionResult.session.tenant, async (tx) => {
    const result = await tx.execute(sql`select * from public.v_production_customers`);
    return normalizeRows(result);
  });

  const legacyResult = await getCustomersDb();
  if (legacyResult.ok) {
    logCustomerShadowDiff(currentRows, legacyResult.data);
  }

  return currentRows;
}
