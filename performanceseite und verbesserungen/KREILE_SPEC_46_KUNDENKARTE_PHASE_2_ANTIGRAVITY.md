# KREILE WERKSTATTCOCKPIT — SPEC 46  
## Kundenkarte Phase 2: aus Platzhaltern wird eine echte vernetzte Kundenakte

## Ausgangslage

Die Kundenkarte Phase 1 ist umgesetzt:

- `CustomerOverlay` existiert.
- Globaler Overlay-Stack funktioniert.
- `openCustomer(id)` ist angebunden.
- Klick aus Auftrag, globaler Suche und Kundenliste öffnet die Kundenkarte.
- KPI-View `v_analyse_kunden_kpi` existiert.
- `customers` wurde um CRM-Felder erweitert.
- KPI-Daten kommen live aus Supabase.
- CI-Referenz ist die Kundenkarte v2 mit Header, KPI-Zeile, 11 Tabs, Schnellaktionen, Kommunikation, Zahlungen, Analyse und Werkstattgedächtnis.

Jetzt soll **nicht neu gebaut**, sondern die bestehende Kundenkarte fachlich gefüllt, vernetzt und livefähig gemacht werden.

---

## Zwingende Arbeitsregeln

1. Keine neue zweite Kundenkarten-Variante bauen.
2. Keine funktionierende Struktur zerstören.
3. Keine Mockdaten, keine hart codierten Beispielkunden, keine Fake-Counts.
4. Keine toten Buttons.
5. Keine Browser-Supabase-Queries auf sensible Kunden-, Auftrags- oder Finanzdaten, wenn Server-Bridges erforderlich sind.
6. Bestehende CI-Variablen und vorhandenes Designsystem verwenden.
7. Overlay-Stack nicht kaputt machen.
8. Aufträge aus der Kundenkarte müssen das `OrderOverlay` öffnen.
9. Auftrag → Kunde → Auftrag muss sauber im Stack funktionieren.
10. Nach größeren Blöcken `tsc/build` prüfen.

---

## Zielbild

Die Kundenkarte wird zur universellen Kundenakte der Werkstatt.

Sie zeigt und verbindet:

- Stammdaten
- Kontaktperson
- Kundentyp / Klassifikation / Tags
- offene und abgeschlossene Aufträge
- Teilehistorie
- technische Besonderheiten
- Preisabsprachen
- frühere Referenzpreise
- Kommunikation und Telefonnotizen
- Rechnungen und Zahlungen
- offene Posten
- Reklamationen und Nacharbeit
- Fotos und Dokumente
- Analysehinweise
- nächste sinnvolle Aktion

---

## Phase 0 — Bestandsprüfung

Vor Umsetzung prüfen:

- `src/stores/overlayStore.ts`
- `CustomerOverlay.tsx`
- alle Customer-Komponenten
- `useCustomerKpi`
- Customer Repository / Server Actions
- OrderOverlay-Kundentrigger
- GlobalSearch-Kundentrigger
- `/customers` Trigger
- Supabase-Typen
- Migration `20260610000000_customers_kundenkarte.sql`

Prüfen, welche Tabellen wirklich vorhanden sind:

- `customers`
- `orders`
- `items`
- `status_events`
- `communication_drafts`
- `phone_notes`
- `ausgangsrechnung`
- `zahlung`
- `beleg`
- `complaints` / `rework`, falls vorhanden
- `photos` / `documents`, falls vorhanden
- `customer_price_agreements`, falls vorhanden
- `customer_contacts`, falls vorhanden

Nicht blind migrieren. Erst Bestand prüfen.

---

## Phase 1 — Zentrale Datenversorgung bauen

Baue eine zentrale, serverseitige Datenversorgung für die Kundenkarte.

Bevorzugt:

```text
src/features/customers/customer-card/customerCard.actions.ts
```

oder passend zur vorhandenen Architektur.

### Benötigte Server Actions

#### `getCustomerCard(customerId)`

Lädt gebündelt:

- Customer-Stammdaten
- KPI aus `v_analyse_kunden_kpi`
- offene Aufträge
- letzte abgeschlossene Aufträge
- letzte Rechnungen/Zahlungen
- Kommunikation/Telefonnotizen
- Preisabsprachen
- Reklamationen/Nacharbeit
- Tags
- nächste Aktion
- Analysehinweise

#### `getCustomerOrders(customerId)`

Lädt:

- offene Aufträge
- abgeschlossene Aufträge
- Status
- Priorität
- Station
- Fälligkeit
- Blocker
- nächste Aktion

