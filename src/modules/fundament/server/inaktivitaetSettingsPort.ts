import "server-only";

import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

export async function readInaktivitaetInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string, bezug: Readonly<{ geraetId: string | null; rolle: string }>,
) {
  const rows = await tx.execute<{ minuten: number; geraet: unknown; rolle: unknown }>(sql`
    SELECT COALESCE(firma.inaktivitaet_abmelden_minuten, private.s16d_inaktivitaet_standard()) AS minuten,
      firma.inaktivitaet_abmelden_geraete -> ${bezug.geraetId}::text AS geraet,
      firma.inaktivitaet_abmelden_rollen -> ${bezug.rolle}::text AS rolle
    FROM (VALUES (1)) AS start(zeile)
    LEFT JOIN public.company_settings firma ON firma.tenant_id=${tenantId}
    WHERE current_setting('app.tenant_id', true)=${tenantId}
    LIMIT 2
  `);
  if (rows.length !== 1) return null;
  const { geraet, rolle, minuten } = rows[0];
  const auswahl = geraet ?? rolle ?? minuten;
  return typeof auswahl === "number" && Number.isSafeInteger(auswahl) && auswahl >= 0 ? auswahl : null;
}
