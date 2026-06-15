# 45 — STATIONS-KONTEXT-BLOCK IM ORDEROVERLAY

> Ergänzung zu: Spec 40 / 40_PATCH (OrderOverlay), Spec 39 (Verbrauchserfassung), Spec 44 (Kostenerfassung)
> Visuelle Referenz: `auftragsoverlay_v3_mit_erfassung.html`
> Vorlage-Overlay: `auftragsoverlay_v2_CI_2.html` (bleibt strukturell unverändert)
> Verbindlich: kein Mock, alle Werte aus Supabase, CI-Tokens durchgehend

---

## 1 · Was ändert sich

Das bestehende `OrderOverlay.tsx` wird an genau **einer Stelle** erweitert: zwischen Stationsleiste und KPI-Karten in der linken Spalte erscheint ein **kontext-abhängiger Block**, der sich nach der aktiven Station richtet.

Alle anderen Bereiche (Header, Stationen, KPIs, Teile-Liste, Kunden-KPI, Andere Aufträge, Quick Actions, Auftragshistorie, Footer) bleiben **unverändert**. Header bekommt eine kleine Ergänzung (Kosten-Badge), sonst keine strukturellen Eingriffe.

---

## 2 · Stations-Kontext-Logik (Kern)

### 2.1 Welche Station ist „aktiv"?

Beim Öffnen des Overlays wird die anzuzeigende Station so bestimmt:

| Eintritt | Aktive Station |
|---|---|
| Klick aus Warendurchlauf "Galvanik" | Galvanik |
| Klick aus Warendurchlauf "Schleiferei" | Schleiferei |
| Klick aus Warendurchlauf "Entmetallisierung" | Entmetallisierung |
| Klick aus Warendurchlauf "Warenausgang" | Warenausgang |
| Klick aus Warendurchlauf "Wareneingang" | Wareneingang |
| Klick aus Auftragsbuch / Kundenkarte / globaler Suche | `orders.current_station_id` |
| Klick auf andere Station im Stationsstrip | gewählte Station |

Quelle: Route-Parameter oder `useOrderOverlay(orderId, { initialStation?: string })`.

### 2.2 Was zeigt der Block je nach Station?

| Station | Block-Variante | Zweck |
|---|---|---|
| **Wareneingang** | Read-only Zusammenfassung mit „nacherfassen"-Toggle | Wareneingang ist meist abgeschlossen — nur Doku-Ansicht |
| **Entmetallisierung** | Erfassung (Zeit + Material + Zusatz) | Bearbeitung |
| **Schleiferei** | Erfassung (Zeit + Material + Zusatz) | Bearbeitung — Hauptanwendungsfall |
| **Galvanik** | Erfassung (Zeit + Material + Bad-Auswahl + Schichtdicke) | Bearbeitung — galvanik-spezifisch |
| **Warenausgang** | Versand & Übergabe (Lieferart, Adresse, Tracking, Versandmail) | Versand/Abholung — KEINE Bearbeitung |

### 2.3 Sortier-Regel (vom Nutzer explizit gefordert)

> „In der Galvanik wird bearbeitet, im Warenausgang wird verschickt oder abgeholt."

Im Stationsstrip sind die Stationen in **Bearbeitungsreihenfolge** angeordnet (`Wareneingang → Entmet → Schleif → Galvanik → Warenausgang`). Im Kontext-Block ändert sich nur die **Variante**, nicht die Position des Blocks. Der Nutzer klickt also auf eine Station im Strip, und der Block darunter passt sich an — ohne zusätzliche Klicks oder Tab-Wechsel.

---

## 3 · Block-Variante A: Erfassung (Bearbeitungsstationen)

### 3.1 Aufbau (von oben nach unten)

```
┌─ Stations-Kontext-Block ─────────────────────────────────┐
│ Header                                                    │
│   Erfassung · Schleiferei              [↑ einklappen]    │
│                                                           │
│ Block 1: Arbeitszeit                                      │
│   • Schieber „Grobschliff"                                │
│   • Schieber „Feinschliff / Politur"                      │
│   • Schieber „Kupfer-Zwischenschliff" (galvanik-abhängig) │
│   → Jeder Schieber hat gelbe Benchmark-Zone               │
│                                                           │
│ Block 2: Material                                         │
│   • Material-Zeile mit Stepper (vorgeschlagen aus Vorlage)│
│   • „+ Weiteres Material"                                 │
│                                                           │
│ Block 3: Zusatzaufwand                                    │
│   • Richten / Dellen (Ja/Nein-Toggle)                     │
│   • Löten / Reparatur                                     │
│   • Express-Zuschlag                                      │
│                                                           │
│ Footer                                                    │
│   Stationskosten 259,30 €    [Erfassung buchen]          │
│                                                           │
│ Toggle „Gesamtkalkulation anzeigen ▼"                     │
│   → Klappt Tabelle über alle Stationen auf               │
└───────────────────────────────────────────────────────────┘
```

