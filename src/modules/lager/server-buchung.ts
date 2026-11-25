import "server-only";

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { hasAuthorizationArea, hasLagerCapability } from "@/lib/auth/authorizationContract";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { StockMovement } from "@/lib/types/inventory";
import { LAGER_BUCHUNG_COPY as copy } from "@/ui/lagerBuchungCopy";
import {
  leseLagerBuchungsauftrag,
  leseLagerGegenbuchungsauftrag,
  type LagerBuchungsauftrag,
} from "./lagerBuchungsauftrag";
import type { LagerUnit } from "./quantity";
import { readLagerBestandsqualifikationInTransaction } from "./server/stammdatenLesen";
import { bestimmeLagerRegeln, type LagerEinstellungenLeser, type LagerRegelFehler } from "./server-lagerregeln";

type Tx = PrivilegedTenantTransaction;
type Wirkung = (tx: Tx, auth: AuthorizationSnapshot, input: { key: string }) => Promise<void>;
export type LagerBestandsaufgabe = (
  tx: Tx, auth: AuthorizationSnapshot, artikelId: string,
  ports: {
    effect: Wirkung;
    leseBestand: (tx: Tx) => Promise<{ artikelId: string; artikelName: string; negativ: boolean; heute: string }>;
  },
) => Promise<string | null>;

export type LagerBuchungsbeleg = StockMovement & {
  befehlId: string;
  eventId: string;
  imPreisEnthalten: boolean | null;
  mehrarbeitBelegId: string | null;
  preisFehlt: boolean;
};
type Antwort = ActionResult<LagerBuchungsbeleg>;
type Fehler = Extract<Antwort, { ok: false }>;
type Buchung = NonNullable<Awaited<ReturnType<typeof liesOriginal>>>;
type Artikel = { name: string; version: number; basiseinheit: LagerUnit | null; rubrikId: string | null; rubrikName: string | null };
type Zeile = {
  artikel_id: string;
  art: string;
  menge: string;
  ort_id: string;
  einheit: LagerUnit;
  fachzeit: string;
  revision: number;
  mengenqualitaet: string;
  bestandsart: string;
  eigentum?: string;
  geschaeftsgrund: string;
  order_id: string | null;
  bad_id?: string | null;
  beleg_id?: string | null;
  original_datei_id?: string | null;
  kostenstelle?: string | null;
  notiz?: string | null;
  im_preis_enthalten?: boolean | null;
  mehrarbeit_beleg_id?: string | null;
  gegenbuchung_id?: string;
};

function fehler(error: Fehler["error"], message: string): Fehler {
  return { ok: false, error, message };
}

async function liesOriginal(tx: Tx, mandant: string, befehlId: string) {
  const [original] = await tx.execute<{
    id: string; hash: string; akteur: string; befehlId: string; inventoryItemId: string;
    imPreisEnthalten: boolean | null; mehrarbeitBelegId: string | null; preisFehlt: boolean;
    quantity: string; movementType: LagerBuchungsbeleg["movementType"]; unit: LagerUnit;
    orderId: string | null; reason: string | null; createdAt: string;
  }>(sql`
    SELECT id::text, befehl_inhalt_sha256 AS hash, erfasst_von::text AS akteur,
      inventory_item_id AS "inventoryItemId", befehl_id::text AS "befehlId",
      im_preis_enthalten AS "imPreisEnthalten", mehrarbeit_beleg_id AS "mehrarbeitBelegId",
      (order_id IS NOT NULL AND kalk_ek IS NULL
        AND (movement_type IN ('consumption','stock_out','waste')
          OR (movement_type = 'move' AND geschaeftsgrund = 'umlagerung'))) AS "preisFehlt",
      quantity::text, movement_type AS "movementType", mengeneinheit AS unit,
      order_id AS "orderId", notiz AS reason, created_at::text AS "createdAt"
    FROM public.stock_movements
    WHERE tenant_id = ${mandant} AND befehl_id = ${befehlId}::uuid AND befehl_zeile = 1
  `);
  return original;
}

