import "server-only";

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { canBackdateWorkTime, hasAuthorizationArea } from "@/lib/auth/authorizationContract";
import { berlinCalendarDay } from "@/lib/domain/workingDays";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { ORDER_CONTENT_COPY } from "@/ui/ordersCopy";
import { WORK_TIME_COPY } from "@/ui/werkstattCopy";

type ArbeitszeitEingabe = {
  auftragId: string;
  itemId?: string | null;
  station: string;
  minuten: number;
  tag: string;
  korrigiertId?: string | null;
  grund?: string | null;
  clientEventId: string;
};

type Zeitbuchung = {
  id: string;
  clientEventId: string;
  laufId: string | null;
  auftragId: string;
  itemId: string | null;
  station: string;
  minuten: number;
  tag: string;
  akteur: string;
  korrigiertId: string | null;
  grund: string | null;
};

type NeueZeitzeile = {
  clientEventId: string;
  auftragId: string;
  itemId: string | null;
  station: string;
  tag: string;
  minuten: number;
  kostenstelle: string | null;
  kostensatz: string | null;
  kostensatzQuelle: string | null;
  laufId: string | null;
  korrigiertId: string | null;
  grund: string | null;
};

export type ArbeitszeitLeser = {
  auftrag: (tx: PrivilegedTenantTransaction, tenantId: string, auftragId: string, itemId: string | null) => Promise<boolean>;
  station: (tx: PrivilegedTenantTransaction, tenantId: string, station: string) =>
    Promise<{ kostenstelle: string; maximalMinuten: number } | null>;
  personensatz: (tx: PrivilegedTenantTransaction, tenantId: string, personId: string) => Promise<string | null>;
  standardsatz: (tx: PrivilegedTenantTransaction, tenantId: string) => Promise<{ hourlyRateCents: number | null } | null>;
};

type KostensatzLeser = Pick<ArbeitszeitLeser, "personensatz" | "standardsatz">;
type LaufZeitLeser = KostensatzLeser & Pick<ArbeitszeitLeser, "station">;

type Zeitfehler = "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "EINGABE" | "DATUM" | "GRUND" | "KORREKTUR"
  | "STATION" | "DAUER" | "KOSTENSATZ";
