import "server-only";

import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { readWerkstattWochenzielInTransaction } from "@/lib/server/werkstattStationszahlen";

type Entnahme = "umlagerung" | "verbrauch";
type Bilanzbewertung = "letzter_ek" | "gleitender_durchschnitt" | "hoechster_ek";

export type LagerEinstellungen = Readonly<{
  offline_max_stunden: number;
  geraetefreigabe_aktiv: boolean;
  automatische_inventur_aktiv: boolean;
  material_aufschlag_prozent: number | null;
  lager_regelversion: string | null;
  entnahme_regel_je_rubrik: Readonly<Record<string, Entnahme>>;
  bezugskosten_einbeziehen: boolean;
  bilanzbewertung_methode: Bilanzbewertung;
}>;

export type KanalAnhangGrenzen = Readonly<{ anhang_max_mb: number; mime_original_max_mb: number }>;

export type BetriebswaechterEinstellungen = Readonly<{
  sicherung_hoechstalter_stunden: number;
  wiederherstellungstest_hoechstalter_tage: number;
  sicherung_min_prozent_vortag: number;
  sicherungsort: string | null;
  dienst_ausfall_toleranz_stunden: number;
}>;

export type MahnEinstellungen = Readonly<{
  mahnstufen_tage_nach_faelligkeit: readonly [number,number,number];
  mahnung_letzte_zahlfrist_tage: number;
}>;

export type ZahlungsmusterEinstellungen = Readonly<{
  zahlungsmuster_beobachtungsmonate: number;
  zahlungsmuster_min_rechnungen: number;
  vorkasse_spaet_min_rechnungen: number;
  vorkasse_spaet_tage: number;
  vorkasse_eskalation_mahnstufe: number;
  vorkasse_aufhebung_puenktliche_zahlungen: number;
  skonto_fehlzug_min: number;
  vorkasse_startgrenzen_cent: Readonly<Record<"privat" | "gewerbe" | "oldtimer_kunst", number>>;
  zahlungsanbieter: string | null;
}>;

const kursmetallKennungen = ["gold","silber","palladium","rhodium","nickel","kupfer","zinn","zink"] as const;
type Kursmetall = typeof kursmetallKennungen[number];

type Kursstichtag = "leistungsdatum" | "lieferdatum" | "rechnungsdatum" | "auftragsdatum";

export type MetallkursEinstellungen = Readonly<{
  metal_price_source: string;
  metal_price_fallback_source: string | null;
  kursabruf_uhrzeit: string;
  kursabweichung_prozent: number;
  kursabrufe_max_pro_monat: number;
  kursstichtag: Kursstichtag;
  kurs_metalle: readonly Kursmetall[];
  metallzuschlag_prozent: number | null;
  verlustzuschlag_prozent: number | null;
  metall_mengendifferenz_warnung_prozent: number | null;
  kursklausel_freigabe: string | null;
}>;

type Kennzeichen = Readonly<{akzentfarbe: string}>;

type Zielwerte = Readonly<{
  termintreue_ziel_prozent: number | null;
  werkstatt_wochenziel_auftraege: number | null;
  liquiditaet_mindest_tage: number;
  max_aktive_ziele: number;
  sicherheitsreserve_cent: number | null;
  app_start_datum: string | null;
}>;

type KanalFristen = Readonly<{
  nachfassfrist_gegenvorschlag_arbeitstage: number;
  unzugeordnete_nachrichten_loeschfrist_monate: number;
  steuerberater_email: string | null;
  bank_email: string | null;
}>;