function quittung(original: Buchung, hash: string, auth: AuthorizationSnapshot): Antwort {
  const { hash: alterHash, akteur, orderId, reason, quantity, createdAt, ...beleg } = original;
  if (alterHash !== hash || akteur !== auth.userId) return fehler("CONFLICT", copy.befehlKonflikt);
  return { ok: true, data: {
    ...beleg, eventId: beleg.id, quantity: Number(quantity), orderId: orderId ?? undefined,
    reason: reason ?? undefined, createdAt: new Date(createdAt).toISOString(), createdBy: auth.displayName,
  } };
}

async function ladeArtikel(tx: Tx, mandant: string, artikelId: string) {
  const [artikel] = await tx.execute<Artikel>(sql`
    SELECT a.name, a.stamm_version AS version, a.basiseinheit,
      a.rubrik_id::text AS "rubrikId", r.name AS "rubrikName"
    FROM public.inventory_items a
    LEFT JOIN public.categories r ON r.tenant_id = a.tenant_id AND r.id = a.rubrik_id
    WHERE a.tenant_id = ${mandant} AND a.id = ${artikelId}
    FOR UPDATE OF a
  `);
  return artikel;
}

async function schreibeJournal(
  tx: Tx, auth: AuthorizationSnapshot, befehlId: string, hash: string, zeilen: readonly [Zeile, ...Zeile[]],
  synchronisiere: LagerBestandsaufgabe,
): Promise<Antwort> {
  const [beleg] = await tx.execute<{ id: string }>(sql`
    SELECT bewegung_id::text AS id FROM private.lager_journal_anhaengen(
      ${befehlId}::uuid, ${hash}, ${auth.userId}::uuid, ${JSON.stringify(zeilen)}::jsonb
    )
  `);
  if (!beleg) throw Error("LAGER_JOURNAL_BELEG_FEHLT");
  const artikelId = zeilen[0].artikel_id;
  await synchronisiere(tx, auth, artikelId, {
    effect: async (effectTx, effectAuth, wirkung) => {
      await effectTx.execute(sql`
        SELECT private.lager_stammereignis_anlegen(
          ${effectAuth.tenantId}, ${effectAuth.userId}::uuid, ${wirkung.key}::uuid,
          'LAGER_ARTIKEL_AUFGABE_V1', 1, ${JSON.stringify({ ...wirkung, bewegungId: beleg.id })}::jsonb
        )
      `);
    },
    leseBestand: async (leseTx) => {
      const stand = await readLagerBestandsqualifikationInTransaction(leseTx, auth.tenantId, artikelId);
      if (!stand) throw Error("LAGER_BESTAND_ARTIKEL_FEHLT");
      return { artikelId: stand.artikelId, artikelName: stand.name, negativ: stand.negativ, heute: stand.heute };
    },
  });
  const original = await liesOriginal(tx, auth.tenantId, befehlId);
  if (!original) throw Error("LAGER_JOURNAL_BELEG_FEHLT");
  return quittung(original, hash, auth);
}

