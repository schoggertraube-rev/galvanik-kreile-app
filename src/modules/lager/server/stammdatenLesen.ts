import "server-only";

import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { LagerUnit } from "../quantity";

type LagerArtikel = {
  id: string;
  name: string;
  variante: string | null;
  groesse: string | null;
  kurznummer: number | null;
  basiseinheit: LagerUnit | null;
  rubrikId: string | null;
  status: "aktiv" | "entwurf";
  version: number;
};

type Gebindeversion = {
  id: string;
  schluessel: string;
  version: number;
  art: string;
  name: string;
  mengenwert: string;
  einheit: LagerUnit;
  basismenge: string | null;
  basiseinheit: LagerUnit | null;
  belegId: string | null;
};

type Metallkurs = {
  id: string;
  datum: string;
  euroProGramm: string;
  quelle: string;
  manuell: boolean;
};

type Metallstamm = {
  metall: string;
  feingehaltProzent: string | null;
  kursMetall: boolean | null;
  paragraph13bMetall: boolean | null;
};

// Nur innerhalb einer mit withPrivilegedTenantTransaction geöffneten Transaktion.
// Der öffentliche Serverport prüft das jeweilige zentrale Lagerrecht vor dem Aufruf.
export async function leseLagerArtikel(
  tx: PrivilegedTenantTransaction,
  mandant: string,
  artikelId: string,
): Promise<LagerArtikel | null> {
  const [artikel] = await tx.execute<LagerArtikel>(sql`
    SELECT id, name, variante, groesse, kurznummer, basiseinheit, rubrik_id AS "rubrikId",
      stamm_status AS status, stamm_version AS version
    FROM public.inventory_items
    WHERE tenant_id = ${mandant}
      AND tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '') AND id = ${artikelId}
  `);
  return artikel ?? null;
}

export async function leseLagerGebindeZumStichtag(
  tx: PrivilegedTenantTransaction,
  mandant: string,
  artikelId: string,
  fachzeit: Date,
): Promise<Gebindeversion[]> {
  const rows = await tx.execute<Gebindeversion>(sql`
    SELECT DISTINCT ON (gebinde_schluessel)
      id::text, gebinde_schluessel AS "schluessel", version, art, name,
      inhalt_menge::text AS "mengenwert", inhalt_einheit AS "einheit",
      umrechnung_basismenge::text AS "basismenge", umrechnung_basiseinheit AS "basiseinheit",
      umrechnung_beleg_id::text AS "belegId"
    FROM public.packaging_definitions
    WHERE tenant_id = ${mandant}
      AND tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '') AND artikel_id = ${artikelId}
      AND gueltig_ab <= ${fachzeit.toISOString()}::timestamptz
    ORDER BY gebinde_schluessel, gueltig_ab DESC
  `);
  return [...rows];
}

export type MetallkursSuche = {
  metall: string;
  datum: string;
  quelle: string;
  manuell: boolean;
  letzterBisDatum?: boolean;
};

// G1 steuert die Auswahl einer Ersatzquelle und den Meldungsweg. Auch
// beim expliziten Rückfall bleibt das tatsächliche Kursdatum sichtbar.
export async function leseLagerMetallkurs(
  tx: PrivilegedTenantTransaction,
  mandant: string,
  suche: MetallkursSuche,
): Promise<Metallkurs | null> {
  const bisDatum = suche.letzterBisDatum
    ? sql`kursdatum <= ${suche.datum}::date`
    : sql`kursdatum = ${suche.datum}::date`;
  const [kurs] = await tx.execute<Metallkurs>(sql`
    SELECT id::text, kursdatum::text AS "datum", eur_pro_gramm::text AS "euroProGramm",
      quelle, manuell
    FROM public.metallkurse
    WHERE tenant_id = ${mandant}
      AND tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '') AND metall = ${suche.metall}
      AND ${bisDatum} AND quelle = ${suche.quelle} AND manuell = ${suche.manuell}
    ORDER BY kursdatum DESC
    LIMIT 1
  `);
  return kurs ?? null;
}

export async function leseLagerMetallstamm(
  tx: PrivilegedTenantTransaction,
  mandant: string,
  artikelId: string,
): Promise<Metallstamm | null> {
  const [metallstamm] = await tx.execute<Metallstamm>(sql`
    SELECT metall, feingehalt_pct::text AS "feingehaltProzent",
      kurs_metall AS "kursMetall", paragraph_13b_metall AS "paragraph13bMetall"
    FROM public.inventory_items
    WHERE tenant_id = ${mandant}
      AND tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '') AND id = ${artikelId} AND metall IS NOT NULL
  `);
  return metallstamm ?? null;
}

export async function leseLagerEntwuerfeFuerHeute(tx: PrivilegedTenantTransaction, mandant: string) {
  const rows = await tx.execute<{
    taskId: string; artikelId: string; version: number; titel: string; faelligAm: string;
  }>(sql`
    SELECT aufgabe.task_id::text AS "taskId", artikel.id AS "artikelId",
      artikel.stamm_version AS version, aufgabe.titel AS titel, aufgabe.faellig_am::text AS "faelligAm"
    FROM public.v_lager_entwurf_aufgaben_v1 aufgabe
    JOIN public.inventory_items artikel
      ON artikel.tenant_id = aufgabe.tenant_id AND artikel.id = aufgabe.artikel_id
    WHERE aufgabe.tenant_id = ${mandant}
      AND aufgabe.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
      AND artikel.stamm_status = 'entwurf'
    ORDER BY aufgabe.faellig_am, aufgabe.task_id
  `);
  return [...rows];
}

export async function leseLagerOrte(tx: PrivilegedTenantTransaction, mandant: string) {
  const rows = await tx.execute<{ id: string; stockwerk: string; bereich: string }>(sql`
    SELECT id::text, stockwerk, bereich FROM public.stock_locations
    WHERE tenant_id = ${mandant}
      AND tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
      AND aktiv
    ORDER BY stockwerk, bereich, id
  `);
  return [...rows];
}


export async function leseLagerArtikelOhnePreisFuerHeute(
  tx: PrivilegedTenantTransaction,
  mandant: string,
) {
  const [stand] = await tx.execute<{ anzahl: number; ersterArtikelId: string | null }>(sql`
    SELECT count(*)::integer AS anzahl, min(artikel.id) AS "ersterArtikelId"
    FROM public.inventory_items artikel
    WHERE artikel.tenant_id = ${mandant}
      AND artikel.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
      AND artikel.stamm_status = 'aktiv'
      AND NOT EXISTS (
        SELECT 1 FROM public.material_prices preis
        WHERE preis.tenant_id = artikel.tenant_id AND preis.artikel_id = artikel.id
          AND preis.waehrung = 'EUR' AND preis.gueltig_ab <= statement_timestamp()
          AND preis.bestaetigt_am <= statement_timestamp()
          AND preis.storniert_am IS NULL AND preis.fehlpreis_am IS NULL
      )
  `);
  if (!stand || !Number.isSafeInteger(stand.anzahl) || stand.anzahl < 0
      || (stand.anzahl > 0 && !stand.ersterArtikelId)) throw Error("LAGER_PREISQUELLE_UNVOLLSTAENDIG");
  return { anzahl: stand.anzahl, ersterArtikelId: stand.ersterArtikelId };
}
