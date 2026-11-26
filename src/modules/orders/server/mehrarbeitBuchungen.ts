import "server-only";

import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { leseMehrarbeitsfreigabe, type Auftragsmehrarbeit } from "../domain/mehrarbeitSpielraum";

type Zeitposition = Auftragsmehrarbeit["positionen"][number];
type Zusage = Auftragsmehrarbeit["zusagen"][number];

export async function leseMehrarbeitBuchungenInTransaction(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  auftragIds: readonly string[],
): Promise<ReadonlyMap<string, Auftragsmehrarbeit>> {
  const auftraege = new Map<string, { positionen: Zeitposition[]; zusagen: Zusage[] }>(
    auftragIds.map(id => [id, { positionen: [], zusagen: [] }]),
  );
  if (auftraege.size === 0) return auftraege;
  const ids = sql.join([...auftraege.keys()].map(id => sql`${id}`), sql`, `);
  const zeilen = await tx.execute<
    | { order_id: string; kind: "position"; event_id: string; data: Zeitposition }
    | { order_id: string; kind: "zusage"; event_id: string; data: unknown }
  >(sql`
    SELECT zeit.order_id, 'position' AS kind, buchung.event_id,
      jsonb_build_object(
        'id', zeit.line_id, 'version', zeit.line_version, 'itemId', zeit.item_id,
        'catalogPositionId', zeit.catalog_position_id, 'minuten', zeit.minutes,
        'stundensatzCent', zeit.hourly_rate_cents,
        'gebuchtAm', to_char(buchung.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'buchungsId', buchung.event_id
      ) AS data
    FROM private.v_order_extra_work_live_v1 zeit
    JOIN private.v_order_item_extra_work_receipts_v1 buchung ON buchung.tenant_id = zeit.tenant_id
      AND buchung.order_id = zeit.order_id AND buchung.line_id = zeit.line_id::text
      AND buchung.line_version = zeit.line_version AND buchung.active AND buchung.integrity_ok
    WHERE zeit.tenant_id = ${tenantId} AND zeit.order_id IN (${ids}) AND zeit.integrity_ok
    UNION ALL
    SELECT order_id, 'zusage' AS kind, id AS event_id, payload AS data
    FROM public.events
    WHERE tenant_id = ${tenantId} AND order_id IN (${ids})
      AND event_type = 'ORDER_EXTRA_WORK_APPROVED_V1' AND event_schema_version = 1 AND status = 'success'
    ORDER BY order_id, kind, event_id
  `);

  for (const zeile of zeilen) {
    const auftrag = auftraege.get(zeile.order_id);
    if (!auftrag) throw Error("ORDER_EXTRA_WORK_SOURCE_INVALID");
    if (zeile.kind === "position") {
      if (auftrag.positionen.some(position => position.id === zeile.data.id)) throw Error("ORDER_EXTRA_WORK_SOURCE_AMBIGUOUS");
      auftrag.positionen.push(zeile.data);
    } else {
      const zusage = leseMehrarbeitsfreigabe(zeile.data);
      if (!zusage) throw Error("ORDER_EXTRA_WORK_APPROVAL_SOURCE_INVALID");
      auftrag.zusagen.push({ ...zusage, eventId: zeile.event_id });
    }
  }
  return auftraege;
}