async function mitBuchung<T extends { befehlId: string }>(
  input: unknown, liesAuftrag: (input: unknown) => T | null,
  buchen: (tx: Tx, auth: AuthorizationSnapshot, auftrag: T, hash: string) => Promise<Antwort>,
  brauchtAuftragsrecht: (auftrag: T) => boolean = () => false,
): Promise<Antwort> {
  const login = await resolveAuthorization();
  if (!login.ok) return fehler("UNAUTHORIZED", copy.sitzung);
  const auth = login.data;
  if (!hasLagerCapability(auth, "lager.buchen")) return fehler("FORBIDDEN", copy.recht);
  if (auth.packageSwitches?.p4_lager !== true) return fehler("FORBIDDEN", copy.ausgeschaltet);
  const auftrag = liesAuftrag(input);
  if (!auftrag) return fehler("VALIDATION_ERROR", copy.eingabeUngueltig);
  if (brauchtAuftragsrecht(auftrag) && !hasAuthorizationArea(auth, "auftraege")) {
    return fehler("FORBIDDEN", copy.auftragsrecht);
  }

  const mandant = auth.tenantId;
  const hash = createHash("sha256").update(JSON.stringify(auftrag)).digest("hex");
  try {
    return await withPrivilegedTenantTransaction(auth, async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(hashtextextended('lager-inventur:' || ${mandant}, 0))`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(
        hashtextextended('lager-journal:' || ${mandant} || ':' || ${auftrag.befehlId}, 0))`);
      const original = await liesOriginal(tx, mandant, auftrag.befehlId);
      return original ? quittung(original, hash, auth) : buchen(tx, auth, auftrag, hash);
    });
  } catch (error) {
    const ursache = error instanceof Error ? error.cause ?? error : error;
    const code = ursache && typeof ursache === "object" && "code" in ursache ? ursache.code : null;
    if (code === "23505") {
      const gegenbuchung = ursache && typeof ursache === "object" && "constraint_name" in ursache
        && ursache.constraint_name === "stock_movements_lager_gegenbuchung_key";
      return fehler("CONFLICT", gegenbuchung ? copy.gegenbuchungVorhanden : copy.befehlKonflikt);
    }
    if (code === "23503" || code === "22023") return fehler("VALIDATION_ERROR", copy.eingabeUngueltig);
    return fehler("DB_ERROR", copy.speichern);
  }
}

async function pruefeBuchungszeit(tx: Tx, mandant: string, fachzeit: string, ortIds: string[]) {
  const [stand] = await tx.execute<{ vergangen: boolean; abgeschlossen: boolean }>(sql`
    SELECT ${fachzeit}::timestamptz <= statement_timestamp() AS vergangen,
      EXISTS (
        SELECT 1 FROM public.inventory_sessions s
        WHERE s.tenant_id = ${mandant} AND s.art = 'stichtag' AND s.status = 'abgeschlossen'
          AND ${fachzeit}::timestamptz <= ((s.stichtag + time '23:59:59') AT TIME ZONE 'Europe/Berlin')
          AND (s.bereich_orte IS NULL OR s.bereich_orte && ARRAY[${sql.join(ortIds.map(id => sql`${id}::uuid`), sql`,`)}])
      ) AS abgeschlossen
  `);
  if (!stand?.vergangen) return fehler("VALIDATION_ERROR", copy.fachzeit);
  if (stand.abgeschlossen) return fehler("CONFLICT", copy.inventurAbgeschlossen);
  return null;
}

function einstellungsfehler(schluessel: LagerRegelFehler["schluessel"], artikel: Artikel) {
  if (schluessel === "artikel_rubrik") return copy.artikelRubrikFehlt(artikel.name);
  if (schluessel === "entnahme_regel_je_rubrik") {
    return artikel.rubrikName === null ? copy.artikelRubrikFehlt(artikel.name) : copy.entnahmeregelFehlt(artikel.rubrikName);
  }
  return copy.einstellungFehlt(schluessel);
}

type LiesBuchungsauftrag = (input: unknown) => LagerBuchungsauftrag | null;