### 3.2 Welche Arbeitsschritte erscheinen?

Die Liste der Arbeitsschritte (Schieber) pro Station kommt aus `vorlage_zeit` mit Filter auf `station_kuerzel` und gruppiert nach `taetigkeit` (neue Spalte oder im Schlüssel kodiert). Falls keine Vorlage existiert: ein generischer Schieber „Arbeitszeit gesamt".

Mapping pro Station (Default):

| Station | Standard-Schritte |
|---|---|
| Entmetallisierung | Aufhängen, Entmetallisieren, Spülen, Trocknen |
| Schleiferei | Grobschliff, Feinschliff, Kupfer-Zwischenschliff (wenn Galvanik vorher), Politur |
| Galvanik | Aufhängen, Bad-Vorbereitung, Beschichtungszeit, Nachspülen, Abhängen |

→ Konfigurierbar pro Tenant in `company_settings.station_steps` (JSONB).

### 3.3 Schieber-Verhalten (aus Spec 44)

| Eigenschaft | Wert |
|---|---|
| Min / Max | 15 / 240 Min |
| Schrittweite | 1 Min |
| Tap-Target Thumb | ≥ 28 px Höhe (in v3 kompakter als v1) |
| Voreinstellung | Median aus `vorlage_zeit` (wenn n ≥ 3), sonst leer |
| Gelbe Zone | Von 0 bis Median; nur sichtbar wenn n ≥ 3 |
| Fill-Farbe | Grün ≤ Benchmark, Gelb +10–40%, Rot > +40% |

### 3.4 Galvanik-Sonderfeld

Bei Station = Galvanik wird **zusätzlich** angezeigt:

```
Bad-Auswahl
  ○ Nickelbad 1   ● Chrombad 2   ○ Kupferbad 1
  
Schichtdicke
  ━━━━●━━━━━━━━  12 µm  (Standard Chrom: 8–15 µm)
```

Die Auswahl schreibt in `bath_uses` (neue Tabelle in Spec 44 vorgesehen, hier nur Referenz). Schichtdicke beeinflusst Metallverbrauchsschätzung.

---

## 4 · Block-Variante B: Versand & Übergabe (Warenausgang)

### 4.1 Aufbau

```
┌─ Stations-Kontext-Block ─────────────────────────────────┐
│ Header                                                    │
│   Versand & Übergabe · Warenausgang     [↑ einklappen]   │
│                                                           │
│ Block 1: Lieferart                                        │
│   [Versand DHL] [Selbstabholung] [Spedition]             │
│                                                           │
│ Block 2: Versanddetails (wenn Versand)                    │
│   Empfänger    Paket                                      │
│   Name+Adresse Kolli, Gewicht, Versicherung               │
│                                                           │
│ Block 2-alt: Abholdetails (wenn Selbstabholung)           │
│   Wunschdatum, Uhrzeit                                    │
│   Telefonisch avisiert?                                   │
│                                                           │
│ Block 3: Tracking                                         │
│   [Tracking-Nr. eintragen]  [Label drucken]              │
│                                                           │
│ Footer                                                    │
│   Versandkosten 14,90 €     [Versandmail senden]         │
└───────────────────────────────────────────────────────────┘
```

### 4.2 Was passiert beim Buchen?

| Aktion | DB-Effekt |
|---|---|
| Lieferart wählen | `orders.delivery_method` UPDATE |
| Tracking-Nr. + Label | `shipments` INSERT, PDF generiert |
| Versandmail senden | `communication_messages` INSERT, Template `versandbereit` |
| Abholung bestätigt | `events.event_type = 'PICKED_UP'` |

### 4.3 Was wird NICHT angeboten

