import "server-only";

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { hasLagerCapability, type LagerCapability } from "@/lib/auth/authorizationContract";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { LAGER_BUCHUNG_COPY } from "@/ui/lagerBuchungCopy";
import { LAGER_INVENTUR_COPY } from "@/ui/lagerInventurCopy";
import { leseInventurZaehlauftrag, type InventurZaehlauftrag } from "./inventurZaehlauftrag";
import { lagerBefehlsUuid } from "./lagerBuchungsauftrag";
import type { LagerUnit } from "./quantity";
import { erfasseStammereignis, leseStammquittung } from "./server/stammdatenSchreiben";

type Tx = PrivilegedTenantTransaction;

export type InventurZaehllisteZeile = Readonly<{
  id: string;
  artikelId: string;
  kurznummer: number | null;
  artikelName: string;
  ortId: string;
  stockwerk: string;
  bereich: string;
  menge: string | null;
  einheit: LagerUnit | null;
  mengenqualitaet: "exakt" | "geschaetzt" | null;
  gebindeId: string | null;
  anzahl: string | null;
  rest: string | null;
  countedBy: string | null;
  countedAt: string | null;
  version: number;
  bewegungRevision: string;
}>;

type Zeilenstand = Pick<InventurZaehllisteZeile, "version" | "menge" | "einheit" | "mengenqualitaet">;
export type InventurZaehlquittung =
  | ({ code: "OK"; id: string; bewegungRevision?: string } & Zeilenstand)
  | ({ code: "VERSION_KONFLIKT"; message: string; countedBy: string | null } & Zeilenstand)
  | ({ code: "BEWEGUNG_KONFLIKT"; message: string; bewegungRevision: string } & Zeilenstand)
  | { code: "ABGESCHLOSSEN"; message: string };

export type InventurGrund = "missed-issue" | "missed-receipt" | "count-correction" | "pack-unit" | "loss" | "unknown";

const datum = /^\d{4}-\d{2}-\d{2}$/u;
const gruende = new Set<InventurGrund>(["missed-issue", "missed-receipt", "count-correction", "pack-unit", "loss", "unknown"]);

function istUuid(wert: unknown): wert is string {
  return typeof wert === "string" && lagerBefehlsUuid.test(wert);
}

function ungueltig<T>(): ActionResult<T> {
  return { ok: false, error: "VALIDATION_ERROR", message: LAGER_INVENTUR_COPY.eingabe };
}

function istGrund(wert: unknown): wert is InventurGrund {
  return typeof wert === "string" && gruende.has(wert as InventurGrund);
}

export async function imInventurPort<T>(
  arbeit: (tx: Tx, akteur: string, auth: AuthorizationSnapshot) => Promise<ActionResult<T>>,
  rechte: readonly LagerCapability[] = ["lager.zaehlen"],
  rechtFehlt: string = LAGER_INVENTUR_COPY.recht,
): Promise<ActionResult<T>> {
  const login = await resolveAuthorization();
  if (!login.ok) return { ok: false, error: "UNAUTHORIZED", message: LAGER_INVENTUR_COPY.sitzung };
  const auth = login.data;
  if (!rechte.every(recht => hasLagerCapability(auth, recht))) {
    return { ok: false, error: "FORBIDDEN", message: rechtFehlt };
  }
  if (auth.packageSwitches?.p4_lager !== true || auth.packageSwitches?.p3_lager_inventur !== true) {
    return { ok: false, error: "FORBIDDEN", message: LAGER_BUCHUNG_COPY.ausgeschaltet };
  }

  try {
    return await withPrivilegedTenantTransaction(auth, (tx) => arbeit(tx, auth.userId, auth));
  } catch (error) {
    const ursache = error instanceof Error ? error.cause ?? error : error;
    const code = ursache && typeof ursache === "object" && "code" in ursache ? ursache.code : null;
    if (code === "23505") return { ok: false, error: "CONFLICT", message: LAGER_INVENTUR_COPY.belegt };
    if (code === "22023" || code === "23503" || code === "23514" || code === "22008") return ungueltig();
    return { ok: false, error: "DB_ERROR", message: LAGER_INVENTUR_COPY.erneut };
  }
}

