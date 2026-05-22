# Kreile WerkstattCockpit — Umsetzungsplan, Tests und Antigravity-Arbeitsweise

## Ziel

Diese Datei gibt Antigravity eine klare Reihenfolge. Die App soll iterativ verbessert werden, ohne funktionierende Teile unnötig zu zerstören.

## Arbeitsregel

Vor jedem größeren Umbau:

1. bestehende Struktur analysieren,
2. betroffene Dateien nennen,
3. kleine Änderung umsetzen,
4. App starten,
5. sichtbares Ergebnis prüfen,
6. keine toten Buttons hinterlassen.

## Phase 0 — Bestandsaufnahme

Antigravity soll zuerst prüfen:

- Framework,
- Routing,
- aktuelle Seiten,
- Komponenten,
- Statuslogik,
- Mockdaten,
- Styling,
- Sidebar,
- Performance-Seite,
- Stationseiten,
- Button-Funktionen.

Ausgabe:

```text
Gefundene Seiten:
Gefundene Komponenten:
Gefundene Mockdaten:
Gefundene toten Buttons:
Risiken:
Nächster sicherer Schritt:
```

## Phase 1 — App Shell und Navigation

### Ziel

Startseite, Top-Werkstattfluss und kompakte Sidebar.

### Aufgaben

- Startseite nach Login erstellen.
- TopWorkflowBar einbauen.
- StationStatusButton bauen.
- TodayStatusButton bauen.
- Sidebar verschlanken.
- Kontrolle & Archiv als Untermenü konsolidieren.
- aktive Route sichtbar machen.

### Prüfen

- App startet.
- Navigation funktioniert.
- Stationen sind oben sichtbar.
- Sidebar ist nicht doppelt.
- Aktive Seite ist sichtbar.

## Phase 2 — Datenmodell und MockProvider

### Ziel

Zentrale Datenstruktur und Provider-Layer.

### Aufgaben

- Typen erweitern.
- MockProvider einbauen.
- Statuslogik zentralisieren.
- StationHealth berechnen.
- TodaySummary berechnen.
- Alle UI-Seiten aus Provider lesen lassen.

### Dateien

```text
src/types/workshop.ts
src/data/WorkshopDataProvider.ts
src/data/mock/mockData.ts
src/data/mock/mockProvider.ts
src/lib/status/statusColors.ts
src/lib/status/stationHealth.ts
src/lib/priority/priority.ts
src/lib/today/todaySummary.ts
```

## Phase 3 — Wareneingang Kamera-first

### Ziel

Wareneingang mit genau zwei Hauptbuttons.

### Aufgaben

- IntakeEntry bauen.
- Camera-Button und Manual-Button.
- Demo-OCR-Flow.
- OCRReviewPanel.
- CustomerMatchPanel.
- SuggestedItemsPanel.
- Abschluss erzeugt Auftrag aus Scan.

### Prüfen

- Kamera-Button hat Funktion.
- Manuell-Button hat Funktion.
- Demo-Scan erzeugt Daten.
- Nutzer kann korrigieren.
- Auftrag erscheint danach im Workflow.

## Phase 4 — Auftragdetail und Kundenakte

### Ziel

Echte Steuerung statt passiver Anzeige.

### Aufgaben

- OrderDetailPanel erweitern.
- ActionGrid mit funktionsfähigen Buttons.
- Verbrauch hinzufügen Drawer.
- WorkTimeSlider.
- CustomerProfile.
- CustomerTimeline.
- SimilarOrdersPanel.

### Prüfen

- Klick auf Auftrag öffnet Detail.
- Verbrauch kann gebucht werden.
- Zeit kann gebucht werden.
- Kundenprofil zeigt Zeitstrahl.
- Ähnliche Aufträge werden mit Mockdaten angezeigt.

## Phase 5 — Warenwirtschaft und Badregelkarte

### Ziel

Lager und Bäder als echte Fachmodule.

### Aufgaben

- InventoryDashboard.
- StockMovementDrawer.
- Mindestbestandswarnung.
- BathDashboard.
- BathDetailPanel.
- BathMeasurementForm.
- Badstatus berechnen.
- Stationbuttons mit Lager-/Badstatus verknüpfen.

### Prüfen

- Bestand kann verändert werden.
- Bewegung wird protokolliert.
- Badmessung kann eingetragen werden.
- Kritische Werte färben relevante Station.

## Phase 6 — Performance Gamification

### Ziel

Performance wird optisch stärker und fachlich tiefer.

### Aufgaben

- PerformanceHeroScore.
- KPI Grid erweitern.
- StationArenaHeatmap.
- WeeklyGoalCard.
- Insights.
- Lager- und Badperformance einbauen.
- Klickfilter in betroffene Listen.

### Prüfen

- Kritisch/schlecht ist sofort sichtbar.
- Gut läuft sichtbar motivierend, aber nicht kitschig.
- Empfehlungen sind konkret.
- Heatmap ist klickbar.

