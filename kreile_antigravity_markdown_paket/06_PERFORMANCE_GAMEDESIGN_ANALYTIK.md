# Kreile WerkstattCockpit — Performance, Gamedesign und Prozessanalytik

## Ziel

Die Performance-Seite soll motivieren und gleichzeitig Prozessprobleme sichtbar machen.

Sie darf stärker nach Gamedesign aussehen als bisher, aber nicht albern werden. Es geht um produktive Motivation, nicht um Dekoration.

## Aktueller Stand

Die vorhandene Performance-Seite wirkt bereits professioneller als viele Standard-Dashboards:

- KPI-Karten,
- Heatmap,
- Wochenziel,
- Trends,
- klare Farben.

Verbesserung nötig:

- mehr visuelle Wucht bei gut/schlecht,
- weniger kleinteilige Tabellenanmutung,
- stärkere Gamification,
- mehr operative Ableitung,
- mehr Verbindung zu Stationen und Ursachen.

## Grundsatz

Performance beantwortet drei Fragen:

1. Läuft die Werkstatt heute/ diese Woche gut?
2. Wo entsteht Reibung?
3. Was sollte verbessert werden?

## Layout

```text
Performance
├── Hero Score Bereich
├── Ampel-KPI-Karten
├── Stationen-Arena / Heatmap
├── Wochenziel / Fortschritt
├── Engpass- und Qualitätsanalyse
├── Empfehlungen
└── Trends nach Auftragstyp
```

## Hero Score

Oben ein großer Scorebereich.

Beispiel:

```text
Werkstatt-Score
82 / 100
Stabile Woche · Schleiferei bleibt Engpass

[████████░░] 82 %
```

Der Score ist nicht nur Deko. Er basiert auf:

- Termintreue,
- kritischen Aufträgen,
- Durchlaufzeit,
- Reklamationen,
- Scanquote,
- Dokumentationsquote,
- Bad-/Lagerstatus.

## Score-Logik

```ts
type PerformanceScoreInput = {
  onTimeRate: number;
  avgCycleTimeIndex: number;
  criticalOrders: number;
  complaintRate: number;
  scanRate: number;
  documentationRate: number;
  stationHealthIndex: number;
};
```

Beispielgewichtung:

```text
Termintreue: 25 %
Durchlaufzeit: 20 %
Kritische Aufträge: 20 %
Reklamationen: 15 %
Dokumentation/Scan: 10 %
Stationszustand: 10 %
```

Wichtig: Score darf später angepasst werden.

## Gamedesign-Elemente

Erlaubt:

- Fortschrittsbalken,
- Ringe,
- Score-Karten,
- Streaks,
- Wochenziel,
- Stationen als „Arena“-Karten,
- kleine Badges,
- sanfte Animationen,
- klare Grün-Rot-Verläufe.

Nicht erlaubt:

- Glitzer,
- Kitsch,
- Spielzeugoptik,
- unklare Punkte,
- Ranglisten, die Mitarbeiter gegeneinander ausspielen,
- Animationen, die Arbeit stören.

## KPI-Karten

Pflicht-KPIs:

- Termintreue,
- Ø Durchlaufzeit,
- offene Aufträge,
- kritische Aufträge,
- fertig diese Woche,
- Reklamationsquote,
- Scan-/OCR-Quote,
- Dokumentationsquote,
- Lagerkritikalität,
- Badstabilität.

### KPI-Karte Beispiel

```text
Termintreue
82 %
Ziel: 90 %
Trend: +4 % zur Vorwoche
Nächste Verbesserung: Freigaben früher klären
```

## Farbwirkung

### Gute Werte

- satt, aber nicht grell grün,
- Fortschritt groß,
- positive Karte ruhig.

### Schlechte Werte

- rot/orange klar sichtbar,
- größerer Rand,
- Handlungshinweis.

Beispiel:

