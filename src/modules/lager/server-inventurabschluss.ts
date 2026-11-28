import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { hasLagerCapability } from "@/lib/auth/authorizationContract";
import type { ActionResult } from "@/lib/server/authHelper";
import { LAGER_BUCHUNG_COPY } from "@/ui/lagerBuchungCopy";
import { LAGER_INVENTUR_COPY as copy } from "@/ui/lagerInventurCopy";
import { erstelleLagerInventurCsv } from "./inventur-csv";
import { lagerBefehlsUuid } from "./lagerBuchungsauftrag";
import { imInventurPort } from "./server-inventur";
import type { InventurZeile } from "./server-inventurwerte";
import { leseBilanzbewertungMethode, type LagerEinstellungenLeser } from "./server-lagerregeln";

type Archivbeleg = { dokumentId: string; sha256: string };
type Originaldatei = Archivbeleg & { inhalt: Uint8Array };
type Abschluss = { sessionId: string; csv: Archivbeleg };
type Kopf = { id: string; stichtag: string; abschlussZeit: string; wer: string | null };
type Dateiart = "csv" | "pdf" | "xlsx";
const dateiSpalten = {
  csv: sql`csv_dokument_id,csv_sha256,csv_inhalt`,
  pdf: sql`pdf_dokument_id,pdf_sha256,pdf_inhalt`,
  xlsx: sql`xlsx_dokument_id,xlsx_sha256,xlsx_inhalt`,
};

function istUuid(wert: unknown): wert is string {
  return typeof wert === "string" && lagerBefehlsUuid.test(wert);
}

function sha256(inhalt: Uint8Array): string {
  return createHash("sha256").update(inhalt).digest("hex");
}

