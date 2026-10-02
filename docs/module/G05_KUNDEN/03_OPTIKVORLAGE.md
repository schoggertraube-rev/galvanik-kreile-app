<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G05 Kunden — UI-Referenz

## Referenzhierarchie

1. D-UI-V5-003 macht V5 zum alleinigen Grundsystem-Ziel und ergänzt die Anschriftspflicht vor Versand/Rechnung sowie bestehende Kundensuche/-auswahl.
2. `KREILE_GESAMTMOCK_V5_2026-09-14.html` bestimmt Shell, Dichte, globalen Anlageweg und Listenprinzip.
3. `KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html` bestimmt Informationsarchitektur und Werkstattgedächtnis der Kundenkarte.
4. MODULKARTE entfernt aus der Kundenkarte: Analyse/Marketing, LTV/Marge, Risikowert und automatische Mails; Auftragsdaten bleiben Port-Projektionen.
5. OE-2609-03 ersetzt Mock-Farben und Mock-Komponenten nach Designphase 1 durch das freigegebene `kr-`-Designsystem und ersetzt vorgespielte Funktionen durch „In Aufbau“/„In Klärung“.

## Referenzdateien

- Grundsystem: `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`, SHA-256 `75258FF3BD4C`, Anker Kundenliste, Kundenanlage, Kundenauswahl.
- Kundenkarte: `02_app/docs/project/linie/ui/KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html`, SHA-256 `8B655B19B5DB`, Anker Kopf/Kontakt, nächster Schritt, aktive Aufträge, Hinweise/Telefonnotizen, Eigenheiten/Vereinbarungen, Verlauf, Fotos/Dokumente.
- Referenzzeiger: `02_app/docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json`, SHA-256 `CDB573268ABB`.
- Produktgrenze: `02_app/docs/project/linie/MODULKARTE_KANON.md`, SHA-256 `68FCCB2AB17E`, Abschnitt `CUSTOMERS`.

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| Kundenliste `/customers` | V5-Shell mit Suche, Filter, Ergebnisliste und Anlageweg; reale App-Oberfläche vorhanden | fehlt → Designphase 1 | fehlt → Designphase 1 | Daten, lädt, leer, Fehler, gesperrt und Konflikt im Code; „In Aufbau“/„In Klärung“ als Querschnittsvorgabe | Gesamtmock V5 „Kunden“; `CustomersAppAdapter.tsx` |
| Kundenkarte `/customers/[id]` | Eigenständige Kundenkarten-Referenz plus reale V2-Ansicht vorhanden | fehlt → Designphase 1 | fehlt → Designphase 1 | Laden, Daten, Teil-Leerstände, nicht gefunden, gesperrt, Konflikt, Fehler im Code | Kundenkarten-Mock Kopf bis Verlauf; `CustomerCardView.tsx` |
| Globaler Anlageweg „Kunde“ | V5-Dialog/Pane mit Bestandskundensuche und Stammdaten; reale Receipt-Strecke vorhanden | fehlt → Designphase 1 | fehlt → Designphase 1 | Eingang, Validierung, Speichern, Receipt/Readback, unbekannter Ausgang im Code; Dublette fehlt | Gesamtmock V5 „Neuer Kunde“; `GlobalCreateFlow.tsx` |
| Kundenstammdaten bearbeiten | Informationsarchitektur der Karte vorhanden, aber kein freigegebener sicherer Schreibdialog | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Q-G05-002 | Kundenkarten-Mock; D-RES-001 |
| Dublettenwarnung | Legacy-Komponente vorhanden, aber ohne reale Entscheidung und daher keine UI-Referenz | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Q-G05-001 | RT-10; `DuplicateWarning` nur Bestand |
| Telefonnotiz aus Intake/Kundenkarte | Mock-Struktur vorhanden; Produktweg ist nicht angeschlossen | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Q-G05-003 | Entscheidungsregister #9; Kundenkarten-Mock „Notizen & Telefonnotizen“ |
| Fotos/Dokumente | Abschnitt in Kundenkarte, kein freigegebener Speicherweg | fehlt → Designphase 1 | fehlt → Designphase 1 | „In Klärung“ | Kundenkarten-Mock „Fotos/Dokumente“; Q-G05-007 |
| Aufbewahrungsvorschläge | keine freigegebene UI | fehlt → Designphase 1 | fehlt → Designphase 1 | „In Klärung“ | OE-2609-20; Q-G05-006 |

## Verbindliche Layout- und Inhaltsregeln

- Desktop ist arbeitsdicht und scanbar; Tablet/Handy werden nicht aus dem Desktop-Mock geraten, sondern in Designphase 1 definiert.
- Die Kundenkarte priorisiert Kopf/Kontakt, nächsten aktiven Auftrag, aktive Aufträge und interne Hinweise. Historie und weitere Bereiche folgen darunter.
- Auftragskarten zeigen nur reale portbasierte Zusammenfassungen und verlinken in das zuständige Modul.
- Nicht belegte Kontaktdaten verwenden `Nicht hinterlegt`; leere Bereiche nutzen die Texte aus `02_FUNKTIONEN_ABLAEUFE.md`.
- Analyse-, Marketing-, LTV-, Margen-, Risiko- und Auto-Mail-Flächen aus älteren Mocks werden nicht übernommen.
- Der bisherige Code ist funktionaler Bestand, nicht visuelle Zielwahrheit. Hartcodierte Mock-Klassen und -Farben werden entfernt.

## Designsystem-Mapping

Das verbindliche Mapping auf `kr-`-Komponenten wird nach Phase 1 ergänzt. Bis dahin dürfen keine neuen lokalen Ersatzkomponenten oder Tokens als zweite Designwahrheit entstehen. Vorgesehene Rollen, noch ohne Komponentennamen: App-Shell, Seitenkopf, Suche, Filter, Ergebniszeile, Statusfläche, Detailabschnitt, Aktionsleiste, Dialog/Pane, Formularfeld, Konfliktkarte und Receipt-Bestätigung.