```text
Kritische Aufträge
3
+1 zu gestern
Maßnahme: Schleiferei priorisieren
```

## Stationen-Arena / Heatmap

Die Heatmap soll plastischer werden.

Stationen als große Karten:

```text
Schleiferei
Status: Kritisch
Auslastung: 94 %
Wartend: 8 Teile
Ø Wartezeit: 2.1 Tage
Hauptursache: Stoßstangen & Zierleisten

[Betroffene Aufträge öffnen]
```

## Performance-Verknüpfung mit Werkstattfluss

Klick auf eine Station in Performance:

- filtert Auftragsbuch nach Station,
- zeigt Engpassursachen,
- zeigt offene Maßnahmen,
- zeigt Vergleich zur Vorwoche.

## Wochenziel

Beispiel:

```text
Wochenziel
23 / 25 fertiggestellte Objekte
Noch 2 bis zum Ziel
```

### Streaks

```text
5 Wochen über Ziel
```

Streaks bleiben dezent und beziehen sich auf sinnvolle Kennzahlen:

- Wochenziel erreicht,
- keine Reklamation,
- Scanquote über Ziel,
- Badmessungen pünktlich,
- keine überfälligen Freigaben.

## Insights & Empfehlungen

Jede Empfehlung braucht:

- Beobachtung,
- Ursache,
- Handlung.

Beispiele:

```text
Schleiferei ist seit 3 Tagen Hauptengpass.
Ursache: 5 große Oldtimerteile mit Zusatzaufwand.
Vorschlag: Stoßstangen priorisieren oder Kunden über Terminrisiko informieren.
```

```text
Scanquote liegt bei 62 %.
Ursache: Wareneingang manuell erfasst.
Vorschlag: Kamera-Scan als Standardaktion markieren.
```

```text
Nickelbad 1 ist stabil, aber Analyse morgen fällig.
Vorschlag: Messung vor Vormittagscharge einplanen.
```

## Bad- und Lagerstatus in Performance

Neu einbauen:

### Lagerstatus

- kritische Artikel,
- Bestand unter Mindestbestand,
- Verbrauch pro Woche,
- Top-Verbrauchsmaterialien.

### Badstatus

- stabile Bäder,
- Bäder in Beobachtung,
- überfällige Messungen,
- gesperrte Bäder,
- Reklamationsnähe.

## Drilldown

Jede Zahl muss anklickbar oder filterbar sein.

Beispiele:

- Klick auf „kritische Aufträge“ → Liste kritischer Aufträge.
- Klick auf „Schleiferei kritisch“ → Stationsseite Schleiferei.
- Klick auf „Reklamationsquote“ → Nacharbeitsfälle.
- Klick auf „Lagerkritisch“ → Lagerartikel unter Mindestbestand.
- Klick auf „Badmessung fällig“ → Badregelkarte.

## Komponenten

```text
src/components/performance/PerformanceHeroScore.tsx
src/components/performance/PerformanceKpiGrid.tsx
src/components/performance/PerformanceKpiCard.tsx
src/components/performance/StationArenaHeatmap.tsx
src/components/performance/WeeklyGoalCard.tsx
src/components/performance/StreakCard.tsx
src/components/performance/PerformanceInsights.tsx
src/components/performance/InventoryPerformancePanel.tsx
src/components/performance/BathPerformancePanel.tsx
src/lib/performance/score.ts
src/lib/performance/insights.ts
src/lib/performance/trends.ts
```

## Akzeptanzkriterien

- Performance wirkt stärker, plastischer und motivierender.
- Gute und schlechte Zustände sind auf einen Blick sichtbar.
- Score ist nachvollziehbar und nicht bloß Dekoration.
- Jede schlechte Kennzahl hat eine konkrete Empfehlung.
- Heatmap ist größer und weniger tabellarisch.
- Lager und Badzustand fließen ein.
- Klicks führen zu betroffenen Aufträgen/Stationen.