## Phase 7 — Funktionsprüfung und Aufräumen

### Aufgaben

- Tote Buttons entfernen oder funktional machen.
- Dopplungen konsolidieren.
- Leere States formulieren.
- Responsive Tablet prüfen.
- Fehler in Konsole beheben.
- Design vereinheitlichen.

## Konkrete Antigravity-Prompts

### Prompt 1 — Analyse

```text
Analysiere die bestehende Kreile WerkstattCockpit App. Prüfe Framework, Routing, Seiten, Komponenten, Mockdaten, Statuslogik, Sidebar, Header und Buttons. Verändere noch nichts. Gib eine strukturierte Übersicht aus: was existiert, was funktioniert, was tot ist, was doppelt ist, welche Dateien betroffen wären.
```

### Prompt 2 — App Shell

```text
Baue auf Basis der bestehenden Struktur eine neue App Shell: Startseite nach Login, horizontaler Werkstattfluss über volle Breite, statusfähige Stationsbuttons, Today-Button neben dem Werkstattfluss und kompakte Sidebar. Entferne keine Funktion ohne Ersatz. Nutze Mockdaten zur Einfärbung der Stationsbuttons. Teste Navigation und liste alle geänderten Dateien.
```

### Prompt 3 — Datenprovider

```text
Erstelle einen zentralen Data Provider Layer für die Werkstatt-App. UI-Komponenten sollen nicht mehr direkt aus verstreuten Mockdaten lesen. Definiere Typen für Customer, Order, Item, Station, StatusEvent, OCRScan, Attachment, InventoryItem, StockMovement, ConsumableUse, WorkTimeLog, Bath und BathMeasurement. Erstelle MockProvider mit realistischen Daten.
```

### Prompt 4 — Wareneingang

```text
Überarbeite Wareneingang komplett kamera-first. Auf der ersten Ebene dürfen nur zwei große Hauptbuttons sichtbar sein: Kamera und Manuell. Kamera öffnet einen geführten Demo-OCR-Flow mit Dokumenterkennung, Kundenvorschlag, Teilevorschlag, Review und Auftragserstellung. Manuell öffnet einen kurzen Wizard. Baue alle Buttons funktional.
```

### Prompt 5 — Kundenakte und Auftragdetail

```text
Erweitere Auftragdetail und Kundenkartei. Beim Klick auf einen Auftrag soll ein Detailpanel mit Status, Teilen, Fotos, Events, nächster Aktion, Verbrauch hinzufügen, Arbeitszeit buchen und Kundenkontakt erscheinen. Die Kundenkartei soll ein Profil mit Zeitstrahl, Preisabsprachen, Reklamationen, wiederkehrenden Teilen und ähnlichen Aufträgen zeigen.
```

### Prompt 6 — Lager und Badregelkarte

```text
Erstelle die Basis für Warenwirtschaft und Badregelkarte. Lagerartikel, Lagerorte, Bestandsbewegungen, Mindestbestände, Verbrauchsbuchung, Bäder, Badmessungen, Grenzwerte, Badstatus und Dosierungen sollen als Mockdaten und UI-Komponenten vorhanden sein. Kritische Lager- oder Badzustände müssen die passenden Stationsbuttons färben.
```

### Prompt 7 — Performance

```text
Baue die Performance-Seite stärker und motivierender: großer Werkstatt-Score, KPI-Karten, Stationen-Arena/Heatmap, Wochenziel, Streaks, Lagerstatus, Badstatus und konkrete Empfehlungen. Keine Tabellenoptik, keine überflüssigen Legenden. Jede rote/orange Kennzahl braucht eine Handlungsempfehlung und Klickpfad zu betroffenen Aufträgen.
```

## Testliste

Nach jedem Block:

```text
npm run lint
npm run build
npm run dev
```

Falls Tests vorhanden:

```text
npm test
```

Manuell prüfen:

- Startseite öffnet.
- Suche bleibt sichtbar.
- TopWorkflowBar funktioniert.
- Sidebar funktioniert.
- Wareneingang Kamera klickbar.
- Manuelle Eingabe klickbar.
- Auftragdetail öffnet.
- Verbrauch hinzufügen funktioniert.
- Kundenprofil öffnet.
- Performance lädt.
- Keine Konsolenfehler.
- Keine leeren Detailpanels ohne Hinweis.
- Tabletbreite wirkt gut.

## Definition of Done

Eine Phase ist fertig, wenn:

- sie sichtbar funktioniert,
- keine toten Buttons enthält,
- mockdatenfähig ist,
- keine TypeScript-/Buildfehler erzeugt,
- auf Tabletbreite bedienbar ist,
- Statusfarben zentral kommen,
- Detailinformationen erst nach Klick erscheinen,
- rote/orange Zustände eine Handlung haben.
