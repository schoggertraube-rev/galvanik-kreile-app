# Kreile WerkstattCockpit — Konkreter Umsetzungsplan für Antigravity

## Ziel

Dieses Dokument ist eine direkte Arbeitsanweisung an Antigravity/Claude Code zur schrittweisen Umsetzung der App-Verbesserungen.

---

## Arbeitsregel

Arbeite iterativ. Bestehende Funktionen nicht löschen, sondern verbessern.

Vor jeder größeren Änderung:

1. aktuelle Struktur prüfen,
2. betroffene Dateien nennen,
3. kleine Änderung umsetzen,
4. App starten/testen,
5. visuelles Ergebnis prüfen.

---

## Schritt 1: Projekt analysieren

Prüfe:

- Routing
- vorhandene Seiten
- Komponentenstruktur
- Styling-System
- Mockdaten
- Statuslogik
- Performance-Seite
- Verzug-&-Engpässe-Seite
- Heatmap-Komponente
- Navigation

Ziel: Verstehen, was bereits vorhanden ist.

---

## Schritt 2: Zentrale Statuslogik erstellen

Erstelle oder überarbeite zentrale Dateien:

```text
src/constants/status.ts
src/constants/stations.ts
src/lib/priority.ts
src/lib/performance.ts
src/lib/nextAction.ts
```

Diese Dateien sollen definieren:

- Statusnamen
- Farben
- Icons
- Prioritätsberechnung
- Stationsauslastung
- nächste Aktion
- Performance-Kennzahlen

Keine Farblogik verstreut in einzelnen Komponenten.

---

## Schritt 3: Designsystem konsolidieren

Erstelle/überarbeite Komponenten:

```text
src/components/status/StatusBadge.tsx
src/components/status/PriorityIndicator.tsx
src/components/cards/PriorityOrderCard.tsx
src/components/heatmap/StationHeatmap.tsx
src/components/performance/PerformanceKpiCard.tsx
src/components/layout/AppSidebar.tsx
src/components/layout/AppHeader.tsx
```

Ziel:

- einheitliche Karten,
- einheitliche Statusfarben,
- einheitliche Warnsymbole,
- bessere Lesbarkeit,
- tablet-taugliche Größen.

---

## Schritt 4: Seite „Heute“ verbessern

### Ziel

„Heute“ wird zur zentralen operativen Prioritätsansicht.

### Anforderungen

- Überschrift: „Kommende Arbeiten“
- Untertitel: „Die nächsten Aufträge im Überblick“
- Prioritätsbalken oben
- Karten nach Dringlichkeit sortiert
- rote Fälle deutlich größer/stärker
- grüne Fälle ruhiger
- rechte Spalte mit Produktionsstatus und kurzer Zusammenfassung

### Karte je Auftrag

Muss zeigen:

- Statussymbol
- Auftragsnummer
- Arbeit
- Kunde
- aktuelle Station
- Frist
- Statuslabel
- nächste Aktion

### Wichtig

Keine überflüssigen Texte. Fokus auf schnelles Erkennen.

---

## Schritt 5: Seite „Aufträge“ verbessern

### Ziel

Auftragsbuch mit Detailpanel.

### Anforderungen

- Liste links/mittig
- Detailpanel rechts
- Filterchips oben
- Suchfeld
- Statusränder
- Friststatus größer
- Detailpanel mit:
  - Teile
  - StatusEvents
  - Fotos
  - offene Blocker
  - nächste Aktion
  - interne Notizen

---

## Schritt 6: Seite „Kunden“ verbessern

### Ziel

Kundenakte als Werkstattgedächtnis.

### Anforderungen

Bei Klick auf Kunde rechts anzeigen:

- Stammdaten
- offene Aufträge
- abgeschlossene Aufträge
- Preisabsprachen
- Reklamationen
- wiederkehrende Teile
- Fotos
- Notizen
- Kommunikationshistorie

Die bestehende Liste links kann bleiben, aber die rechte Detailfläche soll wertvoller werden.

---

## Schritt 7: Seite „Scan (OCR)“ als Wareneingangsassistent

### Ziel

Nicht nur Scan-Seite, sondern geführter Prozess.

### Ablauf

1. Scan/Foto aufnehmen
2. OCR-Ergebnis anzeigen
3. Kunde/Auftrag zuordnen
4. Teile bestätigen
5. Fotos ergänzen
6. Etikett/QR erzeugen

### Demo reicht zunächst

Wenn echte Kamera/OCR noch nicht möglich:

- simulierten Scan anbieten,
- Beispiel-OCR-Daten erzeugen,
- bearbeitbare Felder anzeigen.

---

## Schritt 8: Seite „Verzug & Engpässe“ verbessern

### Ziel

Operative Problemseite.

### Anforderungen

Oben Kennzahlen:

- Kritischer Verzug
- Gefährdete Aufträge
- Wartet auf Freigabe
- Materialmangel

Mitte:

- Problemkarten mit konkretem Grund

Rechts:

- Stations-Engpass-Heatmap
- wartende Teile
- Maßnahmenvorschläge

### Problemkarte

Jede Karte zeigt:

- Auftrag
- Kunde
- Problem
- Station
- überfällig seit / Restzeit
- empfohlene Maßnahme
- Button „Maßnahme einleiten“

---

## Schritt 9: Seite „Performance“ ausbauen

### Ziel

Analyse- und Optimierungsseite mit professioneller Wirkung.

### Anforderungen oben

KPI-Karten:

- Termintreue
- Ø Durchlaufzeit
- Fertig diese Woche
- Offene Aufträge
- Kritische Aufträge
- Reklamationsquote

### Anforderungen Mitte

- Performance Score
- Trend dieser Woche
- Aufträge nach Bereich
- Wochenziel
- Erfolgsserie nur dezent

### Anforderungen rechts

- Insights & Empfehlungen
- Stations-Heatmap
- stärkster Engpass
- Klick auf Empfehlung führt zu betroffenen Aufträgen

### Heatmap

Die Heatmap aus „Verzug & Engpässe“ zusätzlich in Performance verwenden, aber analytisch:

- Wochen-/Monatsauslastung
- wiederkehrende Engpässe
- Durchlaufzeit je Station
- kritische Aufträge je Station

---

## Schritt 10: Mockdaten verbessern

Erzeuge realistische Daten.

### Kunden

- Museum Lenzburg
- Atelier Schmid
- Kirche St. Martin
- Privatkunde Lenz
- Antik Galerie Main

### Aufträge

- A-2026-0042 — Stoßstangen vernickeln
- A-2026-0038 — Motorradteile BMW R75 verchromen
- A-2026-0040 — Besteckteile versilbern
- A-2026-0035 — Jugendstilleuchter brünieren
- A-2026-0030 — Möbelbeschläge vergolden

### Zustände

Mindestens enthalten:

- ein kritischer Auftrag
- ein leicht kritischer Auftrag
- ein Auftrag im Plan
- ein Auftrag wartet auf Freigabe
- ein Auftrag wartet auf Material
- ein Nacharbeitsfall
- mehrere Teile pro Auftrag
- verschiedene Stationen
- verschiedene Fristen

---

## Schritt 11: Details und Drawer

Bei Klick auf Auftrag oder Teil soll ein Detailbereich öffnen.

### Auftrag-Detail

- Kundendaten
- Teileliste
- Fotos
- StatusEvents
- Stationen
- offene Blocker
- nächste Aktion
- Notizen
- Buttons

### Buttons

- Station starten
- Station abschließen
- Foto ergänzen
- Kunde kontaktieren
- Freigabe erhalten
- Material erhalten
- Nacharbeit starten
- Versand vorbereiten

---

## Schritt 12: Visuelle Feinarbeit

### Muss

- kritische Elemente stärker,
- grüne Elemente ruhiger,
- Abstände sauber,
- Karten konsistent,
- Typografie klar,
- Status nicht nur als Text,
- keine überflüssigen Legenden,
- keine überladenen Flächen.

### Darf

- Progress-Ringe,
- sanfte Animationen,
- Hover-Zustände,
- farbige linke Kartenränder,
- große Warnsymbole,
- Score/Level dezent in Performance.

### Nicht machen

- Bling-Bling,
- Gold/Kitsch,
- zu viele kleine Labels,
- Tabellenoptik,
- Excel-Anmutung,
- alles gleichzeitig anzeigen.

---

## Schritt 13: Tests

Prüfe nach Umsetzung:

1. Ist die App ohne Fehler startbar?
2. Funktioniert Navigation?
3. Sind kritische Aufträge sofort sichtbar?
4. Ist die Heatmap in Verzug & Engpässe sichtbar?
5. Ist die Heatmap zusätzlich in Performance sichtbar?
6. Sind Karten sortiert nach Dringlichkeit?
7. Funktionieren Filter?
8. Öffnet Detailansicht?
9. Sind Mockdaten realistisch?
10. Ist die App auf Tabletbreite gut nutzbar?

---

## Akzeptanzkriterien

Die Umsetzung ist gut, wenn:

- rote Probleme sofort auffallen,
- man nicht lange lesen muss,
- die App professionell wirkt,
- bestehende Struktur erhalten bleibt,
- Heatmap sinnvoll integriert ist,
- Performance nicht überladen wirkt,
- operative Maßnahmen sichtbar sind,
- Wareneingang logisch geführt wird,
- Kundenakte echten Nutzen bietet,
- Prozessdaten später auswertbar sind.

---

## Kurzprompt für direkte Ausführung

```text
Analysiere die bestehende Kreile WerkstattCockpit App. Erhalte die vorhandene Grundstruktur und zerstöre keine funktionierenden Seiten. Verbessere die App gemäß den Markdown-Dateien: zentrale Statuslogik, stärkeres UI/UX-Design, problemorientierte Tagesansicht, operative Verzug-&-Engpass-Seite, Performance-Seite mit zusätzlicher Stations-Heatmap, Kundenakte, OCR-Wareneingangsassistent und realistische Mockdaten. Kritische rote Zustände müssen sofort sichtbar sein und immer eine konkrete nächste Handlung haben. Arbeite modular, tablet-first und mit zentral definierten Farben/Statuswerten.
```
