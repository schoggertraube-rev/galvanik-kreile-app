import { pgTable, text, timestamp, date, numeric, boolean, integer, jsonb, uuid } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// ============================================================================
// Buchhaltung & Finanzen: Drizzle Schema
// ============================================================================

export const kategorie = pgTable("kategorie", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  typ: text("typ").notNull().default("ausgabe"),
  skrKonto: text("skr_konto"),
  defaultAbsetzbarProzent: numeric("default_absetzbar_prozent", { precision: 5, scale: 2 }).default("100"),
  icon: text("icon"),
  sortierung: integer("sortierung").default(0),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const lieferant = pgTable("lieferant", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameNormalisiert: text("name_normalisiert"),
  standardKategorieId: uuid("standard_kategorie_id").references(() => kategorie.id),
  standardSkrKonto: text("standard_skr_konto"),
  ustId: text("ust_id"),
  adresse: text("adresse"),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const beleg = pgTable("beleg", {
  id: uuid("id").primaryKey().defaultRandom(),
  erfasstAm: timestamp("erfasst_am").defaultNow().notNull(),
  belegdatum: date("belegdatum"),
  lieferantId: uuid("lieferant_id").references(() => lieferant.id),
  lieferantText: text("lieferant_text"),
  brutto: numeric("brutto", { precision: 12, scale: 2 }),
  netto: numeric("netto", { precision: 12, scale: 2 }),
  ustSatz: numeric("ust_satz", { precision: 4, scale: 2 }),
  ustBetrag: numeric("ust_betrag", { precision: 12, scale: 2 }),
  vorsteuerAbzug: boolean("vorsteuer_abzug").default(true),
  kategorieId: uuid("kategorie_id").references(() => kategorie.id),
  skrKonto: text("skr_konto"),
  absetzbarProzent: numeric("absetzbar_prozent", { precision: 5, scale: 2 }).default("100"),
  absetzbarGrund: text("absetzbar_grund"),
  belegart: text("belegart"),

  originalDatei: text("original_datei").notNull(),
  originalFormat: text("original_format"),
  ocrConfidence: numeric("ocr_confidence", { precision: 5, scale: 2 }),
  ocrRohtext: text("ocr_rohtext"),
  ocrPositionen: jsonb("ocr_positionen"),
  ocrProvider: text("ocr_provider"),
  zahlungsart: text("zahlungsart"),
  rechnungsnummerExtern: text("rechnungsnummer_extern"),
  status: text("status").notNull().default("pruefen"),

  storniertVon: uuid("storniert_von"), // self reference handled below if needed, here just uuid
  bankZahlungId: uuid("bank_zahlung_id"), // FK to zahlung added later in db if circular
  kontoId: uuid("konto_id"),
  kostenstelleId: uuid("kostenstelle_id"),
  periodeId: uuid("periode_id"),
  istAufAuftragZugeordnet: boolean("ist_auf_auftrag_zugeordnet").default(false),
  zugeordneterOrderId: text("zugeordneter_order_id"),
  erstelltVon: uuid("erstellt_von").notNull(),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const belegPosition = pgTable("beleg_position", {
  id: uuid("id").primaryKey().defaultRandom(),
  belegId: uuid("beleg_id").notNull().references(() => beleg.id),
  beschreibung: text("beschreibung"),
  netto: numeric("netto", { precision: 12, scale: 2 }),
  ustSatz: numeric("ust_satz", { precision: 4, scale: 2 }),
  ustBetrag: numeric("ust_betrag", { precision: 12, scale: 2 }),
  skrKonto: text("skr_konto"),
  sortierung: integer("sortierung").default(0),
});

export const kraftstoffDetail = pgTable("kraftstoff_detail", {
  id: uuid("id").primaryKey().defaultRandom(),
  belegId: uuid("beleg_id").notNull().references(() => beleg.id),
  sorte: text("sorte"),
  liter: numeric("liter", { precision: 8, scale: 2 }),
  preisProLiter: numeric("preis_pro_liter", { precision: 6, scale: 3 }),
  tankstelle: text("tankstelle"),
  ort: text("ort"),
});

export const ausgangsrechnung = pgTable("ausgangsrechnung", {
  id: uuid("id").primaryKey().defaultRandom(),
  nummer: text("nummer").notNull(),
  kundeId: text("kunde_id"),
  orderId: text("order_id"),
  datum: date("datum").notNull(),
  faelligAm: date("faellig_am"),
  brutto: numeric("brutto", { precision: 12, scale: 2 }).notNull(),
  netto: numeric("netto", { precision: 12, scale: 2 }),
  ustSatz: numeric("ust_satz", { precision: 4, scale: 2 }),
  ustBetrag: numeric("ust_betrag", { precision: 12, scale: 2 }),
  bezahltAm: date("bezahlt_am"),
  bezahltMethode: text("bezahlt_methode"),
  bezahltBetragEur: numeric("bezahlt_betrag_eur", { precision: 10, scale: 2 }),
  bezahltPaymentId: uuid("bezahlt_payment_id"),
  status: text("status").notNull().default("offen"),
  mahnstufe: integer("mahnstufe").default(0),
  erechnungXml: text("erechnung_xml"),
  leadId: uuid("lead_id"),
  bemerkung: text("bemerkung"),
  periodeId: uuid("periode_id"),
  erloesKontoId: uuid("erloes_konto_id"),
  forderungKontoId: uuid("forderung_konto_id"),
  agingStatus: text("aging_status"),
  isDemo: boolean("is_demo").default(false),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const ausgangsrechnungPosition = pgTable("ausgangsrechnung_position", {
  id: uuid("id").primaryKey().defaultRandom(),
  ausgangsrechnungId: uuid("ausgangsrechnung_id").notNull().references(() => ausgangsrechnung.id),
  beschreibung: text("beschreibung").notNull(),
  menge: numeric("menge", { precision: 12, scale: 2 }).notNull().default("1"),
  einzelpreisNetto: numeric("einzelpreis_netto", { precision: 12, scale: 2 }).notNull(),
});

export const zahlung = pgTable("zahlung", {
  id: uuid("id").primaryKey().defaultRandom(),
  ausgangsrechnungId: uuid("ausgangsrechnung_id").references(() => ausgangsrechnung.id),
  belegId: uuid("beleg_id").references(() => beleg.id),
  betrag: numeric("betrag", { precision: 12, scale: 2 }).notNull(),
  richtung: text("richtung").notNull(),
  datum: date("datum").notNull(),
  art: text("art"),
  bankUmsatzRef: text("bank_umsatz_ref"),
  isDemo: boolean("is_demo").default(false),
});

export const kostenposten = pgTable("kostenposten", {
  id: uuid("id").primaryKey().defaultRandom(),
  bezeichnung: text("bezeichnung").notNull(),
  art: text("art").notNull(),
  kategorie: text("kategorie"),
  betrag: numeric("betrag", { precision: 12, scale: 2 }).notNull(),
  intervall: text("intervall").notNull(),
  belegId: uuid("beleg_id").references(() => beleg.id),
  kampagneId: uuid("kampagne_id"),
  giltAb: date("gilt_ab"),
  giltBis: date("gilt_bis"),
  isDemo: boolean("is_demo").default(false),
});

export const steuerprofil = pgTable("steuerprofil", {
  id: uuid("id").primaryKey().defaultRandom(),
  bezeichnung: text("bezeichnung").notNull().default("Standard"),
  standardUstSatz: numeric("standard_ust_satz", { precision: 4, scale: 2 }).default("19.00"),
  reduziertUstSatz: numeric("reduziert_ust_satz", { precision: 4, scale: 2 }).default("7.00"),
  kleinunternehmer: boolean("kleinunternehmer").default(false),
  voranmeldungRhythmus: text("voranmeldung_rhythmus").default("monatlich"),
  sachkontenrahmen: text("sachkontenrahmen").default("SKR03"),
  beraterNr: text("berater_nr"),
  mandantenNr: text("mandanten_nr"),
  wjBeginn: date("wj_beginn"),
  aktiv: boolean("aktiv").default(true),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
  appLizenzMonat: numeric("app_lizenz_monat", { precision: 10, scale: 2 }).default("149.00"),
  appEinrichtungEinmalig: numeric("app_einrichtung_einmalig", { precision: 10, scale: 2 }).default("0.00"),
  appStartdatum: date("app_startdatum").defaultNow(),
});

export const ustvaPeriode = pgTable("ustva_periode", {
  id: uuid("id").primaryKey().defaultRandom(),
  zeitraumVon: date("zeitraum_von").notNull(),
  zeitraumBis: date("zeitraum_bis").notNull(),
  umsatz19: numeric("umsatz_19", { precision: 12, scale: 2 }).default("0"),
  ust19: numeric("ust_19", { precision: 12, scale: 2 }).default("0"),
  umsatz7: numeric("umsatz_7", { precision: 12, scale: 2 }).default("0"),
  ust7: numeric("ust_7", { precision: 12, scale: 2 }).default("0"),
  umsatz0: numeric("umsatz_0", { precision: 12, scale: 2 }).default("0"),
  vorsteuer: numeric("vorsteuer", { precision: 12, scale: 2 }).default("0"),
  zahllast: numeric("zahllast", { precision: 12, scale: 2 }).default("0"),
  status: text("status").default("entwurf"),
  freigegebenAm: timestamp("freigegeben_am"),
  freigegebenVon: uuid("freigegeben_von"),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const exportLauf = pgTable("export_lauf", {
  id: uuid("id").primaryKey().defaultRandom(),
  typ: text("typ").notNull(),
  zeitraumVon: date("zeitraum_von"),
  zeitraumBis: date("zeitraum_bis"),
  dateiPfad: text("datei_pfad"),
  anzahlBuchungen: integer("anzahl_buchungen").default(0),
  erstelltVon: uuid("erstellt_von").notNull(),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const bhAuditLog = pgTable("bh_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  zeit: timestamp("zeit").defaultNow().notNull(),
  benutzer: uuid("benutzer").notNull(),
  entitaet: text("entitaet").notNull(),
  entitaetId: uuid("entitaet_id").notNull(),
  aktion: text("aktion").notNull(),
  vorher: jsonb("vorher"),
  nachher: jsonb("nachher"),
});

export const bhEinstellungen = pgTable("bh_einstellungen", {
  id: text("id").primaryKey().default("default"),
  ocrConfidenceSchwelle: numeric("ocr_confidence_schwelle", { precision: 5, scale: 2 }).default("85.00"),
  beraterStundensatz: numeric("berater_stundensatz", { precision: 8, scale: 2 }).default("120.00"),
  minutenProBeleg: integer("minuten_pro_beleg").default(4),
  standardKontenrahmen: text("standard_kontenrahmen").default("SKR03"),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
  aktualisiertAm: timestamp("aktualisiert_am").defaultNow().notNull(),
});

export const kostenstelle = pgTable("kostenstelle", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  kuerzel: text("kuerzel").notNull(),
  name: text("name").notNull(),
  typ: text("typ").notNull(),
  capacityCenterId: uuid("capacity_center_id"),
  istAktiv: boolean("ist_aktiv").default(true),
  geplantePersonalkostenMonatlich: numeric("geplante_personalkosten_monatlich", { precision: 12, scale: 2 }),
  geplanteSachkostenMonatlich: numeric("geplante_sachkosten_monatlich", { precision: 12, scale: 2 }),
  verfuegbareStundenMonatlich: numeric("verfuegbare_stunden_monatlich", { precision: 8, scale: 2 }),
  energieAnteilProzent: numeric("energie_anteil_prozent", { precision: 5, scale: 2 }),
  notiz: text("notiz"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const konto = pgTable("konto", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  nummer: text("nummer").notNull(),
  bezeichnung: text("bezeichnung").notNull(),
  kategorie: text("kategorie").notNull(),
  istErfolgskonto: boolean("ist_erfolgskonto").notNull(),
  steuerprofilId: uuid("steuerprofil_id").references(() => steuerprofil.id),
  externesKontoLexware: text("externes_konto_lexware"),
  externesKontoDatev: text("externes_konto_datev"),
  istAktiv: boolean("ist_aktiv").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const periode = pgTable("periode", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  jahr: integer("jahr").notNull(),
  monat: integer("monat").notNull(),
  status: text("status").notNull(),
  geschlossenAm: timestamp("geschlossen_am"),
  geschlossenVon: uuid("geschlossen_von"),
  bemerkung: text("bemerkung"),
});

export const forecastVersion = pgTable("forecast_version", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  jahr: integer("jahr").notNull(),
  monat: integer("monat"),
  versionTyp: text("version_typ").notNull(),
  erstelltAm: timestamp("erstellt_am").defaultNow(),
  erstelltVon: uuid("erstellt_von"),
  basisData: jsonb("basis_data").notNull(),
  werte: jsonb("werte").notNull(),
  bemerkung: text("bemerkung"),
  istAktiv: boolean("ist_aktiv").default(false),
});

export const kostenstellenEnergieMonat = pgTable("kostenstellen_energie_monat", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  kostenstelleId: uuid("kostenstelle_id").references(() => kostenstelle.id),
  monat: date("monat").notNull(),
  energieEurProStunde: numeric("energie_eur_pro_stunde", { precision: 8, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
