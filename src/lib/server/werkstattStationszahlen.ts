import "server-only";

import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

export type WerkstattStationszahl = Readonly<{ station: string; auftraege: number }>;

/** Kanonischer Leser für das Ziel aus der gespeicherten Firmenzeile. */
export async function readWerkstattWochenzielInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<number | null> {
  const rows = await tx.execute<{ wert: number | null }>(sql`
    SELECT firma.werkstatt_wochenziel_auftraege AS wert
    FROM (VALUES (1)) AS start(zeile)
    LEFT JOIN public.company_settings AS firma ON firma.tenant_id = ${tenantId}
    WHERE current_setting('app.tenant_id', true) = ${tenantId}
    LIMIT 2
  `);
  if (rows.length !== 1) throw Error("WERKSTATT_WOCHENZIEL_NICHT_EINDEUTIG");
  return rows[0].wert;
}

export async function readWerkstattStationszahlen(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<readonly WerkstattStationszahl[]> {
  const rows = await tx.execute<WerkstattStationszahl>(sql`
    WITH stationen(station, rang) AS (VALUES ('angenommen', 1), ('galvanik', 2), ('fertig', 3))
    SELECT stationen.station, count(DISTINCT queue.id)::integer AS auftraege
    FROM stationen
    LEFT JOIN private.v_operational_station_queue_v1 queue
      ON queue.tenant_id=${tenantId} AND queue.station=stationen.station
      AND (queue.status=stationen.station OR queue.station='angenommen' AND queue.status<>'storniert')
      AND (queue.current_station=queue.station OR queue.station='angenommen' AND queue.current_station IS NULL)
      AND (queue.current_station_id=queue.station OR queue.station='angenommen' AND queue.current_station_id IS NULL)
    WHERE current_setting('app.tenant_id', true)=${tenantId}
    GROUP BY stationen.station, stationen.rang
    ORDER BY stationen.rang
  `);
  return rows;
}
