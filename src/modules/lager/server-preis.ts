import "server-only";

import { sql } from "drizzle-orm";
import { hasAuthorizationArea, hasLagerCapability } from "@/lib/auth/authorizationContract";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { FINANCIAL_ACCESS_COPY } from "@/ui/financialAccessCopy";
import { LAGER_BUCHUNG_COPY } from "@/ui/lagerBuchungCopy";
import { LAGER_MATERIAL_COPY } from "@/ui/lagerMaterialCopy";
import { lagerBefehlsUuid } from "./lagerBuchungsauftrag";
import { bestimmeLagerRegeln, type LagerBilanzbewertung, type LagerEinstellungenLeser } from "./server-lagerregeln";

type Preisbeleg = { preisId: string; nachbewertungen: number };
type Tx = PrivilegedTenantTransaction;
type Preisstand = { artikelName: string; preisVorhanden: boolean };

function preisloseAuftragsentnahmen(mandant: string, artikelId: string) {
  return sql`
    SELECT journal.id, kosten.order_id
    FROM private.lager_w1_auftragskosten kosten
    JOIN public.stock_movements journal ON journal.tenant_id = ${mandant} AND journal.id = kosten.journal_id
    WHERE kosten.artikel_id = ${artikelId}
      AND journal.befehl_id IS NOT NULL AND journal.befehl_zeile = 1 AND journal.lagerwirksam
      AND journal.quantity < 0 AND journal.kalk_ek IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.lager_material_nachbewertungen bewertung
        WHERE bewertung.tenant_id = ${mandant} AND bewertung.event_id = journal.id
      )
  `;
}

export type LagerPreisAufgabe = (
  tx: Tx, auth: AuthorizationSnapshot, artikelId: string, einheit: string,
  lesePreisstand: (tx: Tx, artikelId: string, einheit: string) => Promise<Preisstand | null>,
) => Promise<string | null>;

export async function synchronisiereLagerPreisInTransaction(
  tx: Tx, auth: AuthorizationSnapshot, artikelId: string, einheit: string,
  methode: LagerBilanzbewertung, synchronisiere: LagerPreisAufgabe,
) {
  let preisFehlt = false;
  const aufgabenId = await synchronisiere(tx, auth, artikelId, einheit, async (leseTx, id, preiseinheit) => {
    const [stand] = await leseTx.execute<Preisstand>(sql`
      SELECT artikel.name AS "artikelName", EXISTS (
        SELECT 1 FROM private.lager_kalkulationsbasis(artikel.id, statement_timestamp(), ${methode}) preis
        WHERE preis.einzelpreis > 0
      ) AS "preisVorhanden"
      FROM public.inventory_items artikel
      WHERE artikel.tenant_id = ${auth.tenantId} AND artikel.id = ${id} AND artikel.basiseinheit = ${preiseinheit}
    `);
    preisFehlt = stand?.preisVorhanden === false;
    return stand ?? null;
  });
  return preisFehlt ? aufgabenId : null;
}

