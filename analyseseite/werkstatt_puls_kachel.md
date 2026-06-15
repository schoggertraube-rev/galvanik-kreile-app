# Werkstatt-Puls — Kachel-Spezifikation

> **Kontext:** Hero-Kachel der neuen Analyseseite (volle Breite, ganz oben unter der schlanken KI-Zeile)  
> **Status:** Spezifikation für Build · noch kein Antigravity-Prompt  
> **Stand:** 10.06.2026  
> **Begleitdatei:** `werkstatt_puls_level2.html` (visueller Hintergrund Level 2)

---

## 1 · Zweck

Der Werkstatt-Puls beantwortet drei Fragen für den Chef in **unter 10 Sekunden:**

1. Läuft die Werkstatt diese Woche sauber?
2. Wo entsteht Reibung im Prozess?
3. Was kostet die Reibung — und was tue ich jetzt?

Diese Kachel ist die operative Achse der Analyseseite. Sie ist die einzige Kachel in voller Breite (Hero) und der häufigste Einstieg in den Drill-Down.

---

## 2 · Position und Sichtbarkeit

| Aspekt | Festlegung |
|---|---|
| Position Level 1 | direkt unter der KI-Zeile, volle Seitenbreite |
| Sichtbarkeit | alle Rollen mit Analyse-Zugriff (Plan Pro+) |
| Datenreife-Mindest | S1 — ab 5 abgeschlossenen Aufträgen |
| Bei S0 (< 5 Aufträge) | Leerzustand „Noch keine abgeschlossenen Aufträge" + Link zu `/orders/neu` |
| Bei Plan Basis | Locked-Card mit Demo-Werten + Plan-Hinweis (nur Inhaber sieht Hinweis) |

---

## 3 · Level-1-Inhalt (Kachel auf der Analyseseite)

### 3.1 Was sichtbar ist

| Element | Inhalt | Quelle (View) |
|---|---|---|
| Icon + Titel | „Werkstatt-Puls" mit Pulsschlag-Icon | statisch |
| Untertitel | „Durchsatz · Stationen · Wochenziel" | statisch |
| Status-Pill rechts oben | Handlungsbedarf / Stabil / OK (abgeleitet aus Score) | `v_werkstatt_puls.score` |
| KPI 1: Termintreue | 76 % · Trend ▼ −9 Pkt. vs. Vw. · Mini-Sparkline | `v_werkstatt_puls.termintreue_pct` |
| KPI 2: Ø Durchlaufzeit | 9,4 T · Trend ▲ +1,2 T · Mini-Sparkline | `v_werkstatt_puls.avg_durchlaufzeit_tage` |
| KPI 3: Wochenziel | 23 / 25 · Fortschrittsbalken 92 % | `v_werkstatt_puls.wochenziel_ist / soll` |
| Stationen-Mini-Bar | 5 Stationsnamen als schmale Leiste, farbcodiert | `v_puls_station_stau` |
| Score-Ring rechts | 64 / 100 mit Magenta-Lila-Gradient | `v_werkstatt_puls.score` |

### 3.2 Vergleichsmodus

Bei aktiviertem Vergleichs-Button erscheinen Delta-Badges in der Kachel:

| Δ-Anzeige | Wert |
|---|---|
| Termintreue Δ | −9 Pkt. (gegen Vorwoche / Vormonat / Vorquartal / Vorjahr) |
| Durchlaufzeit Δ | +1,2 T |
| Wochenziel Δ | +1 Auftrag |

Vorjahres-Δ nur sichtbar, wenn `kpi_snapshots` für den jeweiligen Vergleichszeitraum existiert. Sonst Hinweis statt Zahl.

### 3.3 Klick-Verhalten

Klick irgendwo auf die Kachel → öffnet Level 2 (die in `werkstatt_puls_level2.html` gezeigte Themen-Seite).

Klick spezifisch auf eine Stations-Mini-Bar unten → öffnet Level 2 mit Filter auf diese Station.

---

## 4 · Level-2-Inhalt (Themen-Seite hinter der Kachel)

