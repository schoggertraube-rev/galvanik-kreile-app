# 21 — Datenmodell & Lern-Loop: Modul Marketing

**Version:** 1.0 · **Datum:** 2026-06-02 · **ORM:** Drizzle (Postgres/Supabase)
**Grundsatz:** relationales Modell, nachvollziehbares Lernen (kein Blackbox-Auto-Posten), Data-Provider-Pattern.

---

## 1. Entitäten

```
kampagne          Bündel von Aktionen mit Ziel/Zeitraum/Budget
aktion            einzelne Marketing-Aktion (Post, Mail, Bewertung, Anzeige)
aktion_vorschlag  KI-/regelbasierter Vorschlag mit Score + Metadaten
kanal             verbundener Kanal (Instagram, E-Mail, Google, Web/Ads)
segment           Kundensegment (Oldtimer, Schmuck, …)
touchpoint        ausgeführte Aktion am Kanal (mit Tracking-Referenz)
attribution       Verknüpfung Touchpoint → Lead → Auftrag → Umsatz
lead              eingehende Anfrage (mit Quelle/UTM)
kosten_posten     Kosten einer Aktion/Kampagne (→ Buchhaltung)
lern_metrik       aggregierte Wirkung je Format/Kanal/Zeit/Segment (Lern-Loop)
telemetrie_event  Nutzungs-/Dev-Telemetrie (anonymisiert)
einwilligung      E-Mail-/Werbe-Einwilligung je Kontakt (DSGVO)
```

## 2. Drizzle-Schema (Auszug)

```ts
export const aktion = pgTable('aktion', {
  id: uuid('id').defaultRandom().primaryKey(),
  kampagneId: uuid('kampagne_id').references(() => kampagne.id),
  typ: text('typ').notNull(),            // post|mail|review_request|ad
  kanalId: uuid('kanal_id').references(() => kanal.id),
  segmentId: uuid('segment_id').references(() => segment.id),
  titel: text('titel'),
  inhalt: jsonb('inhalt'),               // Text, Hashtags, Bildref
  status: text('status').notNull().default('vorschlag'), // vorschlag|geplant|freigegeben|ausgefuehrt|fehler
  erwarteterOutput: numeric('erwarteter_output'),  // Anfragen/Umsatz-Prognose
  aufwandMin: integer('aufwand_min'),
  kostenBudget: numeric('kosten_budget', { precision: 10, scale: 2 }).default('0'),
  score: numeric('score', { precision: 6, scale: 2 }),
  freigegebenVon: uuid('freigegeben_von'),
  ausgefuehrtAm: timestamp('ausgefuehrt_am'),
  erstelltAm: timestamp('erstellt_am').defaultNow().notNull(),
});

export const touchpoint = pgTable('touchpoint', {
  id: uuid('id').defaultRandom().primaryKey(),
  aktionId: uuid('aktion_id').references(() => aktion.id).notNull(),
  kanalId: uuid('kanal_id').references(() => kanal.id),
  externeRef: text('externe_ref'),       // z.B. IG-Media-ID, Mail-ID
  utmCampaign: text('utm_campaign'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  reichweite: integer('reichweite'),
  klicks: integer('klicks'),
  ausgefuehrtAm: timestamp('ausgefuehrt_am').defaultNow(),
});

export const attribution = pgTable('attribution', {
  id: uuid('id').defaultRandom().primaryKey(),
  touchpointId: uuid('touchpoint_id').references(() => touchpoint.id),
  leadId: uuid('lead_id').references(() => lead.id),
  auftragId: uuid('auftrag_id'),         // referenz bestehendes Auftragsmodul
  umsatz: numeric('umsatz', { precision: 12, scale: 2 }),
  modell: text('modell').default('last_touch'), // last_touch|first_touch|linear
  erstelltAm: timestamp('erstellt_am').defaultNow(),
});

export const lernMetrik = pgTable('lern_metrik', {
  id: uuid('id').defaultRandom().primaryKey(),
  dimension: text('dimension').notNull(),  // format|kanal|wochentag|stunde|segment
  wert: text('wert').notNull(),            // z.B. 'vorher_nachher_foto', 'dienstag', '09'
  aktionen: integer('aktionen').default(0),
  anfragen: integer('anfragen').default(0),
  umsatz: numeric('umsatz', { precision: 12, scale: 2 }).default('0'),
  konfidenz: numeric('konfidenz', { precision: 5, scale: 2 }), // 0..1, steigt mit Datenmenge
  aktualisiertAm: timestamp('aktualisiert_am').defaultNow(),
});

export const einwilligung = pgTable('einwilligung', {
  id: uuid('id').defaultRandom().primaryKey(),
  kundeId: uuid('kunde_id').notNull(),
  kanal: text('kanal').notNull(),          // email|sms
  status: text('status').notNull(),        // erteilt|widerrufen
  quelle: text('quelle'),                  // formular|auftrag|import
  zeitpunkt: timestamp('zeitpunkt').defaultNow(),
  nachweis: text('nachweis'),              // Doku-Referenz (DSGVO)
});
```

