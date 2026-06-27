# Modularitätsstrategie

Stand: 2026-06-27

## Ziel

Die Kreile-App bleibt das Referenzprodukt und wird zuerst stabil und verkaufsfähig. Gleichzeitig werden neue und geänderte Funktionen so gebaut, dass klar abgegrenzte Teile später in andere Apps übernommen werden können.

## Laufende Regeln

- Modulgrenzen über TypeScript-Typen, Props, SQL-Views sowie Provider-/Port-Schnittstellen.
- Keine Tiefimporte in interne Ordner anderer Module.
- Kreile-spezifische Begriffe, Rollen, Tenant-Werte, Tabellen und UI-Texte bleiben außerhalb wiederverwendbarer Kerne.
- Jede fachliche Wahrheit hat genau eine kanonische Instanz.
- Schnittkanten werden dokumentiert, sobald ein Modul stabil genug ist.
- Während kritischer Auth-, Offline- und Capture-Arbeit werden keine Pakete vorschnell herausgelöst.

## Erstes Zielmodul: ledger-core

Die bestehende Buchhaltungs-/OCR-Struktur soll später als `ledger-core` auch von anderen Apps genutzt werden können.

### `LEDGER-CORE-PREP-001`

Reine Analyse ohne Verschieben, Umbenennen oder Importänderungen:

- Inventar der Buchhaltungs-, OCR- und Provider-Dateien,
- Cross-Imports und Kopplungen,
- direkte Supabase-/SQL-Zugriffe,
- Kandidaten für gemeinsame Typen,
- empfohlene Modulgrenze,
- Liste der vor einer Extraktion zu entkoppelnden Stellen.

### `LEDGER-CORE-EXTRACT-001`

Erst nach stabiler Kreile-Buchhaltung und belegter End-to-End-Nutzung:

- genau eine kontrollierte Extraktion,
- Kreile-App bleibt Referenzkonsument,
- weitere Apps nutzen denselben Kern über definierte Adapter,
- Erfahrungen aus Folgekonsumenten fließen kontrolliert über Verträge zurück.

## Zeitpunkt

`LEDGER-CORE-PREP-001` wird nach Stabilisierung der aktuellen P0-Themen und sobald die Buchhaltungsstruktur nicht mehr grundlegend driftet eingeplant. Die eigentliche Extraktion erfolgt erst nach produktiver Stabilität.