export function bucheLagerEinzeln(
  input: unknown, liesEinstellungen: LagerEinstellungenLeser, synchronisiere: LagerBestandsaufgabe,
  liesAuftrag: LiesBuchungsauftrag = leseLagerBuchungsauftrag,
): Promise<Antwort> {
  return mitBuchung(input, liesAuftrag, async (tx, auth, auftrag, hash) => {
    const mandant = auth.tenantId;
    const artikel = await ladeArtikel(tx, mandant, auftrag.inventoryItemId);
    if (!artikel) return fehler("NOT_FOUND", copy.artikelFehlt);
    if (artikel.version !== auftrag.revision) return fehler("CONFLICT", copy.artikelGeaendert);
    if (artikel.basiseinheit !== null && artikel.basiseinheit !== auftrag.einheit) return fehler("CONFLICT", copy.einheit);

    const istMehrarbeit = auftrag.mehrarbeitBelegId !== undefined;
    const werkstattEntnahme = !istMehrarbeit && auftrag.orderId !== null && (auftrag.movementType === "consumption"
      || (auftrag.movementType === "stock_out" && auftrag.geschaeftsgrund === "entnahme"));
    const regeln = auftrag.orderId === null ? null : bestimmeLagerRegeln(
      await liesEinstellungen(mandant, tx), werkstattEntnahme ? artikel.rubrikId : undefined,
    );
    if (regeln && !regeln.ok) return fehler("VALIDATION_ERROR", einstellungsfehler(regeln.schluessel, artikel));
    const werkstattUmlagerung = werkstattEntnahme && regeln?.entnahme === "umlagerung";
    const verbrauch = istMehrarbeit || (werkstattEntnahme && regeln?.entnahme === "verbrauch");
    const zielId = auftrag.zielOrtId ?? (werkstattUmlagerung ? auftrag.werkstattOrtId : undefined);
    if (werkstattUmlagerung && !zielId) return fehler("VALIDATION_ERROR", copy.werkstattOrtFehlt);

    const ortIds = [auftrag.ortId];
    if (zielId) ortIds.push(zielId);
    if (auftrag.badProzessOrtId) ortIds.push(auftrag.badProzessOrtId);
    const zeitfehler = await pruefeBuchungszeit(tx, mandant, auftrag.fachzeit, ortIds);
    if (zeitfehler) return zeitfehler;

    const orte = await tx.execute<{ id: string; orttyp: string; badId: string | null }>(sql`
      SELECT id::text, orttyp, bad_id AS "badId"
      FROM public.stock_locations
      WHERE tenant_id = ${mandant} AND aktiv AND bereich IS NOT NULL
        AND id IN (${sql.join(ortIds.map(id => sql`${id}::uuid`), sql`,`)})
    `);
    const quelle = orte.find(ort => ort.id === auftrag.ortId && ort.orttyp !== "bad_prozess");
    if (!quelle) return fehler("NOT_FOUND", copy.ortFehlt);
    const ziel = orte.find(ort => ort.id === zielId && (werkstattUmlagerung
      ? ort.orttyp === "werkstatt" : ort.orttyp !== "bad_prozess"));
    if (zielId && !ziel) {
      return fehler("NOT_FOUND", werkstattUmlagerung ? copy.werkstattOrtFehlt : copy.zielOrtFehlt);
    }
    const bad = orte.find(ort => ort.id === auftrag.badProzessOrtId && ort.orttyp === "bad_prozess");
    if (auftrag.badProzessOrtId && !bad?.badId) return fehler("NOT_FOUND", copy.badOrtFehlt);

    const [einheit] = await tx.execute<{ passt: boolean }>(sql`
      SELECT NOT EXISTS (
        SELECT 1 FROM public.stock_movements
        WHERE tenant_id = ${mandant} AND inventory_item_id = ${auftrag.inventoryItemId}
          AND lagerwirksam AND befehl_id IS NOT NULL AND quantity <> 0
          AND mengeneinheit IS DISTINCT FROM ${auftrag.einheit}
      ) AS passt
    `);
    if (!einheit?.passt) return fehler("CONFLICT", copy.einheit);

    const quellzeile: Zeile = {
      artikel_id: auftrag.inventoryItemId,
      art: werkstattUmlagerung ? "move" : verbrauch ? "consumption" : auftrag.movementType,
      menge: auftrag.movementType === "stock_in" ? auftrag.quantity : "-" + auftrag.quantity,
      ort_id: quelle.id,
      bestandsart: quelle.orttyp === "werkstatt" ? "werkstatt_prozess" : "verfuegbar",
      einheit: auftrag.einheit,
      fachzeit: auftrag.fachzeit,
      revision: auftrag.revision,
      beleg_id: auftrag.belegId,
      original_datei_id: auftrag.originalDateiId,
      mengenqualitaet: auftrag.mengenqualitaet,
      geschaeftsgrund: werkstattUmlagerung ? "umlagerung" : verbrauch ? "verbrauch" : auftrag.geschaeftsgrund,
      order_id: auftrag.orderId,
      kostenstelle: auftrag.kostenstelle,
      notiz: auftrag.reason,
      im_preis_enthalten: auftrag.imPreisEnthalten ?? null,
      mehrarbeit_beleg_id: auftrag.mehrarbeitBelegId ?? null,
    };
    const zeilen: [Zeile, ...Zeile[]] = [quellzeile];
    const zielort = ziel ?? bad;
    if (zielort) zeilen.push({
      ...quellzeile, menge: auftrag.quantity, ort_id: zielort.id, bad_id: bad?.badId,
      bestandsart: "werkstatt_prozess", im_preis_enthalten: null, mehrarbeit_beleg_id: null,
    });
    if (regeln) {
      await tx.execute(sql`SELECT set_config('app.lager_kalkulationsregel', ${JSON.stringify({
        aufschlag: regeln.aufschlag, version: regeln.version, vorlaeufig: false, methode: regeln.bilanzbewertung,
      })}, true)`);
    }
    return schreibeJournal(tx, auth, auftrag.befehlId, hash, zeilen, synchronisiere);
  }, auftrag => auftrag.orderId !== null);
}