## 3. Lern-Loop (nachvollziehbar, kein Blackbox)

**Prinzip:** Nach jeder ausgeführten Aktion wird das Ergebnis (Reichweite, Anfragen, Umsatz) auf die Dimensionen Format/Kanal/Wochentag/Stunde/Segment verbucht (`lern_metrik`). Vorschläge nutzen diese Aggregate.

```
nach Aktion-Ergebnis:
  for dim in [format, kanal, wochentag, stunde, segment]:
    metrik = upsert(lern_metrik, dim, wert)
    metrik.aktionen += 1; metrik.anfragen += anfragen; metrik.umsatz += umsatz
    metrik.konfidenz = min(1, aktionen / SCHWELLE)   // mehr Daten → mehr Vertrauen
```

**Scoring eines Vorschlags** (Datei 20 §4):
```
score = w1·prognose_output(metrik) + w2·(1/aufwand) + w3·segment_relevanz
        + w4·konfidenz − w5·kosten
prognose_output = ⌀(umsatz pro aktion in passenden Dimensionen), gewichtet mit konfidenz
```

- Gewichte `w1..w5` in `einstellungen` konfigurierbar.
- **Cold Start:** ohne Historie greifen Default-Heuristiken (z. B. „B2B Di–Do 9–11 Uhr", „Vorher-/Nachher-Foto stark"); Lern-Badge erst ab Mindest-Konfidenz anzeigen.
- **Erklärbarkeit:** jeder Vorschlag speichert, welche Metriken ihn getrieben haben (für „GELERNT aus 18 Posts …").

## 4. Provider-Interface

```ts
interface MarketingDataProvider {
  getBesteAktion(): Promise<AktionVorschlag>;
  listVorschlaege(sort: SortMode, filter?: AktionFilter): Promise<AktionVorschlag[]>;
  freigebenAktion(id: string, anpassung?: Partial<Aktion>): Promise<Aktion>;
  getFunnel(zeitraum: Zeitraum): Promise<FunnelDaten>;
  getRoi(scope: 'kampagne'|'kanal'|'segment', zeitraum: Zeitraum): Promise<RoiReport>;
  listReaktivierung(segmentId?: string): Promise<Kandidat[]>;
  recordErgebnis(touchpointId: string, ergebnis: Ergebnis): Promise<void>; // füttert Lern-Loop
}
// MockProvider (Demo) + ApiProvider (Supabase). Channel-Ausführung via Adapter (Datei 22).
```

## 5. Verknüpfung mit anderen Modulen

- `kosten_posten` schreibt automatisch eine Ausgabe in die Buchhaltung (Kategorie „Marketing", Kanal als Unterkategorie).
- `attribution.umsatz` referenziert Aufträge des bestehenden Auftragsmoduls → Performance-Kachel „Marketing-Wirkung".
- `lead` mit UTM-Quelle verbindet Web-Anfrage mit Touchpoint.

## 6. Akzeptanzkriterien

- [ ] Migration erzeugt alle Tabellen; verifiziert auf Supabase.
- [ ] Touchpoint → Attribution → Umsatz lässt sich end-to-end nachvollziehen.
- [ ] Lern-Metrik aktualisiert sich nach Aktion; Konfidenz steigt mit Datenmenge.
- [ ] Vorschlags-Score ändert sich nachweisbar nach neuen Ergebnissen (Test mit 2 Datenständen).
- [ ] Cold-Start liefert sinnvolle Default-Vorschläge ohne Historie.
- [ ] E-Mail-Aktion prüft `einwilligung` vor Versand (sonst blockiert).
- [ ] MockProvider und ApiProvider liefern identische Typen.