type Zeitantwort = { code: "OK"; id: string } | { code: Zeitfehler; message?: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idText = (wert: unknown): wert is string =>
  typeof wert === "string" && wert.length > 0 && wert.length <= 128 && wert === wert.trim() && !wert.includes("\u0000");
const tagText = (wert: unknown): wert is string => {
  if (typeof wert !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
  const datum = new Date(wert + "T00:00:00Z");
  return Number.isFinite(datum.getTime()) && datum.toISOString().slice(0, 10) === wert && wert >= "0100-01-01";
};

function istEingabe(eingabe: unknown): eingabe is ArbeitszeitEingabe {
  if (!eingabe || typeof eingabe !== "object" || Array.isArray(eingabe)) return false;
  const wert = eingabe as Record<string, unknown>;
  return idText(wert.auftragId) && (wert.itemId == null || idText(wert.itemId))
    && idText(wert.station) && tagText(wert.tag)
    && typeof wert.minuten === "number" && Number.isSafeInteger(wert.minuten)
    && wert.minuten !== 0 && Math.abs(wert.minuten) <= 2_147_483_647
    && (wert.korrigiertId == null || typeof wert.korrigiertId === "string" && uuid.test(wert.korrigiertId))
    && (wert.grund == null || typeof wert.grund === "string" && !wert.grund.includes("\u0000"))
    && typeof wert.clientEventId === "string" && uuid.test(wert.clientEventId);
}

const buchungsdaten = sql`
  id::text, client_event_id::text AS "clientEventId", lauf_id::text AS "laufId",
  auftrag_id AS "auftragId", item_id AS "itemId", station_kuerzel AS station, dauer_minuten AS minuten,
  (start_zeit AT TIME ZONE 'Europe/Berlin')::date::text AS tag, employee_id::text AS akteur,
  korrigiert_id::text AS "korrigiertId", coalesce(korrektur_grund, bemerkung) AS grund
`;

function bekannteQuittung(
  bereits: Zeitbuchung,
  eingabe: ArbeitszeitEingabe,
  akteur: string,
  grund: string | null,
): Zeitantwort {
  const gleich = bereits.laufId === null && bereits.auftragId === eingabe.auftragId && bereits.itemId === (eingabe.itemId ?? null)
    && bereits.station === eingabe.station && bereits.minuten === eingabe.minuten && bereits.tag === eingabe.tag
    && bereits.akteur === akteur && bereits.korrigiertId === (eingabe.korrigiertId?.toLowerCase() ?? null)
    && bereits.grund === grund;
  return gleich ? { code: "OK", id: bereits.id } : { code: "CONFLICT" };
}

async function liesKostensatz(
  tx: PrivilegedTenantTransaction,
  auth: AuthorizationSnapshot,
  leser: KostensatzLeser,
) {
  const person = await leser.personensatz(tx, auth.tenantId, auth.userId);
  if (person !== null) return { betrag: person, quelle: "person" };
  const standard = (await leser.standardsatz(tx, auth.tenantId))?.hourlyRateCents;
  if (standard == null) return null;
  return { betrag: (standard / 100).toFixed(2), quelle: "standard" };
}

async function speichereZeitzeilen(
  tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, zeilen: readonly NeueZeitzeile[],
) {
  const werte = sql.join(zeilen.map(zeile => sql`(
    ${zeile.clientEventId}::uuid, ${zeile.auftragId}::text, ${zeile.itemId}::text, ${zeile.station}::text,
    ${zeile.tag}::date, ${zeile.minuten}::integer, ${zeile.kostenstelle}::text,
    ${zeile.kostensatz}::numeric, ${zeile.kostensatzQuelle}::text, ${zeile.laufId}::uuid,
    ${zeile.korrigiertId}::uuid, ${zeile.grund}::text
  )`), sql`, `);
  return tx.execute<{ id: string; clientEventId: string }>(sql`
    INSERT INTO public.arbeitszeit_buchung (
      id, tenant_id, auftrag_id, item_id, employee_id, station_kuerzel, start_zeit, dauer_minuten, kostenstelle_kuerzel,
      kostensatz_eur_pro_stunde, kostensatz_quelle, erfasst_modus, lauf_id, client_event_id, korrigiert_id,
      bemerkung, korrektur_grund
    )
    SELECT CASE WHEN neu.lauf_id IS NOT NULL THEN neu.client_event_id ELSE gen_random_uuid() END,
      ${auth.tenantId}, neu.auftrag_id, neu.item_id, ${auth.userId}::uuid, neu.station,
      (neu.tag + time '00:00') AT TIME ZONE 'Europe/Berlin', neu.minuten,
      coalesce(alt.kostenstelle_kuerzel, neu.kostenstelle),
      coalesce(alt.kostensatz_eur_pro_stunde, neu.kostensatz),
      CASE WHEN alt.id IS NULL THEN neu.kostensatz_quelle ELSE alt.kostensatz_quelle END,
      CASE WHEN neu.lauf_id IS NULL THEN 'einzel' ELSE 'lauf' END,
      neu.lauf_id, neu.client_event_id, neu.korrigiert_id,
      CASE WHEN neu.korrigiert_id IS NULL THEN neu.grund END,
      CASE WHEN neu.korrigiert_id IS NOT NULL THEN neu.grund END
    FROM (VALUES ${werte}) AS neu(
      client_event_id, auftrag_id, item_id, station, tag, minuten, kostenstelle, kostensatz,
      kostensatz_quelle, lauf_id, korrigiert_id, grund
    )
    LEFT JOIN public.arbeitszeit_buchung alt ON alt.tenant_id = ${auth.tenantId}
      AND alt.id = neu.korrigiert_id AND alt.auftrag_id = neu.auftrag_id
      AND alt.item_id IS NOT DISTINCT FROM neu.item_id AND alt.station_kuerzel = neu.station
      AND (alt.start_zeit AT TIME ZONE 'Europe/Berlin')::date = neu.tag
    WHERE neu.korrigiert_id IS NULL OR alt.id IS NOT NULL
    RETURNING id::text, client_event_id::text AS "clientEventId"
  `);
}

function darfArbeitszeitBuchen(auth: AuthorizationSnapshot) {
  return auth.active && hasAuthorizationArea(auth, "auftraege") && auth.permissions.includes("perm_op_status")
    && auth.packageSwitches?.p3_werkstatt === true;
}

export async function bookWorkTime(
  auth: AuthorizationSnapshot,
  input: unknown,
  leser: ArbeitszeitLeser,
): Promise<Zeitantwort> {
  if (!darfArbeitszeitBuchen(auth)) return { code: "FORBIDDEN" };
  if (!istEingabe(input)) return { code: "EINGABE", message: WORK_TIME_COPY.invalidInput };

  const tenant = auth.tenantId;
  const akteur = auth.userId;
  const grund = input.grund?.trim() || null;
  const itemId = input.itemId ?? null;
  const korrigiertId = input.korrigiertId ?? null;
  const heute = berlinCalendarDay();
  return withPrivilegedTenantTransaction<Zeitantwort>(auth, async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(
      'werkstatt:arbeitszeit:' || ${tenant} || ':' || ${input.clientEventId.toLowerCase()}, 0))`);
    const [bereits] = await tx.execute<Zeitbuchung>(sql`
      SELECT ${buchungsdaten} FROM public.arbeitszeit_buchung
      WHERE tenant_id = ${tenant} AND client_event_id = ${input.clientEventId}::uuid
    `);
    if (bereits) return bekannteQuittung(bereits, input, akteur, grund);

    if (input.tag > heute || (input.tag < heute && !canBackdateWorkTime(auth.role))) {
      return { code: "DATUM" };
    }
    if (input.tag < heute && grund === null) return { code: "GRUND", message: WORK_TIME_COPY.backdateReasonRequired };
    if (korrigiertId !== null && grund === null) return { code: "KORREKTUR", message: WORK_TIME_COPY.invalidInput };
    if (input.minuten < 0 && korrigiertId === null) return { code: "KORREKTUR", message: WORK_TIME_COPY.invalidDuration };
    if (!await leser.auftrag(tx, tenant, input.auftragId, itemId)) {
      return { code: "NOT_FOUND", ...(itemId ? { message: WORK_TIME_COPY.itemUnavailable } : {}) };
    }

    let kostenstelle: string | null = null;
    let satz: Awaited<ReturnType<typeof liesKostensatz>> = null;
    if (korrigiertId === null) {
      const station = await leser.station(tx, tenant, input.station);
      if (!station) return { code: "STATION", message: WORK_TIME_COPY.stationMissing };
      if (Math.abs(input.minuten) > station.maximalMinuten) return { code: "DAUER", message: WORK_TIME_COPY.invalidDuration };
      satz = await liesKostensatz(tx, auth, leser);
      if (!satz) return { code: "KOSTENSATZ", message: WORK_TIME_COPY.costRateUnset };
      kostenstelle = station.kostenstelle;
    } else {
      const [original] = await tx.execute<{ minuten: number }>(sql`
        SELECT dauer_minuten AS minuten FROM public.arbeitszeit_buchung
        WHERE tenant_id = ${tenant} AND id = ${korrigiertId}::uuid AND auftrag_id = ${input.auftragId}
          AND item_id IS NOT DISTINCT FROM ${itemId} AND station_kuerzel = ${input.station}
          AND (start_zeit AT TIME ZONE 'Europe/Berlin')::date = ${input.tag}::date
          AND korrigiert_id IS NULL AND dauer_minuten > 0
        FOR UPDATE
      `);
      if (!original) return { code: "KORREKTUR" };

      // Das Lesen nach der Sperre sieht auch Korrekturen aus der vorherigen Transaktion.
      const [rest] = await tx.execute<{ reicht: boolean }>(sql`
        SELECT ${original.minuten}::bigint + coalesce(sum(dauer_minuten), 0) + ${input.minuten}::bigint >= 0 AS reicht
        FROM public.arbeitszeit_buchung
        WHERE tenant_id = ${tenant} AND korrigiert_id = ${korrigiertId}::uuid
      `);
      if (!rest?.reicht) return { code: "KORREKTUR", message: ORDER_CONTENT_COPY.workTimeChanged };
    }

    const [buchung] = await speichereZeitzeilen(tx, auth, [{
      clientEventId: input.clientEventId, auftragId: input.auftragId, itemId,
      station: input.station, tag: input.tag, minuten: input.minuten, kostenstelle,
      kostensatz: satz?.betrag ?? null, kostensatzQuelle: satz?.quelle ?? null, laufId: null, korrigiertId, grund,
    }]);
    return buchung ? { code: "OK", id: buchung.id } : { code: "KORREKTUR" };
  });
}

type LaufAuftrag = Readonly<{ auftragId: string; teile: string }>;
export type LaufEingabe = {
  laufId: string;
  station: string;
  minuten: number;
  clientEventId: string;
  auftraege: readonly LaufAuftrag[];
};
export type LaufAntwort = { code: "OK"; buchungsIds: string[] } | { code: Zeitfehler; message?: string };

export function verteileLaufMinuten(auftraege: readonly LaufAuftrag[], minuten: number) {
  if (auftraege.length < 2 || new Set(auftraege.map(auftrag => auftrag.auftragId)).size !== auftraege.length
    || !Number.isSafeInteger(minuten) || minuten <= 0 || minuten > 2_147_483_647) return null;
  const teile: { auftragId: string; ziffern: string; nachkommastellen: number }[] = [];
  let stellen = 0;
  for (const { auftragId, teile: menge } of auftraege) {
    const match = /^(\d+)(?:\.(\d+))?$/.exec(menge);
    if (!idText(auftragId) || !match) return null;
    const nachkommastellen = match[2]?.length ?? 0;
    teile.push({ auftragId, ziffern: match[1] + (match[2] ?? ""), nachkommastellen });
    stellen = Math.max(stellen, nachkommastellen);
  }
  const gewichte = teile.map(teil => BigInt(teil.ziffern.padEnd(
    teil.ziffern.length + stellen - teil.nachkommastellen, "0",
  )));
  let summe = BigInt(0);
  let kleinstes = gewichte[0];
  let groesstes = 0;
  for (const [index, gewicht] of gewichte.entries()) {
    if (gewicht <= BigInt(0)) return null;
    summe += gewicht;
    if (gewicht < kleinstes) kleinstes = gewicht;
    if (gewicht > gewichte[groesstes]) groesstes = index;
  }
  const mindestdauer = (summe + kleinstes - BigInt(1)) / kleinstes;
  if (BigInt(minuten) < mindestdauer) return { mindestdauer: mindestdauer.toString(), zuordnung: null };
  const anzahlen = gewichte.map(gewicht => Number(BigInt(minuten) * gewicht / summe));
  anzahlen[groesstes] += minuten - anzahlen.reduce((gesamt, wert) => gesamt + wert, 0);
  return { mindestdauer: mindestdauer.toString(), zuordnung: auftraege.map((auftrag, index) => ({
    auftragId: auftrag.auftragId, minuten: anzahlen[index],
  })) };
}

export type LaufZeitverteilung = ReturnType<typeof verteileLaufMinuten>;

function laufBuchungsKennung(clientEventId: string, auftragId: string) {
  const bytes = createHash("sha1").update(Buffer.from(clientEventId.replaceAll("-", ""), "hex"))
    .update(auftragId, "utf8").digest();
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.subarray(0, 16).toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

/** Wird mit dem Fertigmelden der Laufteile in derselben Transaktion aufgerufen. */
export async function bookLaufZeit(
  tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, input: LaufEingabe, leser: LaufZeitLeser,
): Promise<LaufAntwort> {
  if (!darfArbeitszeitBuchen(auth)) return { code: "FORBIDDEN" };
  const stand = verteileLaufMinuten(input.auftraege, input.minuten);
  if (!stand || !uuid.test(input.laufId) || !uuid.test(input.clientEventId) || !idText(input.station)) {
    return { code: "EINGABE", message: WORK_TIME_COPY.invalidInput };
  }
  if (!stand.zuordnung) return { code: "DAUER", message: WORK_TIME_COPY.buendelLaufMindestdauer(stand.mindestdauer) };
  const ids = stand.zuordnung.map(auftrag => laufBuchungsKennung(input.clientEventId, auftrag.auftragId));
  const tenant = auth.tenantId;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(
    'werkstatt:laufzeit:' || ${tenant} || ':' || ${input.laufId.toLowerCase()}, 0))`);
  const vorhanden = await tx.execute<Zeitbuchung>(sql`
    SELECT ${buchungsdaten} FROM public.arbeitszeit_buchung
    WHERE tenant_id = ${tenant} AND lauf_id = ${input.laufId}::uuid
  `);
  if (vorhanden.length) {
    const jeKennung = new Map(vorhanden.map(buchung => [buchung.clientEventId, buchung]));
    const gleich = vorhanden.length === ids.length && stand.zuordnung.every((auftrag, index) => {
      const zeile = jeKennung.get(ids[index]);
      return zeile?.auftragId === auftrag.auftragId && zeile.minuten === auftrag.minuten
        && zeile.station === input.station && zeile.akteur === auth.userId;
    });
    return gleich ? { code: "OK", buchungsIds: ids } : { code: "CONFLICT" };
  }

  const station = await leser.station(tx, tenant, input.station);
  if (!station) return { code: "STATION", message: WORK_TIME_COPY.stationMissing };
  if (input.minuten > station.maximalMinuten) return { code: "DAUER", message: WORK_TIME_COPY.invalidDuration };
  const satz = await liesKostensatz(tx, auth, leser);
  if (!satz) return { code: "KOSTENSATZ", message: WORK_TIME_COPY.costRateUnset };
  const tag = berlinCalendarDay();
  const zeilen = await speichereZeitzeilen(tx, auth, stand.zuordnung.map((auftrag, index) => ({
    ...auftrag, clientEventId: ids[index], itemId: null, station: input.station, tag,
    kostenstelle: station.kostenstelle, kostensatz: satz.betrag, kostensatzQuelle: satz.quelle,
    laufId: input.laufId, korrigiertId: null, grund: null,
  })));
  if (zeilen.length !== ids.length) throw Error("ARBEITSZEIT_LAUF_UNVOLLSTAENDIG");
  return { code: "OK", buchungsIds: ids };
}