type Ursprung = {
  id: string;
  artikelId: string;
  art: string;
  menge: string | null;
  ortId: string | null;
  einheit: LagerUnit | null;
  bestandsart: string;
  eigentum: string;
  mengenqualitaet: string;
  orderId: string | null;
  badId: string | null;
};

export function bucheLagerGegenbuchung(
  input: unknown, _liesEinstellungen: LagerEinstellungenLeser, synchronisiere: LagerBestandsaufgabe,
): Promise<Antwort> {
  return mitBuchung(input, leseLagerGegenbuchungsauftrag, async (tx, auth, auftrag, hash) => {
    const mandant = auth.tenantId;
    const ursprung = await tx.execute<Ursprung>(sql`
      SELECT j.id::text, j.inventory_item_id AS "artikelId", j.movement_type AS art, j.quantity::text AS menge,
        j.ort_id::text AS "ortId", j.mengeneinheit AS einheit, j.bestandsart, j.eigentum,
        j.mengenqualitaet, j.order_id AS "orderId", j.bad_id AS "badId"
      FROM public.stock_movements u
      JOIN public.stock_movements j ON j.tenant_id = u.tenant_id AND j.befehl_id = u.befehl_id
      WHERE u.tenant_id = ${mandant} AND u.id = ${auftrag.ursprungId}::uuid
      ORDER BY j.befehl_zeile
    `);
    const [erste] = ursprung;
    if (!erste) return fehler("NOT_FOUND", copy.eingabeUngueltig);
    const artikel = await ladeArtikel(tx, mandant, erste.artikelId);
    if (!artikel) return fehler("NOT_FOUND", copy.artikelFehlt);

    const zeilen: Zeile[] = [];
    for (const original of ursprung) {
      if (original.menge === null || !original.ortId || !original.einheit
        || ["opening", "count_correction", "reversal"].includes(original.art)) {
        return fehler("VALIDATION_ERROR", copy.gegenbuchungNichtMoeglich);
      }
      zeilen.push({
        artikel_id: original.artikelId, art: "reversal",
        menge: original.menge.startsWith("-") ? original.menge.slice(1) : "-" + original.menge,
        ort_id: original.ortId, einheit: original.einheit, fachzeit: auftrag.fachzeit, revision: artikel.version,
        mengenqualitaet: original.mengenqualitaet, bestandsart: original.bestandsart, eigentum: original.eigentum,
        geschaeftsgrund: "gegenbuchung", order_id: original.orderId, bad_id: original.badId, gegenbuchung_id: original.id,
      });
    }
    const zeitfehler = await pruefeBuchungszeit(tx, mandant, auftrag.fachzeit, zeilen.map(zeile => zeile.ort_id));
    if (zeitfehler) return zeitfehler;
    const [ersteZeile, ...weitereZeilen] = zeilen;
    return schreibeJournal(tx, auth, auftrag.befehlId, hash, [ersteZeile, ...weitereZeilen], synchronisiere);
  });
}