Aufbau folgt dem universellen `AnalyticsDrillDrawer`-Muster (Spec 08), in dieser Reihenfolge:

### 4.1 Header

| Element | Verhalten |
|---|---|
| Breadcrumb | „Analyse › Werkstatt-Puls" |
| Titel + Subtitle | „Werkstatt-Puls — Durchsatz · Stationen · Wochenziel" + Datenstand |
| Zeitraum-Picker | Heute · Woche · Monat · Frei (Toggle, Pflicht) |
| Vergleichs-Button | Dropdown: Vorwoche / Vormonat / Vorquartal / Vorjahr |
| Status-Pill | Handlungsbedarf / Stabil / OK (groß rechts) |

### 4.2 Hero-KPI-Block (volle Breite, 5 Kennzahlen + Score-Ring)

Erweiterte Version der Level-1-Kachel mit mehr Detail:

| KPI | Hauptwert | Zusatz | Sparkline |
|---|---|---|---|
| Termintreue | 76 % | Δ vs. Vw. · Ziel ≥ 90 % | 8 Wochen |
| Ø Durchlaufzeit | 9,4 T | Δ vs. Vw. · Ziel ≤ 7 T | 8 Wochen |
| Wochenziel KW 24 | 23 / 25 | „2 fehlen · Do/Fr möglich" | Fortschrittsbalken |
| Offene Aufträge | 19 | „davon 3 kritisch" | 8 Wochen |
| Dokumentation | 84 % | Δ vs. Vw. | 8 Wochen |

Score-Ring rechts: 64 / 100 mit Magenta-Lila-Gradient, Label „Werkstatt-Score".

### 4.3 KI-Empfehlungs-Block (eigene Box, lila-akzentuiert)