type Stand = Kennzeichen & Zielwerte & KanalFristen & Omit<MetallkursEinstellungen,"kurs_metalle"> & LagerEinstellungen & KanalAnhangGrenzen & BetriebswaechterEinstellungen
  & Omit<MahnEinstellungen,"mahnstufen_tage_nach_faelligkeit">
  & Omit<ZahlungsmusterEinstellungen,"vorkasse_startgrenzen_cent"> & {
  betrieb_messgrenzen: unknown;
  kanal_zielgeraete: readonly string[];
  kanal_aufbewahrung: string;
  ki_sicherheitsschwelle: number | null;
  annahme_zustaende: unknown;
  suchalias_gruppen: unknown;
  energie_pauschale_cent_je_verfahren: Readonly<Record<string, number>>;
  kurs_metalle: unknown;
  mahnstufen_tage_nach_faelligkeit: unknown;
  vorkasse_startgrenzen_cent: unknown;
  abweichungskategorien: unknown;
  berater_stundensatz_cent: number;
  berater_minuten_pro_beleg: number;
  ausschuss_berechnen: boolean;
  werkstatt_zeitwahl: unknown;
  werkstatt_zeit_kostenstellen: Readonly<Record<string, string>>;
  nacharbeit_ursachen: unknown;
  betriebsruhe: unknown;
  versandpuffer_arbeitstage: number;
  termin_knapp_arbeitstage?: number;
  termin_kapazitaet?: {
    tagesleistungEur: number | string;
    passtProzent: number;
    knappProzent: number;
    vorrangProzent: number;
  };
  mehrarbeit_spielraum_basispunkte?: number;
  mehrarbeit_stopp_basispunkte?: number;
  mehrarbeit_schritt_minuten?: number;
  mehrarbeit_max_minuten_je_taetigkeit?: number;
};

