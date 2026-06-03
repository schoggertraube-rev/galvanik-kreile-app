# 15 — Datenmodell & Backend: Modul Buchhaltung

**Version:** 1.0 · **Datum:** 2026-06-02 · **ORM:** Drizzle (Postgres/Supabase)
**Grundsatz:** relationale Modellierung, GoBD-Unveränderbarkeit (append-only + Storno), Data-Provider-Pattern.

---

## 1. Entitäten (Überblick)

```
beleg            Eingangsbeleg/-rechnung (Foto/PDF/E-Rechnung)
beleg_position   optionale Einzelpositionen (Mehr-USt-Belege)
kraftstoff_detail Tankbeleg-Detail (1:1 zu beleg bei Kategorie Kraftstoff)
ausgangsrechnung Ausgangsrechnung (Einnahmen, offene Posten)
zahlung          Zahlungseingang/-ausgang, Bankumsatz
kategorie        Ausgaben-/Einnahmen-Kategorie + SKR-Konto + Default-Absetzbarkeit
lieferant        Lieferanten-Stammdaten + Konten-Mapping
steuerprofil     USt-Sätze, KU-Status, Voranmeldungs-Rhythmus
ustva_periode    berechnete USt-Voranmeldung je Zeitraum
export_lauf      erzeugte DATEV/Lexware/ZIP/ELSTER-Exporte
audit_log        append-only Änderungsprotokoll (GoBD)
einstellungen    Voreinstellungen/Regeln (Schwellen, Mappings)
```

## 2. Drizzle-Schema (Auszug, Pflichtfelder)

```ts
// beleg
export const beleg = pgTable('beleg', {
  id: uuid('id').defaultRandom().primaryKey(),
  erfasstAm: timestamp('erfasst_am').defaultNow().notNull(),
  belegdatum: date('belegdatum'),
  lieferantId: uuid('lieferant_id').references(() => lieferant.id),
  lieferantText: text('lieferant_text'),          // OCR-Rohwert, falls kein Stammsatz
  brutto: numeric('brutto', { precision: 12, scale: 2 }),
  netto: numeric('netto', { precision: 12, scale: 2 }),
  ustSatz: numeric('ust_satz', { precision: 4, scale: 2 }),   // 19.00 / 7.00 / 0.00
  ustBetrag: numeric('ust_betrag', { precision: 12, scale: 2 }),
  vorsteuerAbzug: boolean('vorsteuer_abzug').default(true),
  kategorieId: uuid('kategorie_id').references(() => kategorie.id),
  skrKonto: text('skr_konto'),                     // z.B. '4530' Kfz-Kosten
  absetzbarProzent: numeric('absetzbar_prozent', { precision: 5, scale: 2 }).default('100'),
  absetzbarGrund: text('absetzbar_grund'),          // Regel/Paragraf
  belegart: text('belegart'),                       // rechnung|kassenbon|tankbeleg|bewirtung|abo
  originalDatei: text('original_datei').notNull(),  // Storage-Pfad, unveränderbar
  originalFormat: text('original_format'),          // jpg|pdf|xml(zugferd/xrechnung)
  ocrConfidence: numeric('ocr_confidence', { precision: 5, scale: 2 }),
  status: text('status').notNull().default('pruefen'), // pruefen|erfasst|festgeschrieben|storniert
  storniertVon: uuid('storniert_von'),              // referenz auf Storno-Beleg
  bankZahlungId: uuid('bank_zahlung_id').references(() => zahlung.id),
  erstelltVon: uuid('erstellt_von').notNull(),
});
```

```ts
// kraftstoff_detail (1:1 bei Kategorie Kraftstoff)
export const kraftstoffDetail = pgTable('kraftstoff_detail', {
  id: uuid('id').defaultRandom().primaryKey(),
  belegId: uuid('beleg_id').references(() => beleg.id).notNull(),
  sorte: text('sorte'),            // diesel|super|superplus|adblue
  liter: numeric('liter', { precision: 8, scale: 2 }),
  preisProLiter: numeric('preis_pro_liter', { precision: 6, scale: 3 }),
  tankstelle: text('tankstelle'),
  ort: text('ort'),
});
```