| Sektion | Inhalt |
|---|---|
| Beobachtung | **„Schleiferei ist seit 3 Tagen Hauptengpass."** + 1 Satz Kontext (Anzahl wartend, Ø Zeit, Ursache) |
| Empfehlung | 1–2 Sätze mit konkreter Handlung (z. B. „Stoßstangen-Pulk priorisieren oder Kunden über Terminrisiko informieren") |
| Action-Buttons | 3 Stück: Hauptaktion (gefüllt) + 2 Alternativen (Outline) |

**Quelle:** Supabase Edge Function `kpi-insight` mit View-Werten als Input. Fehlerfall → „KI-Einschätzung gerade nicht verfügbar", **keine** erfundene Empfehlung.

### 4.4 Trend-Chart + Engpass-Ranking (2-Spalten)

**Links (60 %): Termintreue letzte 12 Wochen**

| Element | Inhalt |
|---|---|
| Linie 2026 | Magenta, mit Verlaufsfläche darunter |
| Linie Vorjahr | gestrichelt cream-braun, nur wenn Snapshot vorhanden |
| Ziel-Linie 90 % | gestrichelt grau |
| Letzter Punkt | hervorgehoben mit Wert |
| Footer-Zeile | Bestwoche · Tiefpunkt · Volumen-Trend YoY |

**Rechts (40 %): Engpass-Ranking**

5 Stationen sortiert nach Engpass-Score, je Zeile:

| Spalte | Inhalt |
|---|---|
| Rang | 1–5, farbcodiert (rot/amber für Top 2) |
| Station + Bar | Name + Auslastungs-Balken |
| Meta | „X % Auslastung · N wartend · Ø Y T" |
| Score | Engpass-Score 0–100 |

**Engpass-Score-Formel** (aus Recherche-Datei §13.4):
```
Score = Auslastung × 0,4 + Ø Wartezeit × 0,3 + kritische Aufträge × 0,2 + Terminrisiko × 0,1
```

### 4.5 Stationen-Arena (5 große Karten, eine Reihe)

Pro Station eine Karte mit:

| Element | Inhalt |
|---|---|
| Stationsname | Schleifen / Politur / Galvanik / Vorber. / QK-Vers. |
| Status-Pill | Kritisch / Beobachten / OK / Frei |
| Linker Rand-Streifen | 3 px in Status-Farbe |
| Wartend | große Zahl (z. B. „8") |
| Ø Wartezeit | „4,8 T" |
| Auslastung | %-Zahl + dünner Balken |
| Hauptursache | 1 Zeile Freitext (z. B. „5 große Stoßstangen mit Zusatzaufwand") |
| Link | „N Aufträge öffnen →" → `/orders?station=schleifen` |

Klick auf die ganze Karte führt in die Stationsseite. Hover hebt leicht an.

### 4.6 Verzögerte und gefährdete Aufträge (Tabelle)

Tabelle mit den 7–10 wichtigsten Aufträgen, sortiert nach Verzug:

| Spalte | Inhalt |
|---|---|
| Auftrag | Auftragsnummer (Fraunces serif) + Titel |
| Kunde | Kundenname, klickbar → `/customers/[id]` |
| Station | aktuelle Station |
| Zugesagt | Datum |
| Verzug / Status | „−3 Tage" (rot) / „heute" / „+3 T Puffer" (grün) |
| Priorität | Pill: EXPRESS / KRITISCH / GEFÄHRDET / IM PLAN |

Counter oben rechts: „3 kritisch · 4 gefährdet · 12 im Plan".

### 4.7 Wirtschaftliche Auswirkung (4 Tiles)

| Tile | Wert | Note |
|---|---|---|
| Verspätungskosten Woche | ~ 480 € | „3 Express-Zuschläge, 1 Kulanz" |
| Opportunitätskosten Engpass | ~ 1.240 € | „Schleifen-Stau bindet Folge-DB" |
| DB / Stunde aktiv | 38 € | „Ziel 45 € · −7 € vs. Ziel" |
| Auslastung gesamt | 61 % | „+4 Pkt. vs. Vw." |

Diese Werte sind **Schätzungen** (entsprechend gekennzeichnet mit „SCHÄTZUNG · KW 24"-Badge). Sie werden erst voll belastbar, wenn Buchhaltung/Mollie sauber angebunden ist.

### 4.8 „Vernetzt mit"-Sektion (4 Link-Tiles)

| Tile | Zielinhalt | Ziel-Route |
|---|---|---|
| Bäder & Material | „Nickelbad · Messung in 4 T fällig" | `/baeder/nickel-1` |
| Kontrolle | „QS-Quote: 96 % · 1 Fall offen" | `/kontrolle?filter=offen` |
| Kunden | „3 Kunden mit verzögerten Aufträgen" | `/customers?filter=verzoegert` |
| Kommunikation | „2 Freigaben offen · Ø 1,8 T Antwort" | `/kommunikation?status=offen` |

### 4.9 Datenherkunft-Zeile (Footer)

Liste der zugrundeliegenden Views mit Status-Punkt (grün = live, amber = teils synthetisch / Snapshot fehlt):

```
● v_werkstatt_puls           · 47 Aufträge · live
● v_puls_station_durchlauf   · 312 Events
● v_puls_station_stau        · 19 items · live
◐ kpi_snapshots              · Vorjahresvergleich teils synthetisch (S2)
                                                            Letztes Update: vor 12 Sek.
```

---

## 5 · Datenquellen (Views + Tabellen)

### 5.1 Pflicht-Views (alle mit Prefix `v_` — werden vom Analyse-Chat angelegt)

| View | Liefert | Basis-Tabellen |
|---|---|---|
| `v_werkstatt_puls` | Termintreue, Ø DLZ, Wochenziel, Score, Offene, Doku-Quote | `orders`, `events`, `items`, `item_photos` |
| `v_puls_station_durchlauf` | Ø Verweildauer + Auslastung je Station | `events` (STATION_EINGANG → STATION_AUSGANG) |
| `v_puls_station_stau` | aktuell wartende Items je Station | `items.current_station_id` |
| `v_puls_engpass_score` | Engpass-Score je Station (Rang) | abgeleitet aus den drei obigen |

### 5.2 Tabellen-Stand (verifiziert)

| Tabelle | Genutzte Spalten |
|---|---|
| `orders` | `id`, `customer_id`, `current_station_id`, `status`, `priority`, `created_at`, `promised_due_date`, `completed_date`, `intake_date` |
| `events` | `order_id`, `event_type`, `station`, `created_at` |
| `items` | `id`, `order_id`, `current_station_id`, `status` |
| `item_photos` | `item_id`, `photo_type` (für Dokumentationsquote) |
| `customers` | `id`, `company_name`, `first_name`, `last_name` (nur für Anzeige) |
| `complaints` | nur für Doku/Anzeige der Hauptursachen, nicht im Puls-Score |
| `kpi_snapshots` | Vorjahresvergleich (Magenta-Linie vs. cream-Linie im Trend-Chart) |

### 5.3 Kennzahlen-Formeln (verbindlich, eine Quelle)

```
Termintreue   = COUNT(completed_date <= promised_due_date)
                ÷ COUNT(promised_due_date IS NOT NULL AND completed_date IS NOT NULL)
                — Aufträge ohne Zusagetermin zählen NICHT in den Nenner

Ø DLZ         = AVG(completed_date - created_at) in Tagen

Wartezeit     = STATION_STARTED.created_at − STATION_EINGANG.created_at

Stations-Stau = COUNT(items WHERE current_station_id = X AND status != 'abgeschlossen')

Engpass-Score = Auslastung × 0,4 + Ø Wartezeit × 0,3
              + kritische Aufträge × 0,2 + Terminrisiko × 0,1

Werkstatt-Score:
  Termintreue        25 %
  Durchlaufzeit      20 %
  Kritische Aufträge 20 %
  Reklamationen      15 %
  Dokumentation/Scan 10 %
  Stationszustand    10 %
```

---

## 6 · Komponenten (zu bauen)

```
src/features/analyse/kacheln/werkstatt-puls/
  WerkstattPulsTile.tsx          ← Level 1: Hero-Kachel auf Analyseseite
  WerkstattPulsPage.tsx          ← Level 2: Themen-Seite (Route /analyse/werkstatt-puls)
  components/
    PulsHeroBlock.tsx            ← 5 KPIs + Score-Ring
    PulsTrendChart.tsx           ← Recharts AreaChart, 12 Wochen + Vorjahr
    PulsEngpassRanking.tsx       ← 5-Stationen-Ranking mit Bars
    PulsStationArena.tsx         ← 5 Stations-Karten in Reihe
    PulsOrdersTable.tsx          ← Verzögerte/gefährdete Aufträge
    PulsEconImpact.tsx           ← 4 Wirtschafts-Tiles
    PulsLinksGrid.tsx            ← „Vernetzt mit"-Tiles
    PulsKiBlock.tsx              ← KI-Empfehlung (ruft Edge Function)
  hooks/
    useWerkstattPuls.ts          ← Supabase-Hook für v_werkstatt_puls
    usePulsStationen.ts          ← Supabase-Hook für die 3 Stationen-Views
    usePulsKiInsight.ts          ← Edge-Function-Aufruf kpi-insight
```

**Wichtig:** Kein `mockData`-Import irgendwo in diesem Ordner.

---

## 7 · Akzeptanzkriterien

1. Alle KPI-Werte auf Level 1 und Level 2 stammen nachweisbar aus `v_werkstatt_puls` (DB-Wert = UI-Wert, mit SQL gegenprüfbar).
2. Stationen-Arena zeigt echte `wartend_n` aus `v_puls_station_stau` und echte Ø-Zeiten aus `v_puls_station_durchlauf`.
3. Engpass-Ranking ist konsistent mit Stationen-Arena (gleiche Werte, andere Darstellung).
4. Trend-Chart zeigt Vorjahres-Linie nur, wenn `kpi_snapshots` einen Wert für `now() − 52 weeks` liefert. Sonst wird die Linie weggelassen und im Footer steht ein Hinweis.
5. KI-Block liefert echte Antwort über Edge Function `kpi-insight`. Fehlerfall → sichtbarer Hinweis, **keine** erfundene Empfehlung.
6. Vergleichsmodus zeigt Δ-Badges nur, wenn der gewählte Vergleichszeitraum reale Daten hat.
7. Jede Zahl/Pill/Karte ist anklickbar und führt zu einer gefilterten Liste oder einem Detail-View.
8. Datenherkunft-Zeile am Fuß zeigt alle drei Views mit Live-/Snapshot-Status.
9. Leerzustand bei S0 (< 5 abgeschlossene Aufträge): „Noch keine abgeschlossenen Aufträge erfasst" + Link zu `/orders/neu`. **Kein** Platzhalter-99 %-Score.
10. Bei Plan Basis: Locked-Card mit Demo-Werten + Plan-Hinweis (nur für Rolle `inhaber` sichtbar).
11. Kein `mockData`-Import, kein `Math.random`-Aufruf, kein `any`-Cast.
12. Wirtschafts-Tiles sind als „SCHÄTZUNG"-gekennzeichnet, solange Buchhaltung/Mollie nicht voll angebunden ist.

---

## 8 · STOPP-Bedingungen

| Bedingung | Reaktion |
|---|---|
| `promised_due_date` oder `completed_date` fehlt in ≥ 50 % der abgeschlossenen Aufträge | STOPP. Datenvertrag-Spec liefern lassen, bevor Termintreue gezeigt wird. |
| `events`-Tabelle hat keine STATION_EINGANG / STATION_AUSGANG-Events | STOPP. Auftragsskelett-Spec ergänzen, dann Stationen-Arena bauen. |
| Edge Function `kpi-insight` existiert noch nicht | KI-Block ausblenden oder mit „KI-Einschätzung wird vorbereitet" zeigen. Kein Eigenbau im Frontend. |
| Antigravity will Datei umbenennen / Spalten umbenennen | STOPP. Drizzle-Mapping nutzen. |
| Antigravity will Mock einfügen, weil View leer | STOPP. Leerzustand-Komponente nutzen. |

---

## 9 · Reihenfolge des Baus

```
Schritt 1 — Datenvertrag prüfen (Parallel-Chat Auftragsskelett)
            zugesagt_am / geliefert_am / STATION_EINGANG / STATION_AUSGANG müssen existieren

Schritt 2 — Views anlegen
            v_werkstatt_puls
            v_puls_station_durchlauf
            v_puls_station_stau
            v_puls_engpass_score (optional, abgeleitet)

Schritt 3 — kpi_snapshots-Tabelle + manueller Seed für Vorjahresvergleich

Schritt 4 — Level 1: WerkstattPulsTile.tsx auf Analyseseite
            zeigt echte Werte oder Leerzustand, NIE Mock

Schritt 5 — Level 2: WerkstattPulsPage.tsx
            Header, Hero-Block, Trend-Chart, Engpass-Ranking, Stationen-Arena

Schritt 6 — Verzögerte-Aufträge-Tabelle + Wirtschafts-Tiles + Vernetzt-mit

Schritt 7 — Edge Function kpi-insight
            erst jetzt, weil sie auf die View-Werte aufsetzt

Schritt 8 — Verifizierung gegen DB
            SQL gegen Supabase, Werte = UI-Werte

Schritt 9 — Snapshot-CRON (pg_cron Mo 02:00) erst NACH Verifizierung
```

Jeder Schritt einzeln freigeben. Antigravity geht nicht eigenmächtig zum nächsten.

---

## 10 · Was die Kachel NICHT macht

- Keine Daten schreiben, ändern oder löschen
- Keine Tabellen umbenennen
- Keine Mock-/`Math.random`-Werte zeigen
- Keinen Score zeigen, der nicht aus Formel + echten Daten kommt
- Keine Gamification-Elemente, die mit Mitarbeitern verglichen werden (Mitarbeiter-Rangliste verboten)
- Keine Glitzer-/Konfetti-Animation
- Keine Score-Sprache wie „Sehr gut!" ohne Zahlenfundament
- Keine Tabellen-/Excel-Optik
- Keine roten Zahlen ohne Maßnahme + Drill-Down
- Linke Sidebar und obere Navigation nicht anfassen