Im Warenausgang sind die Erfassungsschieber (Arbeitszeit/Material) **nicht** sichtbar. Verpackungs-Materialien (Kartons, Polster) werden — wenn nötig — in der minimalen Form über eine eigene Material-Zeile erfasst, aber nicht als primäre Aktion.

---

## 5 · Block-Variante C: Wareneingang (Read-only-Zusammenfassung)

Wareneingang ist beim Öffnen des Overlays meist schon abgeschlossen. Statt der Erfassung erscheint eine **kompakte Read-only-Übersicht**:

```
┌─ Stations-Kontext-Block ─────────────────────────────────┐
│ Header                                                    │
│   Wareneingang · abgeschlossen am 18.05.  [nacherfassen] │
│                                                           │
│ 4 Mini-Karten in einer Zeile:                            │
│   [Arbeitszeit 20 Min] [Material —] [Kosten 23 €]        │
│   [Standort L-WE-R1-F2]                                  │
└───────────────────────────────────────────────────────────┘
```

Klick auf „nacherfassen" wandelt den Block in eine kompakte Erfassungsmaske (gleiche Logik wie Variante A, aber für Wareneingang).

Wenn Wareneingang noch nicht abgeschlossen ist (z.B. Auftrag direkt beim Annehmen geöffnet): zeigt den Wareneingangs-Flow (Foto-Aufnahme, Teile-Bestätigung, Lagerort-Scan). Dieser Flow wird hier nicht detailliert — er ist in der Wareneingangsseite definiert.

---

## 6 · Header-Erweiterung: Kosten-Badge

Das einzige Element, das im **bestehenden Header** ergänzt wird, ist ein Kosten-Badge rechts neben den Pills (vor dem Close-Button):

```
┌─────────────────────────────────────────────────────────┐
│ A-2026-0042                       │ BISHERIGE KOSTEN │ X │
│ Stoßstange Opel Rekord C          │       187 €     │   │
│ [Express] [Schleiferei] [Kunde]   │ ~420 € · +8%    │   │
└─────────────────────────────────────────────────────────┘
```

Live-Update nach jeder Buchung. Klick auf Badge scrollt zur Gesamtkalkulations-Tabelle im Kontext-Block.

CSS-Klasse: `.head-cost` (siehe Mockup-CSS).

---

## 7 · Vernetzung mit anderen Elementen

### 7.1 Quick Action „Verbrauch" wird zum Anker-Link

Im bestehenden Quick-Actions-Grid (rechte Spalte) gibt es bereits einen Button „Verbrauch". Dieser bekommt zwei Veränderungen:

1. Wird zum **primären, akzentfarbigen Button** (CSS-Klasse `qa.accent-link`)
2. Klick scrollt zur Kontext-Block-Position und löst eine kurze Puls-Animation aus (`.station-context.highlight`, CSS-Animation `pulseAnchor`)

Hintergrund: Der Block ist nicht versteckt, sondern Teil des Hauptscrolls. Der Quick-Action-Button ist ein **Anker**, kein Modal-Trigger.

### 7.2 Stations-Strip-Klick

Klick auf eine Station im Strip:
1. Wechselt aktive Station (`activeStation` State)
2. Kontext-Block tauscht Variante (A → B → C entsprechend)
3. Header-Pill „Station" aktualisiert sich
4. Scroll-Position bleibt auf Block-Höhe

Wichtig: Klick auf bereits abgeschlossene Station öffnet die Read-only-Variante. Klick auf wartende Station öffnet die Erfassungsmaske (für Vorbereitung).

### 7.3 Benchmark-Klick

Klick auf „Benchmark 57 Min · n=8" öffnet einen `BenchmarkInfoDrawer` als Sub-Overlay (LIFO-Stack). Inhalt:
- Klasse, Median, P25, P75
- Liste der 8 Referenzaufträge mit Klick auf Auftragsnummer → öffnet diesen Auftrag im Sub-Overlay

### 7.4 Gesamtkalkulation-Toggle

Standardmäßig eingeklappt. Klick auf „Gesamtkalkulation über alle Stationen anzeigen ▼" klappt die Tabelle auf. Persistiert pro Nutzer in `localStorage` (kein DB-Eintrag nötig).

---

## 8 · Was bleibt unverändert

Diese Bereiche werden **nicht angefasst**:

| Bereich | Status |
|---|---|
| Header (Auftragsnummer, Titel, Pills, Close-Button) | unverändert, nur Kosten-Badge ergänzt |
| Stationsstrip (5 Stationen) | unverändert |
| KPI-Karten (Durchlaufzeit, Risiko, Fällig) | unverändert |
| Teile-Liste (4 Teile, Fotos, Schritt-Fortschritt, Preis) | unverändert |
| Kunden-KPI-Zeile (5 Karten) | unverändert |
| „Weitere aktive Aufträge" | unverändert |
| Quick Actions (8 Buttons) | nur „Verbrauch" wird zum Anker-Link |
| Auftragshistorie | unverändert |
| Footer („Schließen", „Kunden-Update senden") | unverändert |

---

## 9 · Komponenten-Plan

### 9.1 Neue Komponenten

```
src/components/orders/
  StationContextBlock.tsx       — Container, wählt Variante per activeStation
  variants/
    ErfassungVariant.tsx         — Variante A (Entmet, Schleif, Galvanik)
    VersandVariant.tsx           — Variante B (Warenausgang)
    WareneingangReadOnly.tsx     — Variante C
    GalvanikExtras.tsx           — Bad-Auswahl + Schichtdicke
  BenchmarkSlider.tsx           — einzelner Schieber (aus Spec 44)
  MaterialStepper.tsx           — Materialzeile mit ±
  ExtraEffortToggles.tsx        — Richten/Löten/Express
  CostSummaryTable.tsx          — aufklappbare Gesamtkalkulation
  HeadCostBadge.tsx             — Header-Badge
  BenchmarkInfoDrawer.tsx       — Sub-Overlay bei Klick auf „n=X"

src/lib/
  benchmarkLookup.ts            — vorlage_zeit + vorlage_verbrauch Queries
  stationContext.ts             — Mapping Station → Variante + Schritte
  costCalculation.ts            — Live-Summen
```

### 9.2 Erweiterte Komponenten (bestehend)

```
src/components/orders/
  OrderOverlay.tsx              — fügt StationContextBlock ein, sonst unverändert
  OrderHeader.tsx               — fügt HeadCostBadge ein
  QuickActions.tsx              — markiert „Verbrauch" als accent-link, Klick scrollt
```

### 9.3 Nicht anfassen

```
src/components/orders/
  StationStrip.tsx              — bleibt wie er ist
  ItemsList.tsx                 — bleibt wie er ist
  CustomerKpiRow.tsx            — bleibt wie er ist
  OtherOrdersRow.tsx            — bleibt wie er ist
  OrderHistory.tsx              — bleibt wie er ist
```

---

## 10 · Datenflüsse

### 10.1 Beim Öffnen des Overlays

```
1. useOrderOverlay(orderId, { initialStation })
   → Lädt order + items + events
   → Setzt activeStation = initialStation ?? order.current_station_id
2. StationContextBlock(activeStation):
   → station ∈ {entmet, schleif, galvanik} → ErfassungVariant
   → station = warenausgang → VersandVariant
   → station = wareneingang & completed → WareneingangReadOnly
3. ErfassungVariant lädt:
   → benchmarkLookup(item.teilekategorie, item.surface_requested, activeStation)
   → bisherige Buchungen für activeStation aus arbeitszeit_buchung + consumable_uses
```

### 10.2 Beim „Erfassung buchen"

```
1. erfassungAction.bookStationCosts({
     orderId, station, arbeitszeitEntries[], consumableEntries[], extras[]
   })
2. Server Action schreibt in arbeitszeit_buchung + consumable_uses
3. Postgres-Trigger fn_update_order_db aktualisiert orders.db_ist
4. Realtime-Subscription pusht Update an Overlay
5. Header-Kosten-Badge + Gesamtkalkulation aktualisieren sich
```

### 10.3 Beim „Versandmail senden"

```
1. shipmentAction.sendShippingConfirmation({
     orderId, trackingNumber, shippingMethod
   })
2. INSERT shipments + INSERT communication_messages(template='versandbereit')
3. Resend API call mit gefülltem Template
4. orders.status = 'shipped', UPDATE
5. events INSERT (event_type = 'SHIPPED')
```

---

## 11 · Akzeptanzkriterien