```ts
// audit_log (append-only, GoBD) — kein UPDATE/DELETE erlaubt
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  zeit: timestamp('zeit').defaultNow().notNull(),
  benutzer: uuid('benutzer').notNull(),
  entitaet: text('entitaet').notNull(),  // 'beleg' etc.
  entitaetId: uuid('entitaet_id').notNull(),
  aktion: text('aktion').notNull(),      // create|storno|export|freigabe
  vorher: jsonb('vorher'),
  nachher: jsonb('nachher'),
});
```

```ts
// ausgangsrechnung (Einnahmen / offene Posten)
export const ausgangsrechnung = pgTable('ausgangsrechnung', {
  id: uuid('id').defaultRandom().primaryKey(),
  nummer: text('nummer').notNull(),
  kundeId: uuid('kunde_id'),               // referenz bestehendes Kundenmodul
  datum: date('datum').notNull(),
  faelligAm: date('faellig_am'),
  brutto: numeric('brutto', { precision: 12, scale: 2 }).notNull(),
  ustSatz: numeric('ust_satz', { precision: 4, scale: 2 }),
  bezahltAm: date('bezahlt_am'),
  status: text('status').notNull().default('offen'), // offen|bezahlt|ueberfaellig|teilbezahlt
  mahnstufe: integer('mahnstufe').default(0),
  erechnungXml: text('erechnung_xml'),     // ZUGFeRD/XRechnung-Pfad
});
```

## 3. GoBD-Pflichtregeln im Backend

- **Append-only auf Finanzdaten:** Postgres-Trigger verhindert UPDATE/DELETE auf `beleg` (außer Status→`festgeschrieben` und Setzen von `storniert_von`) und auf `audit_log` komplett.
- **Korrektur nur per Storno:** ein neuer Beleg mit negativen Beträgen referenziert das Original (`storniert_von`).
- **Jede relevante Aktion** schreibt `audit_log`-Eintrag.
- **Original unveränderbar** im Storage (kein Re-Upload auf gleichen Pfad).

## 4. Provider-Interfaces (Data-Provider-Pattern)

```ts
interface BuchhaltungDataProvider {
  // Belege
  listBelege(filter?: BelegFilter): Promise<Beleg[]>;
  getBeleg(id: string): Promise<BelegDetail>;
  createBelegFromUpload(file: BelegFile): Promise<Beleg>;  // ruft OcrProvider
  freigebenBeleg(id: string, korrektur?: Partial<Beleg>): Promise<Beleg>;
  stornoBeleg(id: string, grund: string): Promise<Beleg>;
  // Auswertung
  getAusgabenNachKategorie(zeitraum: Zeitraum): Promise<KategorieSumme[]>;
  getKraftstoffAuswertung(zeitraum: Zeitraum): Promise<KraftstoffReport>;
  getBwa(zeitraum: Zeitraum): Promise<Bwa>;
  // Einnahmen
  listOffenePosten(): Promise<Ausgangsrechnung[]>;
  // Steuer/Export
  berechneUstva(zeitraum: Zeitraum): Promise<UstvaWerte>;
  exportDatev(zeitraum: Zeitraum): Promise<ExportDatei>;
  exportLexware(zeitraum: Zeitraum): Promise<ExportDatei>;
  exportSteuerberaterPaket(zeitraum: Zeitraum): Promise<ExportDatei>; // ZIP
}
// MockProvider (Demo) + ApiProvider (Supabase) implementieren dieses Interface.
```

## 5. Indizes & Performance

- Index auf `beleg(belegdatum)`, `beleg(kategorie_id)`, `beleg(status)`, `beleg(lieferant_id)`.
- `pg_trgm` für Lieferanten-Fuzzy-Suche.
- Materialisierte Sicht für BWA/Kategorie-Summen je Monat (nächtlich/refresh on write).

## 6. Akzeptanzkriterien

- [ ] Drizzle-Migrationen erzeugen alle Tabellen + Trigger; Migration liegt nachweislich auf Supabase.
- [ ] UPDATE/DELETE auf festgeschriebenem `beleg` schlägt fehl (Trigger-Test).
- [ ] Storno erzeugt referenzierten Gegenbeleg + Audit-Eintrag.
- [ ] MockProvider liefert dieselben Typen wie ApiProvider (UI bleibt unverändert).
- [ ] RLS: Rolle `EMPLOYEE` sieht nur eigenen Upload-Korb, keine Beträge.
