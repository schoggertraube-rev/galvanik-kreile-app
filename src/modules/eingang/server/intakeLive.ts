import "server-only";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { authorizedIntakeContext } from "./intakeCapture";

export type IntakeFileChange = { id: string; fileId: string; itemId: string; at: string };
export async function readIntakeFileChanges(since: string, after: string | null) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(since) || !Number.isFinite(Date.parse(since))
    || after !== null && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(after)) {
    return { code: "VALIDATION_ERROR" as const, message: "Ungültiger Abfragezeitpunkt." };
  }
  const auth = await authorizedIntakeContext();
  if ("code" in auth) return auth;
  try {
    const changes = await withPrivilegedTenantTransaction(auth, tx => tx.execute<IntakeFileChange>(sql`
      SELECT e.id::text AS id, f.id::text AS "fileId", f.item_id::text AS "itemId",
        to_char(e.zeit AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at
      FROM public.intake_event e
      JOIN public.intake_file f ON f.tenant_id=e.tenant_id AND f.item_id=e.item_id AND f.id=e.befehl_id
      WHERE e.tenant_id=${auth.tenantId} AND e.art IN ('original_gespeichert','erkannt')
        AND (e.zeit,e.id) > (${since}::timestamptz,${after ?? "00000000-0000-0000-0000-000000000000"}::uuid)
      ORDER BY e.zeit,e.id LIMIT 100
    `));
    return { code: "OK" as const, changes: Array.from(changes) };
  } catch (error) {
    console.error("[INTAKE_FILE_LIVE_READ_FAILED]", error);
    return { code: "UNAVAILABLE" as const, message: "Neue Aufnahmen konnten nicht geladen werden. Code: INTAKE_FILE_LIVE_READ_FAILED." };
  }
}