export async function hinterlegeLagerPreis(
  input: unknown, liesEinstellungen: LagerEinstellungenLeser, synchronisiere: LagerPreisAufgabe,
): Promise<ActionResult<Preisbeleg>> {
  const login = await resolveAuthorization();
  if (!login.ok) return { ok: false, error: "UNAUTHORIZED", message: LAGER_BUCHUNG_COPY.sitzung };
  const auth = login.data;
  if (auth.packageSwitches?.p4_lager !== true) {
    return { ok: false, error: "FORBIDDEN", message: LAGER_BUCHUNG_COPY.ausgeschaltet };
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "VALIDATION_ERROR", message: LAGER_BUCHUNG_COPY.eingabeUngueltig };
  }
  const { artikelId, einheit, einzelpreis, befehlId } = input as Record<string, unknown>;
  if (typeof artikelId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/u.test(artikelId)
    || typeof einheit !== "string" || !/^[a-z]{1,12}$/u.test(einheit)
    || typeof befehlId !== "string" || !lagerBefehlsUuid.test(befehlId)) {
    return { ok: false, error: "VALIDATION_ERROR", message: LAGER_BUCHUNG_COPY.eingabeUngueltig };
  }
  const preisberechtigt = hasAuthorizationArea(auth, "preise");
  if (!preisberechtigt && !hasLagerCapability(auth, "lager.buchen")) {
    return { ok: false, error: "FORBIDDEN", message: FINANCIAL_ACCESS_COPY.pricesMissing };
  }

  const eingabe = typeof einzelpreis === "string" || typeof einzelpreis === "number" ? String(einzelpreis).trim() : "";
  const preis = eingabe.replace(/\s*€$/u, "").replace(",", ".");
  if (preisberechtigt && !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,4})?$/u.test(preis)) {
    return { ok: false, error: "VALIDATION_ERROR", message: LAGER_MATERIAL_COPY.preisUngueltig(eingabe, einheit) };
  }
  if (preisberechtigt && !/[1-9]/u.test(preis)) {
    return { ok: false, error: "VALIDATION_ERROR", message: LAGER_MATERIAL_COPY.preisNull(einheit) };
  }

  const mandant = auth.tenantId;
  try {
    return await withPrivilegedTenantTransaction(auth, async (tx) => {
      const [artikel] = await tx.execute<{ name: string; basiseinheit: string | null }>(sql`
        SELECT name, basiseinheit FROM public.inventory_items
        WHERE tenant_id = ${mandant} AND id = ${artikelId}
        FOR UPDATE
      `);
      const regeln = artikel?.basiseinheit === einheit
        ? bestimmeLagerRegeln(await liesEinstellungen(mandant, tx))
        : null;
      if (!preisberechtigt) {
        if (artikel && regeln?.ok) {
          const [stand] = await tx.execute<{ offen: boolean }>(sql`
            WITH entnahmen AS MATERIALIZED (${preisloseAuftragsentnahmen(mandant, artikelId)}),
            ausgestellte_rechnungen AS MATERIALIZED (
              SELECT auftrag_id FROM private.lager_material_rechnung(
                ARRAY(SELECT DISTINCT order_id FROM entnahmen)
              )
            )
            SELECT EXISTS (
              SELECT 1 FROM entnahmen
              WHERE NOT EXISTS (SELECT 1 FROM ausgestellte_rechnungen WHERE auftrag_id = entnahmen.order_id)
            ) AS offen
          `);
          if (stand?.offen) {
            const aufgabe = await synchronisiereLagerPreisInTransaction(
              tx, auth, artikelId, einheit, regeln.bilanzbewertung, synchronisiere,
            );
            if (aufgabe) {
              return { ok: false, error: "FORBIDDEN", message: LAGER_MATERIAL_COPY.preisrechtFehlt(artikel.name) };
            }
          }
        }
        return { ok: false, error: "FORBIDDEN", message: FINANCIAL_ACCESS_COPY.pricesMissing };
      }
      if (!artikel) return { ok: false, error: "NOT_FOUND", message: LAGER_BUCHUNG_COPY.artikelFehlt };
      const [beleg] = await tx.execute<Preisbeleg & { stimmtUeberein: boolean; istNeu: boolean }>(sql`
        WITH vorhanden AS MATERIALIZED (
          SELECT id, artikel_id = ${artikelId} AND einzelpreis = ${preis}::numeric
            AND preiseinheit = ${einheit} AS stimmt_ueberein
          FROM public.material_prices WHERE tenant_id = ${mandant} AND befehl_id = ${befehlId}::uuid
        ), neuer_preis AS (
          INSERT INTO public.material_prices (tenant_id, artikel_id, einzelpreis, waehrung, quelle,
            gueltig_ab, bestaetigt_am, befehl_id, preiseinheit)
          SELECT ${mandant}, ${artikelId}, ${preis}::numeric, 'EUR', 'manuell',
            statement_timestamp(), statement_timestamp(), ${befehlId}::uuid, ${einheit}
          WHERE ${regeln?.ok ?? false} AND NOT EXISTS (SELECT 1 FROM vorhanden)
          RETURNING id, einzelpreis
        ), offene_buchungen AS MATERIALIZED (
          ${preisloseAuftragsentnahmen(mandant, artikelId)}
          AND EXISTS (SELECT 1 FROM neuer_preis)
        ), ausgestellte_rechnungen AS MATERIALIZED (
          SELECT auftrag_id FROM private.lager_material_rechnung(
            ARRAY(SELECT DISTINCT order_id FROM offene_buchungen)
          )
        ), nachbewertet AS (
          INSERT INTO public.lager_material_nachbewertungen
            (tenant_id, event_id, artikel_id, befehl_id, preisquelle_id, kalk_ek, aufschlag_pct, regel_version)
          SELECT ${mandant}, buchung.id, ${artikelId}, ${befehlId}::uuid, neuer_preis.id,
            neuer_preis.einzelpreis, ${regeln?.ok ? regeln.aufschlag : null}::numeric, ${regeln?.ok ? regeln.version : null}
          FROM neuer_preis CROSS JOIN offene_buchungen buchung
          WHERE NOT EXISTS (SELECT 1 FROM ausgestellte_rechnungen WHERE auftrag_id = buchung.order_id)
          RETURNING event_id
        )
        SELECT id::text AS "preisId", true AS "stimmtUeberein", true AS "istNeu",
          (SELECT count(*)::integer FROM nachbewertet) AS nachbewertungen
        FROM neuer_preis
        UNION ALL
        SELECT vorhanden.id::text, vorhanden.stimmt_ueberein, false,
          (SELECT count(*)::integer FROM public.lager_material_nachbewertungen
            WHERE tenant_id = ${mandant} AND preisquelle_id = vorhanden.id)
        FROM vorhanden
      `);
      if (beleg && !beleg.stimmtUeberein) return { ok: false, error: "CONFLICT", message: LAGER_BUCHUNG_COPY.befehlKonflikt };
      if (beleg) {
        if (beleg.istNeu && regeln?.ok) {
          await synchronisiereLagerPreisInTransaction(tx, auth, artikelId, einheit, regeln.bilanzbewertung, synchronisiere);
        }
        return { ok: true, data: { preisId: beleg.preisId, nachbewertungen: beleg.nachbewertungen } };
      }
      if (artikel.basiseinheit === null) {
        return { ok: false, error: "VALIDATION_ERROR", message: LAGER_BUCHUNG_COPY.einheit };
      }
      if (artikel.basiseinheit !== einheit) {
        return { ok: false, error: "VALIDATION_ERROR",
          message: LAGER_MATERIAL_COPY.preiseinheitPasstNicht(einheit, artikel.basiseinheit),
          details: { code: "LAGER_PREIS_EINHEIT_PASST_NICHT" } };
      }
      if (regeln && !regeln.ok) {
        return { ok: false, error: "VALIDATION_ERROR", message: LAGER_BUCHUNG_COPY.einstellungFehlt(regeln.schluessel) };
      }
      throw Error("LAGER_PREIS_QUITTUNG_FEHLT");
    });
  } catch (error) {
    const ursache = error instanceof Error ? error.cause ?? error : error;
    if (ursache && typeof ursache === "object" && "constraint_name" in ursache
      && ursache.constraint_name === "material_prices_lager_befehl_key") {
      return { ok: false, error: "CONFLICT", message: LAGER_BUCHUNG_COPY.befehlKonflikt };
    }
    return { ok: false, error: "DB_ERROR", message: LAGER_BUCHUNG_COPY.speichern };
  }
}