export function starteLagerInventur(input: Readonly<{ sessionId: string; stichtag: string; ortIds?: readonly string[] }>) {
  return imInventurPort<string>(async (tx, akteur, auth) => {
    const ortIds = Array.isArray(input?.ortIds)
      ? input.ortIds.map((id: unknown) => typeof id === "string" ? id.toLowerCase() : id)
      : undefined;
    if (!istUuid(input?.sessionId) || typeof input?.stichtag !== "string" || !datum.test(input.stichtag)
      || input.ortIds !== undefined && (!ortIds?.length || !ortIds.every(istUuid)
        || new Set(ortIds).size !== ortIds.length)) {
      return ungueltig();
    }

    // Die Datenbank normalisiert den Bereich. Der Wiederholungsweg muss dieselbe Reihenfolge verwenden,
    // damit ein offener Nachtrag den idempotenten Start nicht vor dem ON CONFLICT abweist.
    const bereich = ortIds === undefined
      ? sql`NULL::uuid[]`
      : sql`ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(ortIds.sort())}::jsonb)::uuid)`;
    // Dieselbe Sperre wie im Datenbankbefehl, schon vor der Suche nach einem wiederholten Start.
    // Abschluss und Nachtrag halten sie exklusiv und können deshalb nicht dazwischenlaufen.
    await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(hashtextextended('lager-inventur:' || ${auth.tenantId}, 0))`);
    const [vorhanden] = await tx.execute<{ id: string }>(sql`
      SELECT id::text AS id
      FROM public.inventory_sessions
      WHERE tenant_id = ${auth.tenantId} AND id = ${input.sessionId}::uuid
        AND stichtag = ${input.stichtag}::date AND art = 'stichtag' AND erstellt_von = ${akteur}::uuid
        AND bereich_orte IS NOT DISTINCT FROM ${bereich}
      FOR SHARE
    `);
    if (vorhanden) return { ok: true, data: vorhanden.id };

    const [sitzung] = await tx.execute<{ id: string }>(sql`
      SELECT private.lager_inventur_starten(${input.sessionId}::uuid, ${input.stichtag}::date, ${akteur}::uuid,
        ${bereich})::text AS id
    `);
    if (!sitzung) throw Error("LAGER_INVENTUR_SITZUNG_FEHLT");
    return { ok: true, data: sitzung.id };
  });
}

export function leseLagerInventurZaehlliste(sessionId: string, ortId?: string) {
  return imInventurPort<InventurZaehllisteZeile[]>(async (tx) => {
    if (!istUuid(sessionId) || ortId !== undefined && !istUuid(ortId)) return ungueltig();
    const zeilen = await tx.execute<InventurZaehllisteZeile>(sql`
      SELECT id::text, artikel_id AS "artikelId", kurznummer, artikel_name AS "artikelName", ort_id::text AS "ortId",
        stockwerk, bereich, counted_qty::text AS menge, einheit, mengenqualitaet,
        gebinde_id::text AS "gebindeId", gebinde_anzahl::text AS anzahl, rest_menge::text AS rest,
        counted_by::text AS "countedBy", counted_at::text AS "countedAt", version,
        private.lager_inventur_bewegungsrevision(artikel_id,ort_id,statement_timestamp()) AS "bewegungRevision"
      FROM private.lager_inventur_zaehlzeilen(${sessionId}::uuid,${ortId ?? null}::uuid)
    `);
    return { ok: true, data: [...zeilen] };
  });
}

export function speichereLagerInventurZaehlung(input: unknown) {
  return imInventurPort<InventurZaehlquittung>(async (tx, akteur) => {
    const auftrag = leseInventurZaehlauftrag(input);
    if (!auftrag) return ungueltig();
    const [result] = await tx.execute<{ quittung: InventurZaehlquittung }>(sql`
      SELECT private.lager_inventur_zaehlung_sichern(
        ${auftrag.befehlId}::uuid, ${auftrag.sessionId}::uuid, ${auftrag.artikelId}, ${auftrag.ortId}::uuid,
        ${auftrag.version}, ${akteur}::uuid, ${auftrag.countedAt}::timestamptz, ${auftrag.einheit},
        ${auftrag.menge}::numeric, ${auftrag.mengenqualitaet}, ${auftrag.gebinde?.id ?? null}::uuid,
        ${auftrag.gebinde?.anzahl ?? null}::bigint, ${auftrag.gebinde?.rest ?? null}::numeric,
        ${auftrag.bewegungRevision ?? null}::text
      ) AS quittung
    `);
    if (!result) throw Error("LAGER_INVENTUR_QUITTUNG_FEHLT");
    const quittung = result.quittung;
    switch (quittung.code) {
      case "OK": return { ok: true, data: quittung };
      case "VERSION_KONFLIKT": return { ok: true, data: { ...quittung, message: LAGER_INVENTUR_COPY.version } };
      case "BEWEGUNG_KONFLIKT": return { ok: true, data: { ...quittung, message: LAGER_INVENTUR_COPY.bewegungSeitZaehlung } };
      case "ABGESCHLOSSEN": return { ok: true, data: { ...quittung, message: LAGER_INVENTUR_COPY.abgeschlossen } };
    }
  });
}

export function setzeLagerInventurGrund(input: Readonly<{
  befehlId: string;
  sessionId: string;
  artikelId: string;
  ortId: string;
  grund: InventurGrund;
}>) {
  type Quittung = { id: string; zaehlVersion: number };
  return imInventurPort<Quittung>(async (tx, akteur, auth) => {
    if (!istUuid(input?.befehlId) || !istUuid(input?.sessionId) || typeof input?.artikelId !== "string"
      || !/^[A-Za-z0-9_-]{1,128}$/u.test(input.artikelId) || !istUuid(input?.ortId) || !istGrund(input?.grund)) {
      return ungueltig();
    }

    const art = "inventur.grundSetzen";
    const daten = { sessionId: input.sessionId, artikelId: input.artikelId, ortId: input.ortId, grund: input.grund };
    const absicht = createHash("sha256").update(JSON.stringify({ art, daten })).digest("hex");

    const [sitzung] = await tx.execute<{ status: string }>(sql`
      SELECT status FROM public.inventory_sessions
      WHERE tenant_id = ${auth.tenantId} AND id = ${input.sessionId}::uuid
      FOR UPDATE
    `);
    const ursprung = await leseStammquittung<Quittung>(tx, auth.tenantId, input.befehlId);
    if (ursprung && (ursprung.actor !== akteur || ursprung.hash !== absicht)) {
      return { ok: false, error: "CONFLICT", message: LAGER_INVENTUR_COPY.belegt };
    }
    if (!sitzung) return { ok: false, error: "NOT_FOUND", message: LAGER_INVENTUR_COPY.belegt };
    if (sitzung.status === "abgeschlossen") {
      return { ok: false, error: "CONFLICT", message: LAGER_INVENTUR_COPY.abgeschlossen };
    }
    if (sitzung.status !== "offen") return { ok: false, error: "CONFLICT", message: LAGER_INVENTUR_COPY.belegt };
    if (ursprung) {
      if (!ursprung.beleg) throw Error("LAGER_INVENTUR_GRUND_FEHLT");
      return { ok: true, data: ursprung.beleg };
    }

    const [zaehlung] = await tx.execute<{ version: number; menge: string | null }>(sql`
      SELECT version, counted_qty::text AS menge
      FROM public.inventory_counts
      WHERE tenant_id = ${auth.tenantId} AND session_id = ${input.sessionId}::uuid
        AND artikel_id = ${input.artikelId} AND ort_id = ${input.ortId}::uuid
      FOR UPDATE
    `);
    if (!zaehlung || zaehlung.menge === null) return ungueltig();

    const [gespeichert] = await tx.execute<Quittung>(sql`
      INSERT INTO public.inventory_count_reasons (
        tenant_id, session_id, artikel_id, ort_id, zaehl_version, grund, grund_von, befehl_id
      ) VALUES (
        ${auth.tenantId}, ${input.sessionId}::uuid, ${input.artikelId}, ${input.ortId}::uuid,
        ${zaehlung.version}, ${input.grund}, ${akteur}::uuid, ${input.befehlId}::uuid
      ) ON CONFLICT (tenant_id, session_id, artikel_id, ort_id) DO UPDATE
      SET zaehl_version = EXCLUDED.zaehl_version, grund = EXCLUDED.grund,
        grund_von = EXCLUDED.grund_von, grund_am = statement_timestamp(), befehl_id = EXCLUDED.befehl_id
      RETURNING id::text, zaehl_version AS "zaehlVersion"
    `);
    if (!gespeichert) throw Error("LAGER_INVENTUR_GRUND_FEHLT");
    await erfasseStammereignis(tx, auth, input.befehlId, "LAGER_STAMMBEFEHL_V1", gespeichert.zaehlVersion, {
      art, daten, absicht, beleg: gespeichert,
    });
    return { ok: true, data: gespeichert };
  });
}

export type { InventurZaehlauftrag };