async function readSpurDStand(tx: PrivilegedTenantTransaction, tenantId: string): Promise<Stand> {
  const rows = await tx.execute<{ stand: Stand }>(sql`
    SELECT CASE WHEN firma.id IS NULL THEN private.s16d_spur_d_standardwerte()
      ELSE jsonb_build_object(
        'offline_max_stunden', firma.offline_max_stunden,
        'geraetefreigabe_aktiv', firma.geraetefreigabe_aktiv,
        'automatische_inventur_aktiv', firma.automatische_inventur_aktiv,
        'material_aufschlag_prozent', firma.material_aufschlag_prozent,
        'lager_regelversion', firma.lager_regelversion,
        'entnahme_regel_je_rubrik', firma.entnahme_regel_je_rubrik,
        'bezugskosten_einbeziehen', firma.bezugskosten_einbeziehen,
        'bilanzbewertung_methode', firma.bilanzbewertung_methode,
        'ausschuss_berechnen', firma.ausschuss_berechnen,
        'anhang_max_mb', firma.anhang_max_mb,
        'mime_original_max_mb', firma.mime_original_max_mb,
        'werkstatt_zeitwahl', firma.werkstatt_zeitwahl,
        'werkstatt_zeit_kostenstellen', firma.werkstatt_zeit_kostenstellen,
        'nacharbeit_ursachen', firma.nacharbeit_ursachen,
        'betriebsruhe', firma.betriebsruhe,
        'versandpuffer_arbeitstage', firma.versandpuffer_arbeitstage,
        'termin_knapp_arbeitstage', firma.termin_knapp_arbeitstage,
        'termin_kapazitaet', jsonb_build_object(
          'tagesleistungEur', firma.tagesleistung_eur,
          'passtProzent', firma.auslastung_passt_pct,
          'knappProzent', firma.auslastung_knapp_pct,
          'vorrangProzent', firma.auslastung_vorrang_pct
        ),
        'sicherung_hoechstalter_stunden', firma.sicherung_hoechstalter_stunden,
        'wiederherstellungstest_hoechstalter_tage', firma.wiederherstellungstest_hoechstalter_tage,
        'sicherung_min_prozent_vortag', firma.sicherung_min_prozent_vortag,
        'sicherungsort', firma.sicherungsort,
        'dienst_ausfall_toleranz_stunden', firma.dienst_ausfall_toleranz_stunden,
        'mahnstufen_tage_nach_faelligkeit', firma.mahnstufen_tage_nach_faelligkeit,
        'mahnung_letzte_zahlfrist_tage', firma.mahnung_letzte_zahlfrist_tage,
        'zahlungsmuster_beobachtungsmonate', firma.zahlungsmuster_beobachtungsmonate,
        'zahlungsmuster_min_rechnungen', firma.zahlungsmuster_min_rechnungen,
        'vorkasse_startgrenzen_cent', firma.vorkasse_startgrenzen_cent,
        'zahlungsanbieter', firma.zahlungsanbieter,
        'vorkasse_spaet_min_rechnungen', firma.vorkasse_spaet_min_rechnungen,
        'vorkasse_spaet_tage', firma.vorkasse_spaet_tage,
        'vorkasse_eskalation_mahnstufe', firma.vorkasse_eskalation_mahnstufe,
        'vorkasse_aufhebung_puenktliche_zahlungen', firma.vorkasse_aufhebung_puenktliche_zahlungen,
        'skonto_fehlzug_min', firma.skonto_fehlzug_min,
        'metal_price_source', firma.metal_price_source,
        'metal_price_fallback_source', firma.metal_price_fallback_source,
        'kursabruf_uhrzeit', firma.kursabruf_uhrzeit,
        'kursabweichung_prozent', firma.kursabweichung_prozent,
        'kursabrufe_max_pro_monat', firma.kursabrufe_max_pro_monat,
        'kursstichtag', firma.kursstichtag
      ) || jsonb_build_object(
        'kurs_metalle', firma.kurs_metalle,
        'metallzuschlag_prozent', firma.metallzuschlag_prozent,
        'verlustzuschlag_prozent', firma.verlustzuschlag_prozent,
        'metall_mengendifferenz_warnung_prozent', firma.metall_mengendifferenz_warnung_prozent,
        'kursklausel_freigabe', firma.kursklausel_freigabe,
        'akzentfarbe', firma.akzentfarbe,
        'abweichungskategorien', firma.abweichungskategorien,
        'nachfassfrist_gegenvorschlag_arbeitstage', firma.nachfassfrist_gegenvorschlag_arbeitstage,
        'termintreue_ziel_prozent', firma.termintreue_ziel_prozent,
        'werkstatt_wochenziel_auftraege', firma.werkstatt_wochenziel_auftraege,
        'liquiditaet_mindest_tage', firma.liquiditaet_mindest_tage,
        'max_aktive_ziele', firma.max_aktive_ziele,
        'sicherheitsreserve_cent', firma.sicherheitsreserve_cent,
        'app_start_datum', firma.app_start_datum,
        'steuerberater_email', firma.steuerberater_email,
        'berater_stundensatz_cent', firma.berater_stundensatz_cent,
        'berater_minuten_pro_beleg', firma.berater_minuten_pro_beleg,
        'bank_email', firma.bank_email,
        'unzugeordnete_nachrichten_loeschfrist_monate', firma.unzugeordnete_nachrichten_loeschfrist_monate,
        'kanal_zielgeraete', firma.kanal_zielgeraete,
        'betrieb_messgrenzen', firma.betrieb_messgrenzen,
        'kanal_aufbewahrung', firma.kanal_aufbewahrung,
        'ki_sicherheitsschwelle', firma.ki_sicherheitsschwelle,
        'annahme_zustaende', firma.annahme_zustaende,
        'suchalias_gruppen', firma.suchalias_gruppen,
        'energie_pauschale_cent_je_verfahren', firma.energie_pauschale_cent_je_verfahren,
        'mehrarbeit_spielraum_basispunkte', firma.mehrarbeit_spielraum_basispunkte,
        'mehrarbeit_stopp_basispunkte', firma.mehrarbeit_stopp_basispunkte,
        'mehrarbeit_schritt_minuten', firma.mehrarbeit_schritt_minuten,
        'mehrarbeit_max_minuten_je_taetigkeit', firma.mehrarbeit_max_minuten_je_taetigkeit
      ) END AS stand
    FROM (VALUES (1)) AS start(zeile)
    LEFT JOIN public.company_settings AS firma ON firma.tenant_id = ${tenantId}
    WHERE current_setting('app.tenant_id', true) = ${tenantId}
    LIMIT 2
  `);
  if (rows.length !== 1) throw Error("S16D_FIRMENDATEN_NICHT_EINDEUTIG");
  return rows[0].stand;
}

