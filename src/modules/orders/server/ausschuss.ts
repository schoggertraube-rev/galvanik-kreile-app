import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { hasAuthorizationArea } from "@/lib/auth/authorizationContract";
import { normaliseOrderPositionUnit, orderPositionUnitLabel } from "@/lib/orderPositionContract";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { WORK_TIME_COPY } from "@/ui/werkstattCopy";

const MELDUNG = "ORDER_ITEM_SCRAP_REPORTED_V1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AusschussEingabe = {
  auftragId: string;
  itemId: string;
  menge: number;
  gesamtStueck?: number;
  grund: string;
  clientEventId: string;
};

type AusschussQuittung = {
  eventId: string;
  auftragId: string;
  itemId: string;
  menge: number;
  gesamt: string;
  version: number;
};

type AusschussPorts = {
  sperrendeRechnung: (tx: PrivilegedTenantTransaction, tenantId: string, auftragId: string) => Promise<string | null>;
  aktualisiereAnliegen: (
    tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot,
    input: { auftragId: string; clientEventId: string; vollstaendig: boolean },
  ) => Promise<void>;
};

export async function leseAusschuss(
  tx: PrivilegedTenantTransaction, tenantId: string, auftragIds: readonly string[],
) {
  if (!auftragIds.length) return [];
  const ids = sql.join(auftragIds.map(id => sql`${id}::text`), sql`, `);
  return tx.execute<Omit<AusschussQuittung, "menge" | "gesamt"> & {
    menge: string; gesamt: string | null; grund: string; akteur: string; erfasstAm: string;
  }>(sql`
    SELECT DISTINCT ON (order_id, item_id) id AS "eventId", order_id AS "auftragId", item_id AS "itemId",
      payload->>'menge' AS menge, payload->>'gesamt_stueck' AS gesamt, payload->>'grund' AS grund,
      aggregate_version AS version, user_id::text AS akteur,
      to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "erfasstAm"
    FROM public.events WHERE tenant_id = ${tenantId} AND order_id IN (${ids})
      AND event_type = ${MELDUNG} AND status = 'success'
    ORDER BY order_id, item_id, aggregate_version DESC, id DESC
  `);
}

