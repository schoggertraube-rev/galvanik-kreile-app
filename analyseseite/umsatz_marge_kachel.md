# Umsatz und Marge — Kachel-Spezifikation

> **Kontext:** Kachel 2 der Analyseseite, links unter dem Werkstatt-Puls-Hero  
> **Status:** Spezifikation für Build · noch kein Antigravity-Prompt  
> **Stand:** 11.06.2026  
> **Begleitdatei:** `umsatz_marge_level2.html` (visueller Hintergrund Level 2 + 3)

---

## 1 · Zweck

Die Kachel beantwortet die kaufmännische Kernfrage:

1. Was haben wir verdient — Tag, Woche, Monat, Jahr?
2. Mit welcher Marge — und wo erodiert sie?
3. Welche Kunden und Auftragsarten bringen Geld, welche nicht?
4. Was kommt rein — Pipeline, Forecast, offene Posten?
5. Was würde passieren, wenn wir Preis, Personal, Investition oder Akquise verändern?

Das ist die Kachel, die der Inhaber morgens als zweites öffnet, nachdem er den Werkstatt-Puls gesehen hat. Sie ist das, was die alte Cockpit-Route `/cockpit` (Spec 37) leistet — jetzt integriert.

---

## 2 · Position und Sichtbarkeit

| Aspekt | Festlegung |
|---|---|
| Position Level 1 | linke Spalte, Reihe 2 (neben „Qualität und Risiko") |
| Sichtbarkeit | nur Rolle `inhaber` (Mitarbeiter sehen Umsatz/Marge nicht) |
| Plan-Minimum | Pro (Locked-Card mit Demo-Werten für Basis) |
| Datenreife-Minimum | S1 — ab 5 erstellten Rechnungen sichtbar; YoY-Vergleich erst ab S4 (≥ 12 Monate Daten) |

---

## 3 · Level-1-Inhalt (Kachel auf der Analyseseite)

### 3.1 Was sichtbar ist

| Element | Inhalt | Quelle |
|---|---|---|
| Icon + Titel | „Umsatz und Marge" mit Geldscheine-Icon | statisch |
| Untertitel | „Finanzen · Forecast · Controlling" | statisch |
| Status-Pill | Stabil / Beobachten / Kritisch (abgeleitet aus Marge × Klumpenrisiko × Aging) | `v_monatsergebnis` |
| KPI 1: Umsatz netto | aktueller Monat · ▲/▼ vs. Vorjahr | `v_monatsergebnis.umsatz_netto_eur` |
| KPI 2: Deckungsbeitrag | absoluter Betrag · Marge % | `v_monatsergebnis.db_ist_eur` |
| Sparkline | Umsatzverlauf 12 Monate, dezent | `v_monatsergebnis` × 12 |

### 3.2 Vergleichsmodus

Bei aktiviertem Vergleichs-Button:

| Δ-Anzeige | Wert |
|---|---|
| Umsatz Δ | absoluter € + % |
| DB Δ | absoluter € + Marge-Punkte |
| Forecast-Treffsicherheit Δ | nur wenn Snapshot vorhanden |

### 3.3 Klick-Verhalten

Klick auf Kachel → Level 2 (Themen-Seite). Klick auf Sparkline → Level 2 mit Tab „Verlauf" vorausgewählt.

---

## 4 · Level-2-Inhalt (Themen-Seite hinter der Kachel)

### 4.1 Header

| Element | Verhalten |
|---|---|
| Breadcrumb | „Analyse › Umsatz und Marge" |
| Zeitraum-Picker | Heute · Woche · Monat · Quartal · YTD · Frei |
| Vergleichs-Button | Vorperiode · Vorjahr · Vorvorjahr |
| Status-Pill | Stabil / Beobachten / Kritisch |

### 4.2 Hero-KPI-Block (6 Kennzahlen)

| KPI | Hauptwert | Zusatzinfo | Visualisierung |
|---|---|---|---|
| Umsatz netto | 38.200 € | ▲ +7,2 % vs. Vj. · Ziel 40.000 € | Sparkline 12 M |
| Deckungsbeitrag | 13.450 € | Marge 35,2 % · ▼ −1,3 Pkt. vs. Vj. | Sparkline 12 M |
| Forecast Monatsende | 41.800 € | Konfidenz 78 % · MAPE 9,2 % | Linie mit Bereich |
| Offene Forderungen | 8.230 € | Ø Zahlungsdauer 18 T · 1 > 90 T | Aging-Mini-Balken |
| DB / Stunde aktiv | 38 € | Ziel 45 € · −7 € | Vergleichsbalken |
| Pipeline (offen + angeboten) | 41.700 € | 12 in Arbeit · 6 Angebote | Funnel-Mini |

### 4.3 KI-Empfehlungs-Block

| Sektion | Inhalt |
|---|---|
| Beobachtung | „**Museum Lenzburg bringt 43 % des YTD-Umsatzes** — Klumpenrisiko. Marge im Segment Industrieteile bei 24 % (Ziel 32 %)." |
| Empfehlung | „Segment Oldtimer wächst +12 % YoY mit Marge 42 %. Akquise dort priorisieren. Industrieteile: Preisprüfung bei ähnlichen Aufträgen vornehmen." |
| Action-Buttons | Top-Kunde öffnen · Segment Oldtimer · BWA |

Quelle: Edge Function `kpi-insight` mit View-Werten. Fehlerfall → keine Empfehlung, sichtbarer Hinweis.

### 4.4 Großer Verlaufs-Chart (12 Monate)

| Layer | Inhalt | Stil |
|---|---|---|
| Umsatz aktuelles Jahr | Balken pro Monat | Magenta, voll |
| Umsatz Vorjahr | Balken-Outline pro Monat | cream-braun, transparent |
| DB-Linie aktuell | überlagerte Linie | dunkler Magenta, dünn |
| Marge % rechts | sekundäre Y-Achse | dezenter Hinweis am rechten Rand |
| Forecast-Bereich | letzten 2 Monate gestrichelt mit Konfidenzband | hellblau gestreift |

Footer-Zeile: Bestmonat · Tiefmonat · YoY-Trend · Cumulativ YTD vs. Vorjahr.

### 4.5 Tabs / Drill-Dimensionen

Sechs Tabs unter dem großen Chart, je ein eigenes Panel:

#### Tab A — Top-Kunden

Sortierte Tabelle (Top 10 nach DB), klickbar → öffnet Level-3-Drawer:

| Spalte | Inhalt |
|---|---|
| # | Rang 1–10 |
| Kunde | Name + Segment-Pill |
| Umsatz YTD | absoluter € |
| Anteil | % am Gesamt-Umsatz, farbcodiert ≥ 25 % als Klumpenrisiko |
| DB / Marge | € + Marge-% |
| Aufträge | Anzahl + Trend-Pfeil |
| Pünktlichkeit | % Zahlungs-OK |
| Status | A / B / C · Inaktiv-Pill bei > 9 Mon ohne Auftrag |

#### Tab B — Teiletyp / Auftragsart

Bubble-Chart:
- X-Achse: Umsatz YTD
- Y-Achse: Marge %
- Bubble-Größe: Anzahl Aufträge
- Bubble-Farbe: Reklamationsquote (grün ≤ 1 %, amber 1–3 %, rot > 3 %)

Beispieltypen: Oldtimer-Stoßstangen, Bestecke, Türklinken/Beschläge, Motorradteile, Kerzenleuchter, Industrieteile, Schmuckteile.

Klick auf Bubble → Auftragsliste des Typs.

#### Tab C — Oberfläche

Balken-Ranking nach Marge:

```
Vergolden       Marge 48 %   Umsatz 6.200 €   ████████████
Verchromen      Marge 42 %   Umsatz 18.400 €  █████████
Vernickeln      Marge 38 %   Umsatz 9.800 €   ████████
Versilbern      Marge 35 %   Umsatz 2.400 €   ███████
Brünieren       Marge 28 %   Umsatz 1.400 €   ██████
```

Klick auf Zeile → Aufträge mit dieser Oberfläche.

#### Tab D — Monatsmix (Stacked Bar)

Pro Monat ein gestapelter Balken:
- Bezahlt (grün)
- In Rechnung, offen (amber)
- In Arbeit, noch nicht abgerechnet (cream)
- Angeboten / nicht beauftragt (transparent grau)

Liefert auf einen Blick: Pipeline-Health über die Zeit.

#### Tab E — Forecast & Pipeline

Funnel-Visualisierung von links nach rechts:

```
Anfragen → Angebote → Beauftragt → In Arbeit → Abgerechnet → Bezahlt
 24         6           12          19           41          33
 ~9.600€    8.400€      28.500€     28.500€      38.200€     29.970€
```

Pro Stufe: Conversion-Rate zur nächsten Stufe + Ø Zeit.

Darunter Forecast-Linie 4 / 8 / 12 Wochen:
- Punkt-Forecast + Konfidenzband
- MAPE der letzten 30 Tage
- automatische Eskalation bei MAPE > 20 % über 3 Tage (gemäß Spec 37 / Revenue-Intelligence-Vorbild)

#### Tab F — Forderungen & Zahlung

Aging-Balken in 4 Segmenten:

| Segment | Betrag | Anzahl | Aktion |
|---|---|---|---|
| < 30 T | 4.200 € | 6 Rechnungen | im Plan |
| 30–60 T | 2.400 € | 3 | Erinnerung empfohlen |
| 60–90 T | 1.230 € | 2 | Mahnung Stufe 1 |
| > 90 T | 400 € | 1 | Mahnung Stufe 2 / Klärung |

Darunter Liste der offenen Rechnungen, klickbar → Rechnungsdetail.

Zusätzlich Zahlungsarten-Verteilung (Mollie-Link / SEPA / Bar später):

```
SEPA-Überweisung    68 %
Mollie-Link         24 %
Bar / Sofort         8 %
```

### 4.6 Finanzcontrolling (zusammenklappbarer Block, aus altem Cockpit)

| Element | Wert | Bemerkung |
|---|---|---|
| Verrechnungssatz | 75 €/h | aus `company_settings`, in Settings änderbar (gesperrt gegen Versehen) |
| Fixkosten Monat | 11.200 € | aus `beleg WHERE typ='fix'` SUM |
| Variable Kosten Monat | 13.550 € | aus `beleg WHERE typ='variabel'` SUM |
| DB1 (Umsatz − variabel) | 24.650 € | berechnet |
| DB / Stunde aktiv | 38 € | aus arbeitszeit_buchung |
| Break-Even-Punkt | 31.800 € | Fixkosten / Marge % |
| Stand vs. Break-Even | +6.400 € (20 %) | „diesen Monat über Break-Even" |

Regler bewusst **nicht** auf der Analyseseite — sie gehören in Settings (Spec 36). Werte werden nur **gelesen** und angezeigt.

### 4.7 What-If-Studio (zusammenklappbarer Block, eigener Drawer)

4 Szenario-Karten in einer Reihe, jede öffnet einen Drawer mit Eingabefeldern und Live-Ergebnis:

| Szenario | Eingabe | Ergebnis |
|---|---|---|
| **Investition** | Anschaffung €, Nutzungsdauer Jahre, erwarteter Mehrumsatz €/Monat | Amortisation in N Monaten · ROI % · DB-Veränderung |
| **Mitarbeiter** | Stundenlohn €, Vollzeit %, erwartete Mehrleistung Aufträge/Mon | Break-Even bei N Aufträgen · zusätzlicher DB |
| **Preis** | Aufschlag % (Slider −10 % … +20 %) | DB-Veränderung €/Mon · geschätzte Abwanderung % (aus Preiselastizität) |
| **Neukunde** | Erwarteter Umsatz/Auftrag €, Aufträge/Jahr, Marge % | Jahres-DB · CLV-Projektion 3 Jahre |

Wichtig: Szenarien arbeiten mit **echten** DB-Daten aus `v_monatsergebnis` und `v_kunde_clv` als Basis, **nicht** mit erfundenen Kostenstellen (das war der Bug in Spec 37 Phase 8).

Ergebnis nicht speichern — pure Berechnung mit Hinweis „Szenario-Berechnung, keine Buchung".

### 4.8 „Vernetzt mit"-Sektion

| Tile | Zielinhalt | Ziel-Route |
|---|---|---|
| Kunden | Top-Kunde + Inaktivenliste | `/customers?sort=db_desc` |
| Rechnungen | Offene Posten N € | `/buchhaltung/rechnungen?status=offen` |
| Buchhaltung | BWA-Ergebniszeile | `/buchhaltung/bwa` |
| Marketing | Attribution: Umsatz aus Aktion N | `/marketing/attribution` (sofern Plan) |
| Aufträge | Pipeline + Auftrags-DB-Ranking | `/orders?sort=db_desc` |

### 4.9 Export-Leiste (am Fuß der Themen-Seite)

| Export | Format | Inhalt |
|---|---|---|
| DATEV | CSV | Buchhaltung im DATEV-Format |
| Lexware | CSV | Lexware-Format |
| Steuerberater-Paket | ZIP | Belege + CSV + Periodenübersicht |
| Monatsbericht | PDF | KPIs + Charts + Zusammenfassung |
| BWA | PDF | Betriebswirtschaftliche Auswertung |
| Materialverbrauchs-Report | CSV | Chemie, Metalle, Kosten |

Periode für Export = aktiver Zeitraum-Picker.

### 4.10 Datenherkunft-Footer

```
● v_monatsergebnis        · 12 Monate · live
● v_auftrag_db            · 47 Aufträge mit DB-Berechnung
● v_kunde_clv             · 24 Kunden · live
● v_aging                 · 12 offene Rechnungen
● kpi_snapshots           · YoY-Vergleich teils synthetisch (S3)
◐ Forecast-Modell         · MAPE 9,2 % · Modell-Version 2026-05
                                            Letztes Update: vor 8 Min.
```

---

## 5 · Level-3-Inhalte (Drawer / Detail-Views)

### 5.1 Top-Kunde-Drawer (Klick auf Kunde in Tab A)

Slide-in von rechts, ca. 40 % Bildschirmbreite. Inhalt:

| Sektion | Inhalt |
|---|---|
| Header | Kundenname + Segment + A/B/C-Klassifikation + Inaktiv-Pill falls > 9 Mon |
| KPI-Block | Umsatz YTD · DB YTD · Marge % · Aufträge gesamt · Reklamationsquote · Ø Zahlungsdauer |
| Mini-Chart | Umsatzverlauf 24 Monate |
| Auftragshistorie | Letzte 10 Aufträge mit Datum · Titel · Umsatz · DB · Status |
| Zahlungsmoral | Aging-Verlauf der letzten 12 Monate · Ausreißer markiert |
| Reklamationen | Liste falls vorhanden, mit Ursache und Kosten |
| Kommunikations-Stub | Letzter Kontakt · Anzahl offener Freigaben · Ø Antwortzeit |
| Reaktivierungs-Aktion | bei Inaktiv: Button „Reaktivierungs-Mail vorbereiten" |
| Vernetzt | Links zu Kundenakte, Rechnungen, Aufträge, Kommunikation |

### 5.2 Teiletyp-Drilldown (Klick auf Bubble in Tab B)

Slide-in von rechts. Inhalt:

| Sektion | Inhalt |
|---|---|
| Header | Typ-Name + Pillen (Anzahl Aufträge, Ø Umsatz/Auftrag) |
| Marge-Verlauf | Linie 12 Monate |
| Aufträge-Tabelle | Alle Aufträge des Typs mit Kunde, Datum, Umsatz, DB, Reklamation |
| Reklamationsmuster | falls vorhanden: häufigste Ursache + betroffene Station |
| Ähnliche Preisreferenzen | aus `price_references` (Spec Kundenkartei §8) |
| Preisvorschlag | KI-Hinweis falls Marge < Ziel |

### 5.3 What-If-Drawer (Klick auf eine der 4 Szenario-Karten)

Slide-in von rechts. Inhalt:

| Sektion | Inhalt |
|---|---|
| Header | Szenarioname + Beschreibung |
| Eingabefelder | szenariospezifisch (siehe 4.7) |
| Berechnung-Live | Ergebnis wird bei Eingabe sofort aktualisiert |
| Ergebnis-Block | mehrere Kennzahlen mit Ableitungsformel sichtbar |
| Vergleich | Ist-Zustand vs. Szenario, farbcodiert |
| Hinweis | „Szenario-Berechnung, keine Buchung. Werte basieren auf den letzten 90 Tagen." |
| Aktion | „Notiz erstellen" (legt nur Memo an, ändert keine Daten) |

### 5.4 Forderungs-Drilldown (Klick auf Aging-Segment in Tab F)

Slide-in von rechts. Liste aller Rechnungen im Segment mit:

| Spalte | Inhalt |
|---|---|
| Rechnungsnummer | Fraunces, klickbar → Rechnungsdetail |
| Kunde | Name |
| Datum | Ausstellung |
| Fällig | Datum, rot bei überfällig |
| Betrag | € brutto |
| Tage offen | Anzahl |
| Mahn-Status | Keine / Stufe 1 / Stufe 2 / Klärung |
| Aktion | Button „Erinnerung vorbereiten" / „Mahnung erstellen" |

### 5.5 Forecast-Detail (Klick auf Forecast-KPI oder Funnel-Stufe)

Slide-in von rechts:

| Sektion | Inhalt |
|---|---|
| Modell-Info | Version · MAPE · Trainingsdatenbasis |
| Variablen | welche Faktoren fließen ein (Saison, Wochentag, Pipeline, Vorjahr) |
| Konfidenzbänder | 4 / 8 / 12 Wochen |
| Eskalations-Log | wann wurde welcher Forecast-Fehler eskaliert |
| Manuelle Korrektur | Override-Möglichkeit (Inhaber-only, mit Begründung) |

---

## 6 · Datenquellen

### 6.1 Pflicht-Views

| View | Liefert | Basis-Tabellen |
|---|---|---|
| `v_monatsergebnis` | Umsatz/DB/Marge pro Monat | `ausgangsrechnung`, `beleg`, `arbeitszeit_buchung`, `consumable_uses` |
| `v_auftrag_db` | DB je Auftrag | `orders`, `items`, `arbeitszeit_buchung`, `consumable_uses`, `beleg` (Energieverteilung) |
| `v_kunde_clv` | CLV, DB-Marge, Inaktivität je Kunde | `ausgangsrechnung` × `orders` × `customers` |
| `v_aging` | Forderungs-Altersstruktur | `ausgangsrechnung WHERE bezahlt_am IS NULL` |
| `v_analyse_segment_marge` | Marge je Teiletyp / Oberfläche | `items` + `orders` + `v_auftrag_db` |
| `v_analyse_oberflaeche_db` | DB je Oberfläche | `items.surface_target` + `v_auftrag_db` |
| `v_analyse_zahlungsmix` | Verteilung Zahlungsarten | `payments` |
| `v_analyse_pipeline` | Aufträge je Pipeline-Stufe (Anfrage → Angebot → Auftrag → Rechnung → Zahlung) | `orders.status` + `ausgangsrechnung.status` + `payments.status` |

### 6.2 Tabellen-Stand (verifiziert)

| Tabelle | Genutzte Spalten |
|---|---|
| `orders` | `id`, `customer_id`, `created_at`, `completed_date`, `status`, `db_geplant`, `db_ist`, `kostenstelle_primaer_id` |
| `items` | `id`, `order_id`, `preis_netto`, `surface_target`, `item_type` (für Teiletyp-Aggregation) |
| `ausgangsrechnung` | `id`, `order_id`, `customer_id`, `brutto_eur`, `netto_eur`, `status`, `ausgestellt_am`, `faellig_am`, `bezahlt_am` |
| `beleg` | `id`, `order_id`, `kategorie`, `typ` (fix/variabel), `netto_eur`, `belegdatum` |
| `arbeitszeit_buchung` | `auftrag_id`, `dauer_minuten`, `kostensatz_eur_pro_stunde` |
| `consumable_uses` | `order_id`, `unit_cost_eur`, `quantity` |
| `payments` | `id`, `order_id`, `provider`, `method`, `status`, `paid_at`, `created_at`, `fee_eur` |
| `customers` | `id`, `company_name`, `first_name`, `last_name`, `classification` (A/B), `segment` |
| `kpi_snapshots` | YoY-Werte für Umsatz, DB, Marge je Monat |

### 6.3 Kennzahlen-Formeln (verbindlich, eine Quelle)

```
Umsatz netto       = SUM(ausgangsrechnung.netto_eur WHERE status != 'storniert')

DB pro Auftrag     = SUM(items.preis_netto)
                   − SUM(consumable_uses.unit_cost_eur × quantity)
                   − SUM(arbeitszeit_buchung.dauer_minuten / 60 × kostensatz)
                   − anteilige_energiekosten_eur

Marge %            = DB / Umsatz × 100

DB / Stunde aktiv  = SUM(DB)
                   ÷ SUM(arbeitszeit_buchung.dauer_minuten / 60)

Break-Even         = SUM(beleg WHERE typ='fix') / (Marge % aus Vorperiode)

Klumpenrisiko      = Top-Kunde-Anteil am YTD-Umsatz; ≥ 25 % = gelb, ≥ 40 % = rot

Aging-Segment      = age_days(now() − ausgangsrechnung.faellig_am)
                   < 30 / 30-60 / 60-90 / > 90 Tage

CLV                = SUM(ausgangsrechnung.brutto_eur WHERE order_id IN
                          (SELECT id FROM orders WHERE customer_id = X))

Pünktlichkeit Kunde = COUNT(bezahlt_am <= faellig_am)
                    ÷ COUNT(bezahlt_am IS NOT NULL)

Forecast           = ARIMA / Saison-Modell (S3+) auf 12-Monats-Historie
                     + Pipeline-Aufschlag (offene Angebote × Conversion-Rate)
                     + Wochentag-Korrektur
```

---

## 7 · Komponenten (zu bauen)

```
src/features/analyse/kacheln/umsatz-marge/
  UmsatzMargeTile.tsx              ← Level 1: Hero-Kachel auf Analyseseite
  UmsatzMargePage.tsx              ← Level 2: Themen-Seite
  components/
    UmsatzHeroBlock.tsx            ← 6 KPIs
    UmsatzTrendChart.tsx           ← Recharts Combo (Bar + Line + Forecast-Band)
    UmsatzKiBlock.tsx              ← KI-Empfehlung (Edge Function)
    UmsatzTabs.tsx                 ← Tab-Navigation
    tabs/
      TopKundenTable.tsx
      TeiletypBubbleChart.tsx
      OberflaecheRanking.tsx
      MonatsmixStackedBar.tsx
      ForecastFunnel.tsx
      ForderungenAging.tsx
    FinanzcontrollingBlock.tsx     ← lesend, keine Regler
    WhatIfStudio.tsx               ← 4 Karten
    UmsatzLinksGrid.tsx
    UmsatzExportBar.tsx            ← 6 Export-Buttons
  drawers/
    KundeDetailDrawer.tsx          ← Level 3
    TeiletypDetailDrawer.tsx       ← Level 3
    WhatIfDrawer.tsx               ← Level 3 mit 4 Szenarien
    ForderungDetailDrawer.tsx      ← Level 3
    ForecastDetailDrawer.tsx       ← Level 3
  hooks/
    useUmsatzMarge.ts
    useTopKunden.ts
    useTeiletypMarge.ts
    useForecast.ts
    useAging.ts
    useWhatIfBerechnung.ts         ← reine Berechnungs-Hooks, kein DB-Write
```

**Wichtig:** Kein `mockData`-Import. Kein `Math.random`. Keine erfundenen Kostenstellen.

---

## 8 · Akzeptanzkriterien

1. Alle KPI-Werte stammen nachweisbar aus den genannten Views (DB-Wert = UI-Wert, SQL gegenprüfbar).
2. DB-Berechnung folgt der einen Formel oben — sowohl in `v_auftrag_db` als auch in `v_monatsergebnis`. Kein Frontend-Recompute.
3. Vorjahresvergleich erscheint nur, wenn `kpi_snapshots` für die Vorjahresperiode Werte hat. Sonst Hinweis statt Zahl.
4. Top-Kunden-Tabelle zeigt Klumpenrisiko ab 25 % Anteil farbcodiert, ab 40 % als roten Alarm.
5. Bubble-Chart Teiletyp zeigt nur Typen mit ≥ 3 Aufträgen (sonst keine valide Aussage).
6. Aging-Segmente sind klickbar und öffnen die zugehörige Rechnungsliste.
7. What-If-Szenarien lesen aus `v_monatsergebnis` / `v_kunde_clv`, **nicht** aus hardcoded Werten.
8. What-If-Berechnung schreibt nichts in die DB. Hinweis „keine Buchung" sichtbar.
9. Forecast zeigt Konfidenzband + MAPE der letzten 30 Tage. Bei MAPE > 20 % → roter Hinweis.
10. Exporte respektieren den aktiven Zeitraum-Picker.
11. Bei Plan Basis: Locked-Card mit Demo-Werten, Plan-Hinweis nur für Rolle `inhaber`.
12. Bei S0 (< 5 Rechnungen): Leerzustand „Noch keine Rechnungen erfasst" + Link zu `/buchhaltung/rechnungen/neu`.
13. Bei S1–S2: YoY-Vergleichswerte werden ausgeblendet (statt geschätzt).
14. Sichtbarkeit: nur Rolle `inhaber`. Andere Rollen bekommen die Kachel gar nicht zu sehen.
15. Drawer schließt mit ESC und Klick außerhalb. Inhalte werden bei jedem Öffnen frisch geladen.

---

## 9 · STOPP-Bedingungen

| Bedingung | Reaktion |
|---|---|
| `ausgangsrechnung.order_id` ist NULL in > 20 % der Rechnungen | STOPP. Datenmodell-Patch (siehe Spec 39 Phase A) durchführen. Bis dahin: Umsatz-pro-Auftrag nicht zeigen, nur Gesamt-Umsatz. |
| `inventory_items.einkaufspreis_eur` fehlt | STOPP. Materialkosten in DB-Berechnung als „nicht erfasst" kennzeichnen, **nicht** schätzen. |
| `arbeitszeit_buchung` oder `consumable_uses` leer | DB-Berechnung deaktivieren, nur Umsatz zeigen, mit Hinweis „DB erst nach Zeiterfassung berechenbar". |
| `kpi_snapshots` leer | YoY-Spalte ausblenden, Hinweis im Datenherkunft-Footer. |
| Antigravity will Kostenstellen erfinden für What-If | STOPP. Verweis auf Spec 36 Phase 2 (echte Kostenstellen-Tabelle). |
| Antigravity will DATEV-Export bauen ohne Konten-Mapping | STOPP. Verweis auf Spec 36 Phase 5 (Massenzuordnung). |

---

## 10 · Reihenfolge des Baus

```
Schritt 1 — DB-Vertrag prüfen
            ausgangsrechnung.order_id muss vorhanden und gefüllt sein
            beleg.kategorie und beleg.typ müssen gepflegt sein
            arbeitszeit_buchung und consumable_uses müssen Daten enthalten

Schritt 2 — Views anlegen / prüfen
            v_monatsergebnis (existiert aus Spec 36)
            v_auftrag_db (existiert aus Spec 36)
            v_kunde_clv (existiert aus Spec 37)
            v_aging (existiert aus Spec 37)
            v_analyse_segment_marge (neu)
            v_analyse_oberflaeche_db (neu)
            v_analyse_zahlungsmix (neu)
            v_analyse_pipeline (neu)

Schritt 3 — kpi_snapshots-Tabelle hat Monatswerte (Seed wenn nötig)

Schritt 4 — Level 1: UmsatzMargeTile.tsx
            zeigt echte Werte oder Leerzustand. Nie Mock.

Schritt 5 — Level 2 Header + Hero-Block + KI-Empfehlung
            6 KPIs aus v_monatsergebnis

Schritt 6 — Level 2 Verlaufs-Chart
            Bar + Line + Forecast-Band

Schritt 7 — Level 2 Tabs einzeln, in Reihenfolge:
            A Top-Kunden    (am wichtigsten)
            F Forderungen   (operativer Wert)
            E Forecast      (strategischer Wert)
            B Teiletyp      (analytisch wertvoll)
            C Oberfläche    (analytisch wertvoll)
            D Monatsmix     (zuletzt)

Schritt 8 — Level 3 Drawer in dieser Reihenfolge:
            Kunde-Detail      (häufigster Use)
            Forderung-Detail  (operativ wichtig)
            What-If-Studio    (Premium-Feature)
            Teiletyp-Detail   (zuletzt)
            Forecast-Detail   (zuletzt)

Schritt 9 — Finanzcontrolling-Block (lesend) anbinden
            Werte aus company_settings, Regler bleiben in Settings

Schritt 10 — Export-Leiste
             DATEV + Lexware + Steuerberater-Paket + Monatsbericht

Schritt 11 — Verifizierung gegen DB
             SQL gegen Supabase, Werte = UI-Werte
             besonders: Klumpenrisiko-Berechnung, DB-Formel
```

Jeder Schritt einzeln freigeben.

---

## 11 · Was die Kachel NICHT macht

- Keine Verrechnungssatz-Regler auf der Analyseseite (gehört in Settings, Spec 36)
- Keine Buchungen aus What-If-Szenarien
- Keine erfundenen Kostenstellen, Demo-Margen oder Math.random
- Keine Forecast-Anzeige ohne sichtbaren MAPE
- Kein YoY-Vergleich ohne Snapshot-Basis
- Keine Marge-Anzeige für Kunden mit weniger als 2 Aufträgen (statistisch nicht aussagekräftig)
- Keine Kundennamen für Mitarbeiter sichtbar (nur Inhaber)
- Keine Mahnstufen-Eskalation automatisch ohne Inhaber-Freigabe
- Keine direkten Rechnungsänderungen aus der Analyseseite (nur Lese-Drilldowns)
- Keine Marketing-Attribution-Anzeige ohne erfasste Quellen (Pipeline-Tab blendet sie aus, statt 0 % zu zeigen)