export async function readLagerEinstellungen(
  tenantId: string, tx?: PrivilegedTenantTransaction,
): Promise<LagerEinstellungen> {
  const read = async (transaction: PrivilegedTenantTransaction) => {
    const { offline_max_stunden, geraetefreigabe_aktiv, automatische_inventur_aktiv, material_aufschlag_prozent,
      lager_regelversion, entnahme_regel_je_rubrik, bezugskosten_einbeziehen, bilanzbewertung_methode } =
      await readSpurDStand(transaction, tenantId);
    return { offline_max_stunden, geraetefreigabe_aktiv, automatische_inventur_aktiv, material_aufschlag_prozent,
      lager_regelversion, entnahme_regel_je_rubrik, bezugskosten_einbeziehen, bilanzbewertung_methode };
  };
  return tx ? read(tx) : withPrivilegedTenantTransaction({ tenantId }, read);
}

/** Im bestehenden Rechnungs- und Ausgangsbefehl innerhalb seiner Transaktion lesen. */
export async function readAusschussBerechnenInTransaction(tx: PrivilegedTenantTransaction, tenantId: string) {
  return (await readSpurDStand(tx, tenantId)).ausschuss_berechnen;
}

export async function readWerkstattMehrarbeitInTransaction(tx: PrivilegedTenantTransaction, tenantId: string) {
  const {
    mehrarbeit_spielraum_basispunkte: spielraumBasispunkte,
    mehrarbeit_stopp_basispunkte: stoppBasispunkte,
    mehrarbeit_schritt_minuten: schrittMinuten,
    mehrarbeit_max_minuten_je_taetigkeit: maxMinutenJeTaetigkeit,
  } = await readSpurDStand(tx, tenantId);
  if (spielraumBasispunkte === undefined || stoppBasispunkte === undefined ||
      schrittMinuten === undefined || maxMinutenJeTaetigkeit === undefined) return null;
  return { spielraumBasispunkte, stoppBasispunkte, schrittMinuten, maxMinutenJeTaetigkeit };
}

/** Exakter Satz aus dem App-User im Mandanten der Buchung. */
export async function readWerkstattKostensatzInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string, personId: string,
): Promise<string | null> {
  const [person] = await tx.execute<{ kostensatz: string | null }>(sql`
    SELECT kostensatz_eur_pro_stunde::text AS kostensatz
    FROM public.app_users
    WHERE tenant_id = ${tenantId} AND id = ${personId}::uuid
      AND current_setting('app.tenant_id', true) = ${tenantId}
  `);
  return person?.kostensatz ?? null;
}

/** Kalkulationsvorgaben für den autorisierten Buchhaltungsweg. */
export async function readBeraterzeitKalkulationInTransaction(tx: PrivilegedTenantTransaction, tenantId: string) {
  const {berater_stundensatz_cent,berater_minuten_pro_beleg}=await readSpurDStand(tx,tenantId);
  return {stundensatzCent:berater_stundensatz_cent,minutenProBeleg:berater_minuten_pro_beleg};
}

export async function readKanalAnhangGrenzen(tenantId: string): Promise<KanalAnhangGrenzen> {
  return withPrivilegedTenantTransaction({ tenantId }, async tx => {
    const { anhang_max_mb, mime_original_max_mb } = await readSpurDStand(tx, tenantId);
    return { anhang_max_mb, mime_original_max_mb };
  });
}

type Zeitwahl = Readonly<{ rasterMinuten: number; maximalMinuten: number; schnellwahlMinuten: readonly number[] }>;
type Ursache = Readonly<{ ursacheId: string; name: string; aktiv: boolean }>;

const objekt = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const positiveGanzzahl = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647;
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value;