export async function meldeAusschuss(auth: AuthorizationSnapshot, eingabe: AusschussEingabe, ports: AusschussPorts) {
  if (!auth.active || auth.packageSwitches?.p3_werkstatt !== true
    || !hasAuthorizationArea(auth, "auftraege") || !auth.permissions.includes("perm_op_status")) {
    return { code: "FORBIDDEN" as const };
  }
  if (!eingabe || typeof eingabe.auftragId !== "string" || !eingabe.auftragId.trim()
    || typeof eingabe.itemId !== "string" || !eingabe.itemId.trim()
    || typeof eingabe.clientEventId !== "string" || !UUID.test(eingabe.clientEventId)) {
    return { code: "VALIDATION_ERROR" as const };
  }
  const { auftragId, itemId, menge, gesamtStueck, clientEventId } = eingabe;
  const grund = typeof eingabe.grund === "string" ? eingabe.grund.trim() : "";
  if (!grund) return { code: "VALIDATION_ERROR" as const, message: WORK_TIME_COPY.scrapReasonRequired };
  const hash = createHash("sha256").update(JSON.stringify({ auftragId, itemId, menge, gesamtStueck, grund })).digest("hex");
  return withPrivilegedTenantTransaction(auth, async tx => {
    const tenant = auth.tenantId;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(
      'orders:ausschuss:' || ${tenant} || ':' || ${clientEventId.toLowerCase()}, 0))`);
    const vorher = await tx.execute<{
      eventId: string; eventType: string; akteur: string; version: number;
      payload: { hash?: string; menge: number; gesamt_stueck: number } | null;
    }>(sql`SELECT id AS "eventId", event_type AS "eventType", user_id::text AS akteur,
        aggregate_version AS version, payload
      FROM public.events WHERE tenant_id = ${tenant} AND client_event_id = ${clientEventId}::uuid LIMIT 2`);
    if (vorher.length) {
      const [ereignis] = vorher;
      if (vorher.length !== 1 || ereignis.eventType !== MELDUNG || ereignis.akteur !== auth.userId
        || ereignis.payload?.hash !== hash) return { code: "CONFLICT" as const };
      const { menge, gesamt_stueck } = ereignis.payload;
      return { code: "OK" as const, quittung: {
        eventId: ereignis.eventId, auftragId, itemId, menge, gesamt: String(gesamt_stueck), version: ereignis.version,
      } };
    }

    const positionen = await tx.execute<{ itemId: string; abrechnungsmenge: string; einheit: string | null; version: number; station: string }>(sql`
      SELECT teil.id AS "itemId", teil.quantity::text AS abrechnungsmenge, teil.unit AS einheit, auftrag.version, auftrag.station
      FROM public.orders auftrag JOIN public.items teil ON teil.tenant_id = auftrag.tenant_id AND teil.order_id = auftrag.id
      WHERE auftrag.tenant_id = ${tenant} AND auftrag.id = ${auftragId}
      ORDER BY teil.id FOR UPDATE OF auftrag, teil
    `);
    const teil = positionen.find(position => position.itemId === itemId);
    if (!teil) return { code: "NOT_FOUND" as const, message: WORK_TIME_COPY.itemUnavailable };
    const rechnung = await ports.sperrendeRechnung(tx, tenant, auftragId);
    if (rechnung !== null) return { code: "CONFLICT" as const, message: WORK_TIME_COPY.scrapAfterInvoice(rechnung) };

    const einheit = normaliseOrderPositionUnit(teil.einheit);
    if (einheit === null || einheit === "stunde") return { code: "VALIDATION_ERROR" as const };
    let stueckzahl = einheit === "stueck" ? Number(teil.abrechnungsmenge) : gesamtStueck;
    if (einheit !== "stueck") {
      // Der erste Stückzahlbeleg gilt auch bei späteren Meldungen und Mengenkorrekturen.
      const [beleg] = await tx.execute<{ gesamt: string }>(sql`
        SELECT payload->>'gesamt_stueck' AS gesamt
        FROM public.events
        WHERE tenant_id = ${tenant} AND order_id = ${auftragId} AND item_id = ${itemId}
          AND event_type = ${MELDUNG} AND status = 'success'
          AND jsonb_typeof(payload->'gesamt_stueck') = 'number'
        ORDER BY aggregate_version, id LIMIT 1
      `);
      if (beleg) stueckzahl = Number(beleg.gesamt);
    }
    if (stueckzahl === undefined || !Number.isSafeInteger(stueckzahl) || stueckzahl <= 0) {
      return { code: "STUECKZAHL_FEHLT" as const, message: WORK_TIME_COPY.scrapTotalPiecesRequired(orderPositionUnitLabel(einheit)) };
    }
    const gesamt = String(stueckzahl);
    if (!Number.isSafeInteger(menge) || menge < 0 || menge > stueckzahl) {
      return { code: "VALIDATION_ERROR" as const, message: WORK_TIME_COPY.scrapQuantityInvalid(gesamt) };
    }

    const version = teil.version + 1;
    const update = await tx.execute(sql`UPDATE public.orders SET version = ${version}
      WHERE tenant_id = ${tenant} AND id = ${auftragId} AND version = ${teil.version} RETURNING id`);
    if (update.length !== 1) throw Error("AUSSCHUSS_AUFTRAGSVERSION_GEAENDERT");
    const eventId = randomUUID();
    const quittung = { eventId, auftragId, itemId, menge, gesamt, version };
    const event = await tx.execute(sql`INSERT INTO public.events (
        id, tenant_id, order_id, item_id, event_type, description, user_id,
        client_event_id, correlation_id, event_schema_version, aggregate_version, station, payload, status, created_at
      ) VALUES (${eventId}, ${tenant}, ${auftragId}, ${itemId}, ${MELDUNG},
        ${WORK_TIME_COPY.scrapHistory(menge, gesamt, grund)}, ${auth.userId}::uuid,
        ${clientEventId}::uuid, ${clientEventId}::uuid, 1, ${version}, ${teil.station},
        ${JSON.stringify({ hash, menge, gesamt_stueck: stueckzahl, grund })}::jsonb,
        'success', statement_timestamp() AT TIME ZONE 'UTC') RETURNING id`);
    if (event.length !== 1) throw Error("AUSSCHUSS_EREIGNIS_FEHLT");
    const stand = new Map((await leseAusschuss(tx, tenant, [auftragId])).map(meldung => [meldung.itemId, meldung]));
    const vollstaendig = positionen.every(position => {
      const meldung = stand.get(position.itemId);
      if (!meldung || Number(meldung.menge) <= 0) return false;
      const gesamt = normaliseOrderPositionUnit(position.einheit) === "stueck" ? position.abrechnungsmenge : meldung.gesamt;
      return Number(meldung.menge) === Number(gesamt);
    });
    await ports.aktualisiereAnliegen(tx, auth, { auftragId, clientEventId, vollstaendig });
    return { code: "OK" as const, quittung };
  });
}
