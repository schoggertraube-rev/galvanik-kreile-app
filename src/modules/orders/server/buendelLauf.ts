import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { hasAuthorizationArea } from "@/lib/auth/authorizationContract";
import { ORDER_POSITION_SURFACES, orderPositionSurfaceLabel, type OrderPositionSurface } from "@/lib/orderPositionContract";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { setOrderItemFinishedInTransaction } from "@/lib/server/commands/orderContentCommand";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { LaufAntwort, LaufEingabe, LaufZeitverteilung } from "@/modules/werkstatt/public";
import { ORDER_BUENDEL_LAUF_COPY } from "@/ui/ordersCopy";
import { WORK_TIME_COPY } from "@/ui/werkstattCopy";
import { fertigtermin } from "../domain/termin";

type LaufOberflaeche = Exclude<OrderPositionSurface, "offen">;
type LaufTeil = { itemId: string; auftragId: string; version: number; auftragsmenge: string };
type LaufVorschlagszeile = Parameters<typeof fertigtermin>[0] & {
  oberflaeche: LaufOberflaeche;
  auftragId: string;
  itemIds: string[];
  auftragsmenge: string;
  laufmenge: string;
};

const offeneLaufteile = sql`
  teil.current_station_id IS DISTINCT FROM 'fertig'
  AND auftrag.station IN ('angenommen', 'galvanik') AND auftrag.status <> 'storniert'
  AND teil.quantity > 0
`;

const START = "ORDER_BUNDLE_RUN_STARTED_V1";
const ENDE = "ORDER_BUNDLE_RUN_COMPLETED_V1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Lauf = { laufId: string; oberflaeche: LaufOberflaeche; itemIds: string[] };
type LaufAbschluss = { laufId: string; buchungsIds: string[]; fertigMeldenVorschlag: string[] };
type StartEingabe = { oberflaeche: LaufOberflaeche; itemIds: string[]; clientEventId: string };
type EndeEingabe = { laufId: string; station: string; minuten: number; clientEventId: string };
type LaufabschlussPorts = {
  verteileMinuten: (auftraege: LaufEingabe["auftraege"], minuten: number) => LaufZeitverteilung;
  zeitBuchen: (
    tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, input: LaufEingabe,
  ) => Promise<LaufAntwort>;
  teilFertigMelden: typeof setOrderItemFinishedInTransaction;
};

function offeneLaeufe(tenantId: string) {
  return sql`SELECT beginn.payload->'quittung' AS daten FROM public.events beginn
    WHERE beginn.tenant_id = ${tenantId} AND beginn.event_type = ${START} AND beginn.status = 'success'
      AND NOT EXISTS (
        SELECT 1 FROM public.events ende WHERE ende.tenant_id = beginn.tenant_id
          AND ende.correlation_id = beginn.correlation_id AND ende.event_type = ${ENDE} AND ende.status = 'success'
      )`;
}

export async function leseOffeneLaeufe(tx: PrivilegedTenantTransaction, tenantId: string) {
  return tx.execute<Lauf>(sql`
    SELECT daten->>'laufId' AS "laufId", daten->>'oberflaeche' AS oberflaeche,
      ARRAY(SELECT jsonb_array_elements_text(daten->'itemIds')) AS "itemIds"
    FROM (${offeneLaeufe(tenantId)}) offen ORDER BY "laufId"
  `);
}

