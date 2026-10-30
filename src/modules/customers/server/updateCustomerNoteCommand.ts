import "server-only";

import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { CustomerCommandContext } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function updateCustomerNoteCommand(context: CustomerCommandContext, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { code: "VALIDATION_ERROR" as const, message: "Kundennotiz ist ungültig." };
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "clientEventId,customerId,note" || typeof value.clientEventId !== "string" || !UUID.test(value.clientEventId)
    || typeof value.customerId !== "string" || value.customerId.length < 1 || value.customerId.length > 128
    || typeof value.note !== "string" || value.note.trim() !== value.note || value.note.length > 2000) {
    return { code: "VALIDATION_ERROR" as const, message: "Kundennotiz ist ungültig." };
  }
  if (!context.capabilities.canCreateCustomer) return { code: "FORBIDDEN" as const, message: "Kundennotizen dürfen nicht geändert werden." };
  try {
    return await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = await tx.execute<{ result_code: string; replayed: boolean }>(sql`
        SELECT * FROM private.update_customer_note_v1(
          ${context.tenantId}, ${context.userId}::uuid, ${value.clientEventId}::uuid, ${value.customerId}, ${value.note}
        )
      `);
      const row = rows.length === 1 ? rows[0] : null;
      if (!row || !["OK", "NOT_FOUND", "CONFLICT", "VALIDATION_ERROR"].includes(row.result_code)) throw new Error("CUSTOMER_NOTE_RESULT_INVALID");
      if (row.result_code === "OK") return { code: "OK" as const, replayed: row.replayed };
      return { code: row.result_code as "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR", message: row.result_code === "NOT_FOUND" ? "Kunde ist nicht verfügbar." : row.result_code === "CONFLICT" ? "Anfragekennung wurde bereits anders verwendet." : "Kundennotiz ist ungültig." };
    });
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Kundennotiz konnte nicht sicher gespeichert werden." };
  }
}
