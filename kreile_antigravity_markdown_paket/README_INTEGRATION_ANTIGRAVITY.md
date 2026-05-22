# Kreile WerkstattCockpit — Integration der Markdown-Dateien in Antigravity

## Zweck

Diese Datei erklärt, wie die neuen Markdown-Dateien im Projekt abgelegt und in Antigravity/Claude Code genutzt werden sollen.

Die Dateien ersetzen nicht blind den bisherigen Stand. Sie konsolidieren die bisherigen Anforderungen, Screenshots, Prozesslogik, Rechercheergebnisse und neuen Präferenzen zu einem klaren Bauauftrag.

## Empfohlene Ablage im Projekt

Lege im Projektordner folgenden Bereich an:

```text
docs/
  antigravity/
    kreile-workshop-app/
      00_KREILE_APP_NEUSTART_MASTERPROMPT.md
      01_NAVIGATION_STARTSEITE_WERKSTATTFLUSS.md
      02_WARENEINGANG_KAMERA_OCR_AUTONOMIE.md
      03_DATENMODELL_ARCHITEKTUR_BACKEND.md
      04_WARENWIRTSCHAFT_BADREGELKARTE_VERBRAUCH.md
      05_KUNDENKARTEI_AUFTRAG_DETAIL_ZEITSTRAHL.md
      06_PERFORMANCE_GAMEDESIGN_ANALYTIK.md
      07_UMSETZUNGSPLAN_ANTIGRAVITY_TESTS.md
      README_INTEGRATION_ANTIGRAVITY.md
```

Falls es bereits einen Ordner `docs/antigravity` gibt, dort einsortieren. Keine Datei in `src/` legen, solange sie reine Bauanweisung ist.

## Reihenfolge für Antigravity

Antigravity soll die Dateien in dieser Reihenfolge lesen:

1. `00_KREILE_APP_NEUSTART_MASTERPROMPT.md`
2. `03_DATENMODELL_ARCHITEKTUR_BACKEND.md`
3. `01_NAVIGATION_STARTSEITE_WERKSTATTFLUSS.md`
4. `02_WARENEINGANG_KAMERA_OCR_AUTONOMIE.md`
5. `05_KUNDENKARTEI_AUFTRAG_DETAIL_ZEITSTRAHL.md`
6. `04_WARENWIRTSCHAFT_BADREGELKARTE_VERBRAUCH.md`
7. `06_PERFORMANCE_GAMEDESIGN_ANALYTIK.md`
8. `07_UMSETZUNGSPLAN_ANTIGRAVITY_TESTS.md`

## Kurzprompt für Antigravity

```text
Lies zuerst alle Markdown-Dateien im Ordner docs/antigravity/kreile-workshop-app. Analysiere danach den bestehenden Code der Kreile WerkstattCockpit App. Baue nicht blind neu, sondern prüfe vorhandene Seiten, Komponenten, Mockdaten, Routing, Statuslogik und Styling. Ziel ist eine aufgeräumte, tablet-taugliche Werkstatt-App mit Startseite, horizontalem Werkstattfluss, intelligentem Wareneingang mit Kamera/OCR, Kundenakte mit Zeitstrahl, Warenwirtschaft, Badregelkarte, Verbrauchsbuchung und gamifizierter Performance-Analyse. Kritische Zustände müssen farblich direkt an Stationsbuttons, Tagesbutton und Karten sichtbar sein. Implementiere iterativ, erst mit Mockdaten und Backend-Abstraktion, dann backendfähig. Gib vor jedem größeren Umbau die betroffenen Dateien aus und teste nach jedem Schritt.
```

## Umsetzung in sinnvollen Blöcken

### Block 1 — Struktur und Navigation

- Startseite nach Login erstellen.
- Horizontalen Werkstattfluss oben einbauen.
- Linke Sidebar verschlanken.
- „Kontrolle & Archiv“ konsolidieren.
- Aktiven Bereich sichtbar machen.
- Stationen farblich anhand Statusdaten einfärben.

### Block 2 — Daten- und Statusfundament

- Typen/Mockdaten erweitern.
- Zentrale Statuslogik definieren.
- Data Provider Layer einbauen: `mock` jetzt, `backend` später.
- Keine UI-Komponente soll eigene Farblogik enthalten.

### Block 3 — Wareneingang

- Wareneingang auf zwei Hauptbuttons reduzieren: Kamera und Manuell.
- Kamera-Assistent mit Demo-OCR und Demo-Teilezählung bauen.
- Review-Screen für erkannte Daten.
- Auftrag, Kunde, Teile, Fotos und Dokumente verknüpfen.

### Block 4 — Kundenakte und Auftragdetail

- Kundenprofil mit Zeitstrahl.
- Auftragsdetail mit Material-/Zeitbuchung.
- Slider/Stepper für Arbeitszeit und Verbrauchseinheiten.
- Button „Verbrauch hinzufügen“.

### Block 5 — Warenwirtschaft und Badregelkarte

- Bestand, Lagerorte, Bewegungen, Mindestbestand.
- Badkarte mit Messwerten, Grenzwerten, Zustand und Dosierungen.
- Verknüpfung mit Verbrauch und Auftrag.

### Block 6 — Performance und Haptik

- Performance als motivierendes, aber sinnvolles Cockpit.
- Klare grün/gelb/orange/rot-Visualisierung.
- Deutlich sehen, was gut und was schlecht läuft.
- Keine Tabellenoptik, keine Legendenwüste.

## Prüfbefehl an Antigravity nach jedem Block

```text
Prüfe jetzt: App startet fehlerfrei, Navigation funktioniert, keine toten Buttons, aktive Route ist sichtbar, kritische Stationen färben sich ein, Mockdaten werden konsistent angezeigt. Liste alle geänderten Dateien auf und nenne, was als nächstes umgesetzt werden sollte.
```

## Wichtigste Akzeptanzkriterien

- Beim Öffnen erscheint eine saubere Startseite mit Logo, Begrüßung und Tagesdruck.
- Der Werkstattfluss ist oben über die volle Breite sichtbar.
- Stationen ändern ihre Farbe, wenn dort ein Problem liegt.
- Wareneingang hat zuerst nur zwei zentrale Optionen: Kamera und Manuell.
- Die App führt den Nutzer nach dem Scan selbstständig weiter.
- Kundenakte ist ein echtes Werkstattgedächtnis mit Zeitstrahl.
- Auftragdetail erlaubt Material- und Arbeitszeitbuchung.
- Warenwirtschaft und Badregelkarte sind fachlich plausibel angebunden.
- Performance wirkt motivierend und visuell stärker, bleibt aber operativ sinnvoll.
- Keine Seite wirkt wie Excel, Baukasten oder überfülltes ERP.