export async function schlageLaeufeVor(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  kalender: Parameters<typeof fertigtermin>[1],
  heute: string,
) {
  const zeilen = await tx.execute<LaufVorschlagszeile>(sql`
    WITH teile AS (
      SELECT teil.id, teil.quantity, auftrag.id AS auftrag_id,
        auftrag.due_date::date::text AS "dueDate", auftrag.handover_mode AS "handoverMode",
        private.order_position_surface_read_key(teil.surface_requested) AS oberflaeche
      FROM public.items teil
      JOIN public.orders auftrag ON auftrag.tenant_id = teil.tenant_id AND auftrag.id = teil.order_id
      WHERE teil.tenant_id = ${tenantId} AND ${offeneLaufteile}
        AND NOT EXISTS (SELECT 1 FROM (${offeneLaeufe(tenantId)}) lauf WHERE (lauf.daten->'itemIds') ? teil.id)
    ), auftraege AS (
      SELECT oberflaeche, auftrag_id AS "auftragId", "dueDate", "handoverMode",
        array_agg(id ORDER BY id) AS "itemIds", sum(quantity) AS menge
      FROM teile WHERE oberflaeche <> 'offen'
      GROUP BY oberflaeche, auftrag_id, "dueDate", "handoverMode"
    ), laeufe AS (
      SELECT oberflaeche, sum(menge)::text AS laufmenge
      FROM auftraege GROUP BY oberflaeche HAVING count(*) >= 2
    )
    SELECT oberflaeche, "auftragId", "dueDate", "handoverMode", "itemIds",
      auftraege.menge::text AS auftragsmenge, laeufe.laufmenge
    FROM auftraege JOIN laeufe USING (oberflaeche)
    ORDER BY oberflaeche, "auftragId"
  `);
  const laeufe = new Map<LaufOberflaeche, {
    oberflaeche: LaufOberflaeche;
    teilezahl: string;
    auftraege: {
      auftragId: string;
      itemIds: string[];
      teilezahl: string;
      termin: ReturnType<typeof fertigtermin>;
      vorausgewaehlt: boolean;
    }[];
  }>();
  for (const zeile of zeilen) {
    const termin = fertigtermin(zeile, kalender, heute);
    const lauf = laeufe.get(zeile.oberflaeche) ?? {
      oberflaeche: zeile.oberflaeche, teilezahl: zeile.laufmenge, auftraege: [],
    };
    lauf.auftraege.push({
      auftragId: zeile.auftragId,
      itemIds: zeile.itemIds,
      teilezahl: zeile.auftragsmenge,
      termin,
      vorausgewaehlt: termin?.stufe === "knapp" || termin?.stufe === "ueberfaellig",
    });
    laeufe.set(zeile.oberflaeche, lauf);
  }
  return [...laeufe.values()];
}

/** Die gespeicherte Reihenfolge entscheidet bei gleich großen Zeitanteilen. */
export async function leseBuendelLaufTeile(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  itemIds: readonly string[],
  oberflaeche: LaufOberflaeche,
  sperren = false,
) {
  if (!itemIds.length || new Set(itemIds).size !== itemIds.length) return null;
  const auswahl = sql.join(itemIds.map(id => sql`${id}::text`), sql`, `);
  const teile = await tx.execute<LaufTeil>(sql`
    WITH ausgewaehlt AS (
      SELECT teil.id AS "itemId", teil.order_id AS "auftragId", teil.quantity, auftrag.version,
        als_gespeichert.position
      FROM unnest(ARRAY[${auswahl}]) WITH ORDINALITY als_gespeichert(id, position)
      JOIN public.items teil ON teil.tenant_id = ${tenantId} AND teil.id = als_gespeichert.id
      JOIN public.orders auftrag ON auftrag.tenant_id = teil.tenant_id AND auftrag.id = teil.order_id
      WHERE ${offeneLaufteile} AND private.order_position_surface_read_key(teil.surface_requested) = ${oberflaeche}
      ${sperren ? sql`ORDER BY auftrag.id, teil.id FOR UPDATE OF auftrag, teil` : sql.empty()}
    )
    SELECT "itemId", "auftragId", version, sum(quantity) OVER (PARTITION BY "auftragId")::text AS auftragsmenge
    FROM ausgewaehlt ORDER BY position
  `);
  if (teile.length !== itemIds.length) return null;
  const auftraege = new Map<string, string>();
  for (const teil of teile) auftraege.set(teil.auftragId, teil.auftragsmenge);
  if (auftraege.size < 2) return null;
  return {
    itemIds: teile.map(teil => teil.itemId),
    auftraege: [...auftraege].map(([auftragId, teile]) => ({ auftragId, teile })),
    teile,
  };
}

function hatLaufrecht(auth: AuthorizationSnapshot) {
  return auth.active && auth.packageSwitches?.p3_werkstatt === true
    && hasAuthorizationArea(auth, "auftraege") && auth.permissions.includes("perm_op_status");
}