export function schliesseLagerInventurAb(
  input: { sessionId: string; befehlId: string }, liesEinstellungen: LagerEinstellungenLeser,
): Promise<ActionResult<Abschluss>> {
  return imInventurPort<Abschluss>(async (tx, akteur, auth) => {
    if (!istUuid(input?.sessionId) || !istUuid(input?.befehlId)) {
      return { ok: false, error: "VALIDATION_ERROR", message: copy.eingabe };
    }
    const mandant = auth.tenantId;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('lager-inventur:' || ${mandant},0))`);
    const [sitzung] = await tx.execute<{
      status: string; befehlId: string | null; akteur: string | null; csvId: string | null; csvSha256: string | null;
    }>(sql`
      SELECT status, abschluss_befehl_id::text AS "befehlId", abgeschlossen_von::text AS akteur,
        csv_dokument_id::text AS "csvId", csv_sha256 AS "csvSha256"
      FROM public.inventory_sessions WHERE tenant_id = ${mandant} AND id = ${input.sessionId}::uuid FOR UPDATE
    `);
    if (!sitzung) return { ok: false, error: "NOT_FOUND", message: copy.belegt };
    if (sitzung.status === "abgeschlossen") {
      if (sitzung.befehlId !== input.befehlId || sitzung.akteur !== akteur || !sitzung.csvId || !sitzung.csvSha256) {
        return { ok: false, error: "CONFLICT", message: copy.abgeschlossen };
      }
      return { ok: true, data: {
        sessionId: input.sessionId, csv: { dokumentId: sitzung.csvId, sha256: sitzung.csvSha256 },
      } };
    }
    const methode = leseBilanzbewertungMethode(await liesEinstellungen(mandant, tx));
    if (!methode) {
      return { ok: false, error: "VALIDATION_ERROR", message: LAGER_BUCHUNG_COPY.einstellungFehlt("bilanzbewertung_methode") };
    }
    await tx.execute(sql`SELECT private.lager_inventur_abschluss_vorbereiten(
      ${input.sessionId}::uuid, ${akteur}::uuid, ${methode}
    )`);
    const zeilen = await tx.execute<{ snapshot: InventurZeile }>(sql`
      SELECT snapshot FROM public.inventory_lines
      WHERE tenant_id = ${mandant} AND session_id = ${input.sessionId}::uuid ORDER BY position
    `);
    const inhalt = erstelleLagerInventurCsv(zeilen.map(zeile => zeile.snapshot));
    const csv = { dokumentId: randomUUID(), sha256: sha256(inhalt) };
    await tx.execute(sql`SELECT private.lager_inventur_abschluss_bestaetigen(
      ${input.sessionId}::uuid, ${input.befehlId}::uuid, ${akteur}::uuid,
      ${csv.dokumentId}::uuid, ${csv.sha256}, ${Buffer.from(inhalt)}::bytea
    )`);
    return { ok: true, data: { sessionId: input.sessionId, csv } };
  }, ["lager.inventur_abschliessen", "lager.werte"], copy.abschlussRecht);
}

export function starteLagerInventurNachtrag(input: { sessionId: string; ursprungId: string; grund: string }) {
  return imInventurPort<string>(async (tx, akteur) => {
    if (!istUuid(input?.sessionId) || !istUuid(input?.ursprungId) || typeof input?.grund !== "string"
      || !input.grund.trim() || input.grund.length > 2000 || input.grund.includes("\u0000")) {
      return { ok: false, error: "VALIDATION_ERROR", message: copy.nachtragGrund };
    }
    const [nachtrag] = await tx.execute<{ id: string }>(sql`
      SELECT private.lager_inventur_nachtrag_starten(
        ${input.sessionId}::uuid, ${input.ursprungId}::uuid, ${akteur}::uuid, ${input.grund}
      )::text AS id
    `);
    if (!nachtrag) throw Error("LAGER_INVENTUR_NACHTRAG_FEHLT");
    return { ok: true, data: nachtrag.id };
  }, ["lager.inventur_abschliessen"], copy.abschlussRecht);
}

export function leseLagerInventurOriginal(
  sessionId?: string, art?: Dateiart,
): Promise<ActionResult<Kopf[] | Originaldatei>> {
  return imInventurPort<Kopf[] | Originaldatei>(async (tx, _akteur, auth) => {
    const mandant = auth.tenantId;
    if (sessionId === undefined && art === undefined) {
      const koepfe = await tx.execute<Kopf>(sql`
        SELECT s.id::text, s.stichtag::text, s.abgeschlossen_am::text AS "abschlussZeit", login.anzeigename AS wer
        FROM public.inventory_sessions s
        LEFT JOIN public.v_lager_akteure_v1 login ON login.tenant_id = s.tenant_id AND login.id = s.abgeschlossen_von
        WHERE s.tenant_id = ${mandant} AND s.status = 'abgeschlossen'
        ORDER BY s.abgeschlossen_am DESC, s.id
      `);
      return { ok: true, data: [...koepfe] };
    }
    if (!hasLagerCapability(auth, "lager.werte")) {
      return { ok: false, error: "FORBIDDEN", message: copy.werteRecht };
    }
    if (!istUuid(sessionId) || !art || !Object.hasOwn(dateiSpalten, art)) {
      return { ok: false, error: "VALIDATION_ERROR", message: copy.eingabe };
    }
    const [datei] = await tx.execute<Originaldatei>(sql`
      SELECT d.id::text AS "dokumentId", d.hash AS "sha256", d.bytes AS inhalt
      FROM (SELECT ${dateiSpalten[art]} FROM public.inventory_sessions
        WHERE tenant_id = ${mandant} AND id = ${sessionId}::uuid AND status = 'abgeschlossen') d(id,hash,bytes)
    `);
    if (!datei?.dokumentId || !datei.sha256 || !datei.inhalt) {
      return { ok: false, error: "NOT_FOUND", message: copy.belegt };
    }
    if (sha256(datei.inhalt) !== datei.sha256) {
      return { ok: false, error: "DB_ERROR", message: copy.archivErneut };
    }
    return { ok: true, data: { ...datei, inhalt: new Uint8Array(datei.inhalt) } };
  }, ["lager.lesen"], LAGER_BUCHUNG_COPY.leserecht);
}