1. OrderOverlay zeigt zwischen Stationsleiste und KPI-Karten einen neuen Kontext-Block. Position ist fix.
2. Klick aus Warendurchlauf-"Galvanik" öffnet Overlay mit aktiver Station = Galvanik und Erfassungs-Variante sofort sichtbar.
3. Klick aus Warendurchlauf-"Warenausgang" öffnet Overlay mit Versand-Variante.
4. Klick auf eine Station im Stationsstrip wechselt die Block-Variante ohne Modal-Wechsel.
5. Erfassungsvariante zeigt Arbeitszeit-Schieber pro Arbeitsschritt (Liste aus `vorlage_zeit`).
6. Gelbe Zone im Schieber nur sichtbar wenn `n_referenzauftraege ≥ 3`.
7. Material-Stepper vorgeschlagen aus `vorlage_verbrauch` mit `haeufigkeit_prozent ≥ 50`.
8. Zusatzaufwand (Richten, Löten, Express) als Ja/Nein-Toggle.
9. „Erfassung buchen" schreibt in `arbeitszeit_buchung` + `consumable_uses`.
10. Header-Kosten-Badge aktualisiert sich live nach Buchung (Realtime).
11. Versand-Variante zeigt Lieferart-Auswahl (Versand/Abholung), Empfänger, Tracking-Eingabe.
12. Wareneingang-Variante zeigt Read-only-Zusammenfassung mit „nacherfassen"-Toggle.
13. Quick-Action „Verbrauch" ist accent-farbig und scrollt zum Kontext-Block mit Puls-Animation.
14. Gesamtkalkulations-Tabelle (alle Stationen) ist standardmäßig eingeklappt.
15. Bestehende Teile-Liste, Kunden-KPI, Quick Actions, Auftragshistorie und Footer: **unverändert**.
16. Visueller Standard: CI-Tokens aus `src/styles/ci-tokens.css`. Keine hartcodierten Hex.
17. Kein Mock, kein `Math.random`. Empty State: „Noch keine Buchung erfasst — beginne mit dem ersten Schieber."

---

## 12 · STOPP-Bedingungen

- Stationsleiste wird umgebaut oder ausgetauscht → STOPP
- Kontext-Block wird als separates Modal statt Inline-Block gebaut → STOPP
- „Verbrauch"-Button öffnet ein altes Modal statt zum Block zu scrollen → STOPP
- Erfassung schreibt in `events` statt in `arbeitszeit_buchung` → STOPP
- Benchmark-Zone wird ohne `n_referenzauftraege ≥ 3` angezeigt → STOPP
- Bestehende Bereiche (KPI, Teile, Kunden-KPI, Historie) werden umgeordnet oder verändert → STOPP
- Pfad-Eintritt aus Warendurchlauf wird nicht ausgewertet (zeigt immer dieselbe Station) → STOPP

---

## 13 · Build-Reihenfolge

1. `StationContextBlock.tsx` als leere Hülle mit Variante-Switch
2. `HeadCostBadge.tsx` und Einbau in `OrderHeader.tsx`
3. `ErfassungVariant.tsx` mit Schiebern (zunächst statisch, dann an Vorlage anbinden)
4. `MaterialStepper.tsx` + `ExtraEffortToggles.tsx`
5. Erfassung-Buchungs-Server-Action + Trigger-Test
6. `VersandVariant.tsx` mit Lieferart-Auswahl + Tracking
7. `WareneingangReadOnly.tsx`
8. `CostSummaryTable.tsx` (aufklappbar)
9. Quick-Action „Verbrauch" zu Anker-Link umbauen
10. Route-Parameter `?station=` auswerten beim Öffnen

Nach jedem Punkt: visuell mit `auftragsoverlay_v3_mit_erfassung.html` vergleichen.

---

## 14 · Nicht in dieser Spec

| Thema | Wo |
|---|---|
| Vorlage-Tabellen anlegen | Spec 39 (existiert) |
| Trigger `fn_update_vorlagen` | Spec 39 (existiert) |
| Trigger `fn_update_order_db` | Spec 44 §10.1 |
| Performance-Kachel Umsatz & Marge | Spec 44b (folgt) |
| Bad-Auswahl Tabelle `bath_uses` | Spec 46 (folgt) |
| DATEV-Export | Spec 36 Phase 3 |

---

*Ende Spec 45. Visuelle Referenz: `auftragsoverlay_v3_mit_erfassung.html`. Vorlage-Overlay (unverändert): `auftragsoverlay_v2_CI_2.html`.*