function gueltigeZeitwahl(value: unknown): value is Zeitwahl {
  if (!objekt(value)) return false;
  const { rasterMinuten, maximalMinuten, schnellwahlMinuten } = value;
  return positiveGanzzahl(rasterMinuten) && positiveGanzzahl(maximalMinuten) && rasterMinuten <= maximalMinuten
    && Array.isArray(schnellwahlMinuten)
    && schnellwahlMinuten.every(eintrag => positiveGanzzahl(eintrag) && eintrag <= maximalMinuten)
    && new Set(schnellwahlMinuten).size === schnellwahlMinuten.length;
}

function gueltigeUrsache(value: unknown): value is Ursache {
  return objekt(value) && text(value.ursacheId, 128) && text(value.name, 180) && typeof value.aktiv === "boolean";
}

export async function readNacharbeitUrsachenInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<readonly Ursache[]> {
  const { nacharbeit_ursachen } = await readSpurDStand(tx, tenantId);
  if (!Array.isArray(nacharbeit_ursachen) || !nacharbeit_ursachen.every(gueltigeUrsache)
    || new Set(nacharbeit_ursachen.map(ursache => ursache.ursacheId)).size !== nacharbeit_ursachen.length) {
    throw Error("S16D_NACHARBEITSURSACHEN_UNGUELTIG");
  }
  return nacharbeit_ursachen;
}

/** S19 und V7 wählen die vorhandenen aktiven Kostenstellen über dieselbe Stationszuordnung. */
export async function readWerkstattZeitstationenInTransaction(
  tx: PrivilegedTenantTransaction, tenant: string | { tenantId: string }, stationen: readonly string[],
) {
  const tenantId = typeof tenant === "string" ? tenant : tenant.tenantId;
  const { werkstatt_zeitwahl, werkstatt_zeit_kostenstellen } = await readSpurDStand(tx, tenantId);
  const zeitwahl = gueltigeZeitwahl(werkstatt_zeitwahl) ? werkstatt_zeitwahl : null;
  const zuordnungen = [...new Set(stationen)].flatMap(station => {
    const kuerzel = Object.hasOwn(werkstatt_zeit_kostenstellen, station)
      ? werkstatt_zeit_kostenstellen[station] : null;
    return text(kuerzel, 128) ? [{ station, kuerzel }] : [];
  });
  if (!zeitwahl || !zuordnungen.length) {
    return new Map<string, { station: string; kostenstelle: string } & Zeitwahl>();
  }

  const kostenstellen = [...new Set(zuordnungen.map(({ kuerzel }) => kuerzel))];
  const zeilen = await tx.execute<{ kuerzel: string }>(sql`
    SELECT kuerzel FROM public.v_accounting_kostenstelle_settings_v1
    WHERE tenant_id = ${tenantId} AND ist_aktiv IS TRUE
      AND kuerzel IN (${sql.join(kostenstellen.map(kuerzel => sql`${kuerzel}`), sql`, `)})
  `);
  const aktiv = new Set(zeilen.map(({ kuerzel }) => kuerzel));
  return new Map(zuordnungen.filter(({ kuerzel }) => aktiv.has(kuerzel)).map(({ station, kuerzel }) =>
    [station, { station, kostenstelle: kuerzel, ...zeitwahl }]));
}

export async function readWerkstattZeitstationInTransaction(
  tx: PrivilegedTenantTransaction, tenant: string | { tenantId: string }, station: string,
) {
  return (await readWerkstattZeitstationenInTransaction(tx, tenant, [station])).get(station) ?? null;
}

export async function readWerkstattZeitwahlInTransaction(
  tx: PrivilegedTenantTransaction, tenant: string | { tenantId: string }, station: string,
) {
  const wahl = await readWerkstattZeitstationInTransaction(tx, tenant, station);
  return wahl ? { rasterMinuten: wahl.rasterMinuten, schnellwahlMinuten: wahl.schnellwahlMinuten } : null;
}

/** S-KAL ergänzt Öffnungstage und die datierte Feiertagsquelle des Bundeslands. */
export async function readBetriebsruheInTransaction(tx: PrivilegedTenantTransaction, tenantId: string) {
  const { betriebsruhe, versandpuffer_arbeitstage, termin_knapp_arbeitstage, termin_kapazitaet } = await readSpurDStand(tx, tenantId);
  return {
    betriebsruhe,
    versandpufferArbeitstage: versandpuffer_arbeitstage,
    knappAbArbeitstagen: termin_knapp_arbeitstage ?? null,
    terminKapazitaet: termin_kapazitaet ?? null,
  };
}

export async function readBetriebswaechterEinstellungenInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<BetriebswaechterEinstellungen> {
  return betriebswaechterAusStand(await readSpurDStand(tx,tenantId));
}

function betriebswaechterAusStand(stand:Stand):BetriebswaechterEinstellungen {
  const { sicherung_hoechstalter_stunden, wiederherstellungstest_hoechstalter_tage, sicherung_min_prozent_vortag,
    sicherungsort, dienst_ausfall_toleranz_stunden } = stand;
  return { sicherung_hoechstalter_stunden, wiederherstellungstest_hoechstalter_tage, sicherung_min_prozent_vortag,
    sicherungsort, dienst_ausfall_toleranz_stunden };
}

/** Die Felder des Firmendialogs stammen aus demselben S16d-Stand. */
export async function readSpurDFirmendialogInTransaction(tx:PrivilegedTenantTransaction,tenantId:string) {
  const stand=await readSpurDStand(tx,tenantId);
  return {
    akzentfarbe:stand.akzentfarbe,
    betriebsruhe:stand.betriebsruhe,
    ausschussBerechnen:stand.ausschuss_berechnen,
    betriebswaechter:betriebswaechterAusStand(stand),
    empfaenger:{steuerberater:stand.steuerberater_email,bank:stand.bank_email},
  };
}

export async function readMahnEinstellungenInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<MahnEinstellungen> {
  const { mahnstufen_tage_nach_faelligkeit: tage, mahnung_letzte_zahlfrist_tage } = await readSpurDStand(tx,tenantId);
  if (!Array.isArray(tage) || tage.length !== 3 || !tage.every(positiveGanzzahl)
    || tage[0] >= tage[1] || tage[1] >= tage[2]) throw Error("S16D_MAHNSTUFEN_UNGUELTIG");
  return { mahnstufen_tage_nach_faelligkeit: [tage[0],tage[1],tage[2]], mahnung_letzte_zahlfrist_tage };
}

export async function readZahlungsmusterEinstellungenInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<ZahlungsmusterEinstellungen> {
  const { zahlungsmuster_beobachtungsmonate, zahlungsmuster_min_rechnungen, vorkasse_startgrenzen_cent,
    vorkasse_spaet_min_rechnungen, vorkasse_spaet_tage, vorkasse_eskalation_mahnstufe,
    vorkasse_aufhebung_puenktliche_zahlungen, skonto_fehlzug_min, zahlungsanbieter } = await readSpurDStand(tx,tenantId);
  if (!objekt(vorkasse_startgrenzen_cent)) throw Error("S16D_STARTGRENZEN_UNGUELTIG");
  const { privat, gewerbe, oldtimer_kunst } = vorkasse_startgrenzen_cent;
  const cent = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  if (!cent(privat) || !cent(gewerbe) || !cent(oldtimer_kunst)) throw Error("S16D_STARTGRENZEN_UNGUELTIG");
  return { zahlungsmuster_beobachtungsmonate, zahlungsmuster_min_rechnungen,
    vorkasse_spaet_min_rechnungen, vorkasse_spaet_tage, vorkasse_eskalation_mahnstufe,
    vorkasse_aufhebung_puenktliche_zahlungen, skonto_fehlzug_min,
    vorkasse_startgrenzen_cent: { privat, gewerbe, oldtimer_kunst }, zahlungsanbieter };
}

export async function readMetallkursEinstellungenInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<MetallkursEinstellungen> {
  const { metal_price_source, metal_price_fallback_source, kursabruf_uhrzeit,
    kursabweichung_prozent, kursabrufe_max_pro_monat, kursstichtag, kurs_metalle,
    metallzuschlag_prozent, verlustzuschlag_prozent, metall_mengendifferenz_warnung_prozent,
    kursklausel_freigabe } = await readSpurDStand(tx,tenantId);
  if (!Array.isArray(kurs_metalle) || !kurs_metalle.every((wert): wert is Kursmetall =>
    kursmetallKennungen.some(metall => metall === wert)) || new Set(kurs_metalle).size !== kurs_metalle.length) {
    throw Error("S16D_KURSMETALLE_UNGUELTIG");
  }
  if ([metallzuschlag_prozent,verlustzuschlag_prozent,metall_mengendifferenz_warnung_prozent]
    .some(wert => wert !== null && (!Number.isFinite(wert) || wert < 0))) {
    throw Error("S16D_METALLPROZENTE_UNGUELTIG");
  }
  return { metal_price_source, metal_price_fallback_source, kursabruf_uhrzeit,
    kursabweichung_prozent, kursabrufe_max_pro_monat, kursstichtag, kurs_metalle,
    metallzuschlag_prozent, verlustzuschlag_prozent, metall_mengendifferenz_warnung_prozent, kursklausel_freigabe };
}

/** Ergänzt den vorhandenen Firmendaten-Stand für Start, App-Rahmen und PWA. */
export async function readFirmenakzentInTransaction(tx: PrivilegedTenantTransaction, tenantId: string) {
  const { akzentfarbe } = await readSpurDStand(tx,tenantId);
  return { akzentfarbe };
}

const abweichungsIds = ["menge","zusatzarbeit","schaden","material_weg","kunde_preis_termin","ort","rueckgabe"] as const;
type Abweichung = Readonly<{ id: typeof abweichungsIds[number]; name: string }>;

function gueltigeAbweichung(value: unknown): value is Abweichung {
  return objekt(value) && abweichungsIds.some(id => id===value.id) && text(value.name,180);
}

export async function readAbweichungskategorienInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<readonly Abweichung[]> {
  const { abweichungskategorien } = await readSpurDStand(tx,tenantId);
  if (!Array.isArray(abweichungskategorien) || !abweichungskategorien.every(gueltigeAbweichung)
    || abweichungskategorien.length !== abweichungsIds.length
    || new Set(abweichungskategorien.map(kategorie=>kategorie.id)).size !== abweichungskategorien.length) {
    throw Error("S16D_ABWEICHUNGSKATEGORIEN_UNGUELTIG");
  }
  return abweichungskategorien;
}

export async function readZielwerteInTransaction(tx: PrivilegedTenantTransaction, tenantId: string): Promise<Zielwerte> {
  const { termintreue_ziel_prozent, liquiditaet_mindest_tage, max_aktive_ziele, sicherheitsreserve_cent,
    app_start_datum } = await readSpurDStand(tx,tenantId);
  return { termintreue_ziel_prozent, werkstatt_wochenziel_auftraege: await readWerkstattWochenzielInTransaction(tx, tenantId), liquiditaet_mindest_tage, max_aktive_ziele, sicherheitsreserve_cent,
    app_start_datum };
}

export async function readKanalFristenInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<KanalFristen> {
  const { nachfassfrist_gegenvorschlag_arbeitstage, unzugeordnete_nachrichten_loeschfrist_monate,
    steuerberater_email, bank_email } = await readSpurDStand(tx,tenantId);
  return { nachfassfrist_gegenvorschlag_arbeitstage, unzugeordnete_nachrichten_loeschfrist_monate,
    steuerberater_email, bank_email };
}

/** Q6 in den Einheiten des bestehenden Kanalvertrags. */
export async function readQ6EinstellungenInTransaction(tx: PrivilegedTenantTransaction, tenantId: string) {
  const stand = await readSpurDStand(tx, tenantId);
  return {
    dateigrenzeBytes: stand.anhang_max_mb * 1_000_000,
    zielgeraete: stand.kanal_zielgeraete,
    aufbewahrung: stand.kanal_aufbewahrung,
    loeschfristUnzugeordnetMonate: stand.unzugeordnete_nachrichten_loeschfrist_monate,
  };
}