#### `getCustomerTimeline(customerId)`

Kombiniert:

- Telefonnotizen
- Kommunikation
- StatusEvents
- Zahlungen
- Rechnungen
- wichtige Auftragsereignisse

Einheitliches Format:

```ts
type CustomerTimelineItem = {
  id: string;
  type: "email" | "phone" | "note" | "payment" | "invoice" | "order" | "status" | "complaint";
  title: string;
  subtitle?: string;
  timestamp: string;
  relatedOrderId?: string;
  relatedInvoiceId?: string;
  severity?: "neutral" | "success" | "warning" | "critical";
};
```

#### `getCustomerFinancials(customerId)`

Lädt:

- Rechnungen
- Zahlungen
- offene Posten
- überfällige Posten
- Zahlungsdauer, falls berechenbar
- Zahlungsmethode, falls vorhanden

#### `getCustomerSimilarOrders(customerId, optionalOrderId?)`

Einfache Logik ohne KI:

- gleiche Oberfläche
- ähnlicher Titel
- gleiche Material-/Teileart, soweit vorhanden
- Preis
- Dauer
- Fotoanzahl
- Reklamation ja/nein

#### Schreibfunktionen

- `updateCustomerCore(customerId, patch)`
- `addCustomerTag(customerId, tag)`
- `removeCustomerTag(customerId, tag)`
- `updateCustomerInternalNotes(customerId, notes)`

Alle Schreibfunktionen:

- mit Sessionprüfung
- mit Whitelist erlaubter Felder
- mit `updated_at`
- ohne freie Mass-Updates

---

## Phase 2 — Kundenkarte in echte Tabs gliedern

Die Kundenkarte braucht 11 Tabs:

1. Überblick
2. Aufträge
3. Historie & ähnliche
4. Teile & Profil
5. Preise
6. Kommunikation
7. Reklamationen
8. Rechnungen
9. Fotos
10. Analyse
11. Notizen

Wenn Komponenten schon existieren: erweitern, nicht duplizieren.

Empfohlene Struktur:

```text
src/features/customers/customer-card/components/
  CustomerOverlay.tsx
  CustomerHeader.tsx
  CustomerKpiRow.tsx
  CustomerTabs.tsx
  CustomerOverviewTab.tsx
  CustomerOrdersTab.tsx
  CustomerHistorySimilarTab.tsx
  CustomerItemsProfileTab.tsx
  CustomerPricesTab.tsx
  CustomerCommunicationTab.tsx
  CustomerComplaintsTab.tsx
  CustomerInvoicesTab.tsx
  CustomerPhotosTab.tsx
  CustomerAnalysisTab.tsx
  CustomerNotesTab.tsx
  CustomerQuickActions.tsx
  CustomerTimeline.tsx
  CustomerEmptyState.tsx
```

Tab-Regeln:

- Tabs im Overlay lokal steuern.
- Kein Routing für Tabwechsel.
- Kein Overlay-Neuladen beim Tabwechsel.
- Tabs horizontal scrollbar auf Tablet/Mobile.
- Empty States müssen fachlich nützlich sein.

---

## Phase 3 — Überblick-Tab

Der Überblick ist die wichtigste Standardansicht.

### Muss enthalten

#### 1. Nächste Aktion

Priorität:

1. offene Freigabe
2. offene/überfällige Rechnung
3. kritischer Auftrag
4. fehlende Kundendaten
5. fehlende Preisabsprache
6. offene Reklamation
7. sonst: keine Sofortaktion

Beispiele:

- „Freigabe für A-2026-0042 nachfassen“
- „Offene Rechnung RE-2026-0031 erinnern“
- „Preisabsprache für Chrom Stoßstange prüfen“

Button muss echt sein:

- E-Mail-Draft öffnen
- Telefonnotiz öffnen
- Auftrag öffnen
- Rechnung öffnen
- oder sauber deaktiviert mit Begründung

#### 2. Aktuelle Aufträge

Max. 3–5 Aufträge:

- Statusampel
- Auftragsnummer
- Titel
- Station
- Fälligkeit
- Klick öffnet `OrderOverlay`

#### 3. Historie & ähnliche Arbeiten

2–3 Referenzen:

- Auftrag
- Preis
- Dauer
- Fotos
- Reklamation ja/nein
- Hinweis
- Öffnen → `OrderOverlay`
- Als Referenz verwenden → nur aktiv, wenn sinnvoll

