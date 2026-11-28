import "server-only";

import { sql } from "drizzle-orm";
import type { ActionResult } from "@/lib/server/authHelper";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { LAGER_INVENTUR_COPY } from "@/ui/lagerInventurCopy";
import { LAGER_BUCHUNG_COPY } from "@/ui/lagerBuchungCopy";
import { lagerBefehlsUuid } from "./lagerBuchungsauftrag";
import { imInventurPort } from "./server-inventur";
import { leseBilanzbewertungMethode, type LagerEinstellungenLeser } from "./server-lagerregeln";

export type InventurZeile = {
  artikelId: string; kurznummer: number | null; artikelName: string; rubrikName: string | null; ortId: string | null;
  stockwerk: string | null; bereich: string | null; orttyp: string | null; einheit: string | null;
  stichtagAm: string; soll: string | null; rohIst: string | null; ist: string | null;
  differenz: string | null; zwischenmenge: string | null; sollQualitaet: string | null;
  istQualitaet: string | null; countedBy: string | null; countedAt: string | null; ek: string | null;
  preisquelleId: string | null; preisquelle: string | null; wertEur: string | null;
  differenzEur: string | null; bewertung: "unbewertet" | "vorlaeufig"; grund: string | null; klaerstatus: string;
};

export async function leseLagerInventurwerte(
  sessionId: string, liesEinstellungen: LagerEinstellungenLeser,
): Promise<ActionResult<InventurZeile[]>> {
  return imInventurPort<InventurZeile[]>(async (tx, _akteur, auth) => {
    if (typeof sessionId !== "string" || !lagerBefehlsUuid.test(sessionId)) {
      return { ok: false, error: "VALIDATION_ERROR", message: LAGER_INVENTUR_COPY.eingabe };
    }
    return leseWerte(tx, auth.tenantId, sessionId, liesEinstellungen);
  }, ["lager.werte"], LAGER_INVENTUR_COPY.werteRecht);
}

async function leseWerte(tx: PrivilegedTenantTransaction, mandant: string,
  sessionId: string, liesEinstellungen: LagerEinstellungenLeser): Promise<ActionResult<InventurZeile[]>> {
  const [status] = await tx.execute<{ abgeschlossen: boolean }>(sql`
    SELECT status = 'abgeschlossen' AS abgeschlossen FROM public.inventory_sessions
    WHERE tenant_id = ${mandant} AND id = ${sessionId}::uuid FOR SHARE
  `);
  if (!status) return { ok: true, data: [] };
  if (status.abgeschlossen) {
    const zeilen = await tx.execute<{ snapshot: InventurZeile }>(sql`
      SELECT snapshot FROM public.inventory_lines
      WHERE tenant_id = ${mandant} AND session_id = ${sessionId}::uuid
      ORDER BY position
    `);
    return { ok: true, data: zeilen.map(zeile => zeile.snapshot) };
  }
  const methode = leseBilanzbewertungMethode(await liesEinstellungen(mandant, tx));
  if (!methode) {
    return { ok: false, error: "VALIDATION_ERROR", message: LAGER_BUCHUNG_COPY.einstellungFehlt("bilanzbewertung_methode") };
  }
  const zeilen = await tx.execute<InventurZeile>(sql`
    SELECT artikel_id AS "artikelId", kurznummer, artikel_name AS "artikelName", rubrik_name AS "rubrikName", ort_id::text AS "ortId",
      stockwerk, bereich, orttyp, einheit, stichtag_am::text AS "stichtagAm", soll::text, roh_ist::text AS "rohIst",
      ist::text, differenz::text, zwischenmenge::text, soll_qualitaet AS "sollQualitaet", ist_qualitaet AS "istQualitaet",
      counted_by::text AS "countedBy", counted_at::text AS "countedAt", ek::text, preisquelle_id::text AS "preisquelleId",
      preisquelle, wert_eur::text AS "wertEur", differenz_eur::text AS "differenzEur", bewertung, grund, klaerstatus
    FROM private.lager_inventur_zeilen(${sessionId}::uuid, ${methode})
  `);
  return { ok: true, data: [...zeilen] };
}