function sperreMandantenlaeufe(tx: PrivilegedTenantTransaction, tenantId: string) {
  return tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('orders:buendel-lauf:' || ${tenantId}, 0))`);
}

function anfrageHash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

async function laufQuittung<T>(
  tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, clientEventId: string,
  eventType: typeof START | typeof ENDE, hash: string,
) {
  const vorher = await tx.execute<{ eventType: string; akteur: string; payload: { hash?: string; quittung?: T } | null }>(sql`
    SELECT event_type AS "eventType", user_id::text AS akteur, payload
    FROM public.events WHERE tenant_id = ${auth.tenantId} AND client_event_id = ${clientEventId}::uuid LIMIT 2
  `);
  if (!vorher.length) return null;
  const [ereignis] = vorher;
  const quittung = vorher.length === 1 && ereignis.eventType === eventType && ereignis.akteur === auth.userId
    && ereignis.payload?.hash === hash ? ereignis.payload.quittung : undefined;
  return quittung ? { code: "OK" as const, quittung } : { code: "CONFLICT" as const };
}

async function schreibeLaufEreignis<T extends Lauf | LaufAbschluss>(
  tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot,
  input: { id: string; typ: typeof START | typeof ENDE; text: string; clientEventId: string; hash: string; quittung: T },
) {
  const { id, typ, text, clientEventId, hash, quittung } = input;
  const zeilen = await tx.execute(sql`INSERT INTO public.events (
      id, tenant_id, event_type, description, user_id, client_event_id, correlation_id,
      event_schema_version, aggregate_version, payload, status
    ) VALUES (${id}, ${auth.tenantId}, ${typ}, ${text}, ${auth.userId}::uuid, ${clientEventId}::uuid, ${quittung.laufId}::uuid,
      1, ${typ === START ? 1 : 2}, ${JSON.stringify({ hash, quittung })}::jsonb, 'success') RETURNING id`);
  if (zeilen.length !== 1) throw Error("BUENDEL_LAUF_EREIGNIS_FEHLT");
  return { code: "OK" as const, quittung };
}

export async function starteLauf(auth: AuthorizationSnapshot, input: StartEingabe) {
  if (!hatLaufrecht(auth)) return { code: "FORBIDDEN" as const };
  if (!input || !UUID.test(input.clientEventId) || !Array.isArray(input.itemIds)
    || !input.itemIds.length || input.itemIds.some(id => typeof id !== "string" || !UUID.test(id))
    || new Set(input.itemIds).size !== input.itemIds.length
    || !ORDER_POSITION_SURFACES.some(surface => surface.key !== "offen" && surface.key === input.oberflaeche)) {
    return { code: "VALIDATION_ERROR" as const };
  }
  return withPrivilegedTenantTransaction(auth, async tx => {
    await sperreMandantenlaeufe(tx, auth.tenantId);
    const { oberflaeche, itemIds, clientEventId } = input;
    const hash = anfrageHash({ oberflaeche, itemIds });
    const wiederholt = await laufQuittung<Lauf>(tx, auth, clientEventId, START, hash);
    if (wiederholt) return wiederholt;
    const laufteile = await leseBuendelLaufTeile(tx, auth.tenantId, itemIds, oberflaeche, true);
    if (!laufteile) return { code: "CONFLICT" as const, message: ORDER_BUENDEL_LAUF_COPY.itemsNoLongerOpen };
    const auswahl = sql.join(itemIds.map(id => sql`${id}::text`), sql`, `);
    const belegt = await tx.execute(sql`SELECT 1 FROM (${offeneLaeufe(auth.tenantId)}) lauf
      WHERE (lauf.daten->'itemIds') ?| ARRAY[${auswahl}] LIMIT 1`);
    if (belegt.length) return { code: "CONFLICT" as const, message: ORDER_BUENDEL_LAUF_COPY.itemOccupied };
    const laufId = randomUUID();
    return schreibeLaufEreignis(tx, auth, {
      id: laufId, typ: START, text: ORDER_BUENDEL_LAUF_COPY.started(orderPositionSurfaceLabel(oberflaeche)),
      clientEventId, hash, quittung: { laufId, oberflaeche, itemIds: laufteile.itemIds },
    });
  });
}

function teilKennung(clientEventId: string, itemId: string) {
  const bytes = createHash("sha1").update(Buffer.from(clientEventId.replaceAll("-", ""), "hex"))
    .update(itemId).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

class LaufFertigmeldungFehlgeschlagen extends Error {
  constructor(readonly antwort: Exclude<Awaited<ReturnType<typeof setOrderItemFinishedInTransaction>>, { code: "OK" }>) {
    super(antwort.message);
  }
}

export async function beendeLauf(auth: AuthorizationSnapshot, input: EndeEingabe, ports: LaufabschlussPorts) {
  if (!hatLaufrecht(auth)) return { code: "FORBIDDEN" as const };
  if (!input || !UUID.test(input.laufId) || !UUID.test(input.clientEventId)) return { code: "VALIDATION_ERROR" as const };
  const { station, minuten, clientEventId } = input;
  const laufId = input.laufId.toLowerCase();
  if (!station || typeof station !== "string" || station.trim() !== station) {
    return { code: "STATION" as const, message: WORK_TIME_COPY.stationMissing };
  }
  try {
    return await withPrivilegedTenantTransaction(auth, async tx => {
      await sperreMandantenlaeufe(tx, auth.tenantId);
      const hash = anfrageHash({ laufId, station, minuten });
      const wiederholt = await laufQuittung<LaufAbschluss>(tx, auth, clientEventId, ENDE, hash);
      if (wiederholt) return wiederholt;
      const [lauf] = await tx.execute<{ daten: Lauf }>(sql`SELECT daten FROM (${offeneLaeufe(auth.tenantId)}) offen
        WHERE daten->>'laufId' = ${laufId}`);
      if (!lauf) return { code: "NOT_FOUND" as const, message: ORDER_BUENDEL_LAUF_COPY.runNotFound };
      const { oberflaeche, itemIds } = lauf.daten;
      const laufteile = await leseBuendelLaufTeile(tx, auth.tenantId, itemIds, oberflaeche, true);
      if (!laufteile) return { code: "CONFLICT" as const, message: ORDER_BUENDEL_LAUF_COPY.itemsNoLongerOpen };
      const anteile = ports.verteileMinuten(laufteile.auftraege, minuten);
      if (!anteile) return { code: "DAUER" as const, message: WORK_TIME_COPY.invalidDuration };
      if (!anteile.zuordnung) return { code: "DAUER" as const, message: WORK_TIME_COPY.buendelLaufMindestdauer(anteile.mindestdauer) };
      const zeit = await ports.zeitBuchen(tx, auth, { laufId, station, minuten, clientEventId, auftraege: laufteile.auftraege });
      if (zeit.code !== "OK") return zeit;

      const versionen = new Map<string, number>();
      for (const teil of laufteile.teile) {
        const ergebnis = await ports.teilFertigMelden(tx, auth, {
          orderId: teil.auftragId, itemId: teil.itemId, finished: true,
          clientEventId: teilKennung(clientEventId, teil.itemId),
          expectedVersion: versionen.get(teil.auftragId) ?? teil.version,
        });
        if (ergebnis.code !== "OK") throw new LaufFertigmeldungFehlgeschlagen(ergebnis);
        versionen.set(teil.auftragId, ergebnis.receipt.aggregateVersion);
      }
      const auftraege = sql.join(laufteile.auftraege.map(({ auftragId }) => sql`${auftragId}`), sql`, `);
      const offeneAuftraege = await tx.execute<{ auftragId: string }>(sql`
        SELECT DISTINCT order_id AS "auftragId" FROM public.items WHERE tenant_id = ${auth.tenantId}
          AND order_id IN (${auftraege}) AND current_station_id IS DISTINCT FROM 'fertig'
      `);
      const nochOffen = new Set(offeneAuftraege.map(auftrag => auftrag.auftragId));
      const fertigMeldenVorschlag = laufteile.auftraege.map(auftrag => auftrag.auftragId).filter(id => !nochOffen.has(id));
      return schreibeLaufEreignis(tx, auth, {
        id: randomUUID(), typ: ENDE, text: ORDER_BUENDEL_LAUF_COPY.completed(orderPositionSurfaceLabel(oberflaeche)),
        clientEventId, hash, quittung: { laufId, buchungsIds: zeit.buchungsIds, fertigMeldenVorschlag },
      });
    });
  } catch (error) {
    if (error instanceof LaufFertigmeldungFehlgeschlagen) return error.antwort;
    throw error;
  }
}