#### 4. Preise & Warnung

Anzeigen:

- aktive Preisabsprachen
- letzte Referenzpreise
- Preisabweichungen

Keine erfundenen Werte.

#### 5. Rechnungen/Zahlungen Kurzliste

- letzte Rechnungen
- offene Posten
- Zahlungsstatus
- Erinnerungsbutton erzeugt Draft, sendet nichts automatisch

Rechte Spalte:

- Schnellaktionen
- Tags
- Timeline-Auszug
- Analysehinweis

---

## Phase 4 — Aufträge-Tab

Funktionen:

- offene Aufträge
- abgeschlossene Aufträge
- Filter: Alle / Offen / Kritisch / Wartet / Abgeschlossen
- Suche innerhalb Kundenaufträge
- Sortierung: kritisch zuerst, dann Fälligkeit

Karte je Auftrag:

- Auftragsnummer
- Titel
- Status
- Priorität
- Station
- Fälligkeit
- Teileanzahl
- Blocker
- nächste Aktion

Klick öffnet `OrderOverlay`.

Button „Neuer Auftrag“:

- vorhandenen Auftragserstellungsflow mit `customerId` vorbefüllen
- wenn nicht vorhanden: nicht faken, sauber disabled mit Hinweis

---

## Phase 5 — Historie & ähnliche Arbeiten

Ziel: Werkstattgedächtnis.

Anzeigen:

- abgeschlossene Aufträge des Kunden
- ähnliche Arbeiten
- gleiche Oberfläche
- ähnliche Teile
- frühere Preise
- frühere Dauer
- Reklamationen
- Fotos

Karte:

- Auftrag
- Arbeit/Oberfläche
- Preis
- Dauer
- Marge, falls vorhanden
- Fotoanzahl
- Reklamation
- Hinweis

Buttons:

- Öffnen
- Als Referenz verwenden
- Preis vergleichen

Preisvergleich nur mit echten Daten.

---

## Phase 6 — Teile & technisches Profil

Anzeigen:

1. Wiederkehrende Teile
   - Bezeichnung
   - Oberfläche
   - Anzahl
   - letzte Bearbeitung
   - typische Dauer
   - Preisrange, falls berechenbar

2. Technische Besonderheiten
   - Materialrisiken
   - Oberfläche
   - Glanzgrad
   - Verpackung
   - Freigaberegeln
   - Qualitätsanspruch

3. Versandpräferenz
   - `shipping_preference`

4. Zahlungs-/Kommunikationspräferenz
   - `payment_preference`
   - Kommunikationspräferenz
   - Klassifikation

Bearbeitung über Server Action, nicht über unkontrollierte lokale Mutationen.

---

## Phase 7 — Preise & Angebote

Prüfen, ob Preisabsprachen bereits existieren.

Falls nicht vorhanden, minimal migrationsfähig anlegen:

```text
customer_price_agreements
  id
  customer_id
  title
  surface
  item_pattern
  min_price
  fixed_price
  currency
  valid_from
  valid_until
  notes
  active
  created_at
  updated_at
```

Funktionen:

- Preisabsprache anzeigen
- neue Absprache anlegen
- bearbeiten
- deaktivieren
- alte Preise aus Aufträgen anzeigen
- Preiswarnung bei starker Abweichung

Keine Preise erfinden.

---

## Phase 8 — Kommunikation & Telefonnotizen

Datenquellen:

- `communication_drafts`
- `phone_notes`
- `status_events`
- Auftragsnotizen
- Zahlungs-/Freigabeereignisse

Anzeigen:

- Timeline chronologisch
- Filter: Alle / Telefon / E-Mail / Freigabe / Zahlung / Auftrag / Notiz

Schnellaktionen:

- E-Mail schreiben → Draft mit Kundendaten
- Anrufen → `tel:` Link + Telefonnotiz erfassen
- Freigabe nachfassen → Template-Draft
- Zahlung erinnern → Template-Draft

Nicht automatisch senden.

---

## Phase 9 — Reklamationen & Nacharbeit

Zuerst vorhandene Strukturen prüfen:

- `complaintsRepository`
- `rework`
- `status_events`
- `QUALITY_CHECK_FAILED`
- `REWORK_STARTED`
- `REWORK_COMPLETED`
- Order-/Item-Flags

Wenn keine Tabelle existiert: zunächst aus vorhandenen Events ableiten.

Anzeigen:

- offene Reklamationen
- abgeschlossene Reklamationen
- betroffene Teile
- Station
- Grund
- Foto, falls vorhanden
- Zusatzaufwand
- Kulanz, falls vorhanden

Button „Reklamation erfassen“:

- vorhandenen Flow nutzen
- sonst minimaler Dialog:
  Kunde, Auftrag optional, Teil optional, Grund, Notiz, Status offen

---

## Phase 10 — Rechnungen & Zahlungen

Datenquellen:

- `ausgangsrechnung`
- `zahlung`
- `v_analyse_kunden_kpi`

Anzeigen:

- Rechnungsnummer
- Datum
- Betrag
- Status
- Fälligkeit
- Tage offen
- Zahlungsart
- zugehöriger Auftrag

Buttons:

- Rechnung öffnen
- Zahlung erfassen
- Erinnerung erstellen

Wenn Zielroute nicht existiert: sauber disabled mit Hinweis.

Zahlungserinnerung:

- DB-Template verwenden
- Draft erzeugen
- nicht senden

---

## Phase 11 — Fotos & Dokumente

Datenquellen prüfen:

- `photos`
- `documents`
- Storage-URLs
- order/item photo references

Anzeigen:

- Galerie nach Auftrag gruppiert
- Filter: Eingang / Schaden / Prozess / Ergebnis / Verpackung / Dokument
- Vorschau
- Auftrag
- Teil
- Datum
- Typ

Falls keine Datenquelle existiert:

- ehrlicher Empty State
- kein Fake-Bild

---

## Phase 12 — Analyse & Marketing

Anzeigen:

- Umsatz 12M
- Umsatz LTV
- Gewinn LTV
- Marge, falls berechenbar
- Ø Durchlaufzeit
- Ø Zahlungsdauer
- offene Posten
- Pünktlichkeit
- Reklamationsquote
- Anzahl Aufträge
- letzte Aktivität
- Risikostufe
- Zielgruppenfit

Einfache Regeln:

- A-Kunde: hoher Umsatz/Gewinn, gute Zahlung, wenig Reklamation
- Beobachten: offene Posten, viele Rückfragen, lange Zahlungsdauer
- Risiko: überfällige Zahlungen, hohe Reklamation, geringe Marge
- Wachstum: stabile Marge, wiederkehrende Teile, gute Zahlung

Keine KI-Behauptungen ohne Datenbasis.

Wenn Daten fehlen:

```text
Noch zu wenig Daten für belastbare Analyse.
```

---

## Phase 13 — Notizen

Anzeigen und bearbeiten:

- `internal_notes`
- letzte Änderung
- Speichern
- Fehlerzustand
- Ladezustand

UI-Hinweis:

```text
Interne Notiz — nicht in Kundenkommunikation übernehmen.
```

Keine automatische Übernahme in E-Mails.

---

## Phase 14 — Schnellaktionen echt verbinden

Buttons:

1. E-Mail  
   Öffnet Draft-Flow mit Kunde, E-Mail, Tonalität.

2. Anrufen  
   `tel:` Link, danach Telefonnotiz möglich.

3. Neuer Auftrag  
   vorhandenen Flow mit `customerId` vorbefüllen.

4. Rechnung  
   vorhandenen Rechnungsflow öffnen oder disabled erklären.

5. Zahlung  
   Zahlungsbereich / Mollie / Zahlung erfassen öffnen, falls vorhanden.

6. Reklamation  
   vorhandenen oder minimalen Reklamationsdialog öffnen.

7. Bearbeiten  
   Stammdaten bearbeiten und speichern.

8. Auftrag duplizieren  
   nur aktiv, wenn Referenzauftrag gewählt ist.

Keine `console.log`-Buttons als angebliche Funktion.

---

## Phase 15 — Header und KPI-Zeile

Header live anzeigen:

- Name/Firma
- Kundennummer
- letzte Aktivität
- Kontaktperson
- Telefon/E-Mail
- Kundentyp
- Klassifikation
- offene Freigaben
- Verpackungshinweis
- technische Besonderheit
- Kommunikationshinweis

KPI-Zeile:

- Umsatz LTV
- Gewinn LTV
- offene Posten
- Pünktlichkeit
- Reklamation

KPI-Klicks:

- Umsatz → Rechnungen
- Gewinn → Analyse
- offene Posten → Rechnungen offen
- Pünktlichkeit → Analyse
- Reklamation → Reklamationen

---

## Phase 16 — Overlay-Stack prüfen

Testfälle:

1. Kundenliste → Kunde öffnen
2. Kunde → Auftrag öffnen
3. Auftrag liegt über Kunde
4. Auftrag → Kunde öffnen
5. neuer Kunde liegt über Auftrag
6. Schließen entfernt nur oberstes Overlay
7. Escape schließt nur oberstes Overlay
8. Hintergrund bleibt stabil
9. kein kaputter Body-Scroll
10. Mobile/Tablet nicht abgeschnitten

Stack-Probleme zentral lösen, nicht mit verstreuten Z-Index-Hacks.

---

## Phase 17 — Responsive Feinschliff

Desktop:

- zwei Spalten
- rechte Aktionsspalte
- breite KPI-Zeile

Tablet quer:

- fast vollbreites Overlay
- Tabs scrollbar
- Touchflächen groß

Tablet hoch / Mobile:

- einspaltig
- keine Mini-Tabellen
- keine verschachtelten Scrollcontainer
- Overlay fullscreen/page-like möglich

Regel:

```text
Keine Scrollfenster im Scrollfenster, außer horizontalen Tabs.
```

---

## Phase 18 — Empty States und Fehlerzustände

Jede Sektion braucht:

- Loading
- Empty State
- Error State
- Retry, falls sinnvoll
- kein Crash bei `null` / `undefined`

Wichtig:

- `0 €` nur anzeigen, wenn wirklich 0.
- Sonst „keine Daten“.

---

## Phase 19 — Abschlussbericht

Am Ende berichten:

1. geänderte Dateien
2. neue Server Actions
3. verwendete Tabellen/Views
4. neue Migrationen, falls vorhanden
5. echte Buttons
6. bewusst deaktivierte Buttons
7. Live-Datenbereiche
8. Empty-State-Bereiche
9. Testergebnisse
10. offene Restpunkte

Nicht behaupten:

- „100 % fertig“, wenn Datenquellen fehlen
- Mollie/Resend integriert, wenn nur vorbereitet
- Analyse belastbar, wenn Datenmenge gering ist

---

# Separater Build- und Prüfprompt für Antigravity

```text
Führe jetzt eine vollständige technische Prüfung der Kundenkarte SPEC 46 durch.

Arbeitsweise:
1. Prüfe zuerst `git status --short` und nenne Branch + uncommitted Änderungen.
2. Prüfe, ob keine zweite CustomerOverlay-Variante entstanden ist.
3. Prüfe, ob keine Mockdaten, Beispielkunden oder hardcoded KPI-Werte in der Kundenkarten-Implementierung vorhanden sind.
4. Prüfe, ob keine Schnellaktionen nur aus `console.log`, Fake-Link oder totem Button bestehen.
5. Prüfe, ob sensible Kunden-/Auftrags-/Finanzdaten nicht ungesichert direkt aus Browser-Supabase gelesen werden, sofern Server-Bridges vorgesehen sind.
6. Prüfe, ob `CustomerOverlay`, `OrderOverlay` und `overlayStore` den LIFO-Stack sauber halten.
7. Prüfe, ob Tabs, KPI-Klicks, Auftragskarten und Schnellaktionen keine Runtime-Fehler erzeugen.

Führe danach aus:

- `npx tsc --noEmit`
- `npm run build`
- falls vorhanden: `npm test`

Wenn ein Befehl fehlschlägt:
- Fehlerursache exakt nennen.
- keine große Neuarchitektur beginnen.
- minimalen Fix setzen.
- denselben Befehl erneut ausführen.

Danach manuellen Smoke-Test vorbereiten/beschreiben:

1. `/customers` öffnen.
2. Kundenkarte aus Kundenliste öffnen.
3. KPI-Zeile prüfen.
4. Alle Tabs einmal öffnen.
5. Auftrag aus Kundenkarte öffnen.
6. Auftrag schließen, Kunde muss darunter erhalten bleiben.
7. OrderOverlay → Kunde öffnen.
8. Stack schließen: immer nur oberstes Overlay.
9. globale Suche → Kunde öffnen.
10. Notiz/Tag bearbeiten, falls umgesetzt.
11. Rechnungen/Zahlungen/Kommunikation prüfen.
12. Mobile/Tablet-Breite prüfen.

Abschlussbericht:
- Branch
- geänderte Dateien
- Build-Ergebnis
- Typecheck-Ergebnis
- Test-Ergebnis
- echte Live-Datenquellen
- bewusst leere Bereiche
- Restpunkte
- ob deployfähig oder nicht deployfähig
```