type ZustandsChip = Readonly<{ id: string; name: string }>;

function istZustandsChip(wert: unknown): wert is ZustandsChip {
  return objekt(wert) && typeof wert.id === "string" && /^[a-z0-9_-]+$/.test(wert.id) && text(wert.name, 180);
}

export async function readErkennungsEinstellungenInTransaction(tx: PrivilegedTenantTransaction, tenantId: string) {
  const { ki_sicherheitsschwelle, annahme_zustaende } = await readSpurDStand(tx, tenantId);
  if (!Array.isArray(annahme_zustaende) || !annahme_zustaende.every(istZustandsChip)
    || new Set(annahme_zustaende.map(chip => chip.id)).size !== annahme_zustaende.length) {
    throw Error("S16D_ANNAHME_ZUSTAENDE_UNGUELTIG");
  }
  return { ki_sicherheitsschwelle, annahme_zustaende };
}

function istSuchaliasGruppe(wert: unknown): wert is string[] {
  return Array.isArray(wert) && wert.length >= 2 && wert.every(alias => text(alias, 180));
}

export async function readSuchaliasGruppenInTransaction(tx: PrivilegedTenantTransaction, tenantId: string) {
  const { suchalias_gruppen } = await readSpurDStand(tx, tenantId);
  if (!Array.isArray(suchalias_gruppen) || !suchalias_gruppen.every(istSuchaliasGruppe)) {
    throw Error("S16D_SUCHALIAS_UNGUELTIG");
  }
  const normalisiert = suchalias_gruppen.flat().map(alias => alias.trim().normalize("NFC").toLocaleLowerCase("de-DE"));
  if (new Set(normalisiert).size !== normalisiert.length) throw Error("S16D_SUCHALIAS_MEHRDEUTIG");
  return suchalias_gruppen;
}

export async function readEnergiePauschaleInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string, verfahrenId: string,
): Promise<number | null> {
  const { energie_pauschale_cent_je_verfahren } = await readSpurDStand(tx, tenantId);
  return Object.hasOwn(energie_pauschale_cent_je_verfahren, verfahrenId)
    ? energie_pauschale_cent_je_verfahren[verfahrenId] : null;
}

/** Ermittelt den Kursstichtag für einen bereits autorisierten Kundenbeleg. */
export async function readKursstichtagInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string, customerId: string,
): Promise<Kursstichtag> {
  const { kursstichtag } = await readSpurDStand(tx, tenantId);
  const rows = await tx.execute<{ kursstichtag: Kursstichtag | null }>(sql`
    SELECT kursstichtag FROM public.v_customers_settings_v1
    WHERE tenant_id = ${tenantId} AND id = ${customerId}
  `);
  if (rows.length !== 1) throw Error("S16D_KURSSTICHTAG_KUNDE_FEHLT");
  return rows[0].kursstichtag ?? kursstichtag;
}

type Messgrenze = Readonly<{ anlageId:string; regelId:string; einheit:string; maximalwert:number }>;

function istMessgrenze(wert: unknown): wert is Messgrenze {
  return objekt(wert) && typeof wert.anlageId === "string"
    && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(wert.anlageId)
    && text(wert.regelId,120) && text(wert.einheit,40)
    && typeof wert.maximalwert === "number" && Number.isFinite(wert.maximalwert);
}

export async function readBetriebMessgrenzenInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<readonly Messgrenze[]> {
  const { betrieb_messgrenzen } = await readSpurDStand(tx,tenantId);
  if (!Array.isArray(betrieb_messgrenzen) || !betrieb_messgrenzen.every(istMessgrenze)) {
    throw Error("S16D_BETRIEB_MESSGRENZE_UNGUELTIG");
  }
  const schluessel = new Set(betrieb_messgrenzen.map(wert=>JSON.stringify([wert.anlageId,wert.regelId])));
  if (schluessel.size !== betrieb_messgrenzen.length) throw Error("S16D_BETRIEB_MESSGRENZE_MEHRDEUTIG");
  return betrieb_messgrenzen;
}
