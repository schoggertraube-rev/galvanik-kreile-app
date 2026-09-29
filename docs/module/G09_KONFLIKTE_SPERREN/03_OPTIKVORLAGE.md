<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 03 — Optikvorlage

## Verbindliche Referenzen

- Aktueller Gesamtlook: `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`, SHA-256 **75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA**.
- Rollenwahrheit Rolf: `KREILE_STARTSEITE_ROLF_V8_2026-08-20.html`.
- Rollenwahrheit Phillip: `KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html`.
- `CURRENT_DESIGN_REFERENCE.json` und `00_UI_REFERENZ_KANONISCH.md` bestimmen die aktuelle Auswahl; V6 ist durch D-UI-V5-003 verworfen.
- Es gibt am Prüfstand 2026-09-26 **keine** freigegebene G09-spezifische Vollansicht. Fehlende Varianten werden nicht aus Alt-UI geraten: **fehlt → Designphase 1**.
- Die finalen Designsystem-Klassen mit Präfix `kr-` **werden nach Phase 1 ergänzt**. Bestehende Altklassen sind keine Optikvorgabe.

## Einbau in die Rollen-Startseiten

### Rolf

- Bereichstitel: **„Das braucht dich“**.
- Begrüßung/Lastanzeige gemäß Rolf V8: „Guten Morgen, Rolf. 2 dringend · 2 weitere brauchen dich — arbeitest du die roten ab, ist nichts Kritisches offen.“ Zahlen sind ausschließlich Livewerte.
- Jede Karte zeigt in dieser Reihenfolge: Dringlichkeit, klare Ursache, betroffener Auftrag/Kunde, objektive Frist, sichtbare Zuständigkeit, eine Hauptaktion, optional „An Phillip geben“, Datenstand.
- Geld, Kundenversprechen, Preis/Freigabe, Terminänderung, Kalenderüberschneidung und zurückgegebene Delegation gehören hierher.
- Keine KPI-Kacheln, kein technischer Fehlerlog, keine unpriorisierte Liste.

### Phillip

- Bereichstitel: **„Heute sichern“**, Hinweis gemäß Phillip V4: „nach Termin · was heute raus/fertig muss“.
- Begrüßung/Lastanzeige gemäß Phillip V4: „Servus Phillip. 2 dringend · 2 weitere — bring die durch, dann sind heute alle Termine sicher.“ Zahlen sind ausschließlich Livewerte.
- Jede Karte zeigt die konkrete physische nächste Aktion, Auftrag, Kunde, Frist und Blockade; Finanz-/Kundenentscheidungen verlinken nicht als Phillip-Aktion.
- WIP erscheint als Bestandszahl, zum Beispiel „In Arbeit (Galvanik): 12 Aufträge“, nie als Kapazitätsprozentsatz.
- Bündelung erscheint als neutraler Prüfhinweis: „3 Aufträge nennen Zink — Bündelung prüfen“.

## Responsive Belegung

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| Rolf — „Das braucht dich“ | Im primären Startseitenstrom, nicht als rechter Nebenfriedhof; vollständige Karte mit Grund, Wirkung, Frist, Owner und Hauptaktion. | Eine Spalte; Hauptaktion voll breit, Sekundäraktion darunter. | Eine Karte pro Zeile; wichtigste Information und Hauptaktion ohne horizontales Scrollen. | Daten/leer im Rollenmock; lädt/Fehler/gesperrt/In Klärung/In Aufbau fehlen → Designphase 1. | Rolf V8; Gesamtmock V5; OE-2609-22 |
| Phillip — „Heute sichern“ | Nach Termin priorisierte Karten plus ehrlicher WIP-Zähler und optionale Bündelprüfung. | Touch-Ziel mindestens 44 px; Aktion direkt an Karte; keine Hover-Abhängigkeit. | Frist und nächste Aktion oberhalb des Folds; Detail über Deep-Link. | Daten/leer im Rollenmock; übrige Zustände fehlen → Designphase 1. | Phillip V4; Gesamtmock V5 |
| Inline-Sperre am Auftrag | Direkt an der nicht ausführbaren Aktion mit Grund und nächstem erlaubtem Weg. | Gleiche Informationshierarchie; keine reine Tooltip-Erklärung. | Textumbruch; Button bleibt sichtbar; Fokus auf Fehlermeldung. | gesperrt fachlich belegt; vollständige responsive Darstellung fehlt → Designphase 1. | D-RES-001; OrderCard-Verträge |
| Termin-/Kalenderkonflikt | Rolf-Karte mit Auftrag, Termin, überlappender Abwesenheit/Betriebstermin und „Termin prüfen“. | Eine Spalte; Zeitintervalle untereinander. | Kurztitel plus Datum; keine Kalender-Matrix nötig. | In Aufbau belegt; Daten/leer/lädt/Fehler fehlen → Designphase 1. | OE-2609-19; Mindmap V2 |
| Abwesenheiten der Kollegen | Kompakte Informationszeile auf Startseite, getrennt von handlungsbedürftigen Konflikten. | Namen und Zeitraum umbrechen. | Heute/als Nächstes; weiterführende Liste über Nachschlageweg. | Fachinhalt belegt; Optik fehlt → Designphase 1. | OE-2609-19 |
| WIP/Bündelprüfung | WIP als Textzahl, Bündelhinweis als nicht alarmistische Karte mit gefiltertem Deep-Link. | Eine Spalte; keine Diagrammverkleinerung. | Zahl und Text, keine Mini-Charts. | Daten teilweise im Phillip-Mock; leer/Fehler/In Klärung fehlen → Designphase 1. | Phillip V4; Performance-UX-Vertrag |
| Globale G09-Zustände | Feste Flächenhöhe verhindert Layoutsprung; Zustand ersetzt nur den Inhalt. | Identische Zustandssemantik. | Identische wörtliche Texte; Screenreader-Status für Laden/Fehler. | Nur Texte aus `02`; visuelle Varianten fehlen → Designphase 1. | Anleitung §3/§5; RT-21/22/23 |

## Priorität und Farbe

- Farbe ergänzt immer Icon und Text; sie ist nie alleinige Bedeutung.
- `blockierend`: Handlung aktuell unmöglich; sichtbarer Grund und zuständige Rolle.
- `dringend`: reale Frist heute/überfällig oder externe Entscheidung unmittelbar nötig.
- `wichtig`: handlungsrelevant, aber nicht heute blockierend.
- `Hinweis`: Information wie Abwesenheit oder Bündelprüfung; nicht rot darstellen.
- „In Klärung“ und „In Aufbau“ sind grau, nicht klickbar und enthalten keine Zahl, Ampel oder Erfolgsaussage.

## Interaktionsgrenzen

- Eine Karte hat genau eine primäre sichere Aktion; zusätzliche Navigation ist als Textlink sekundär.
- „Erledigt“ und „Ignorieren“ sind verboten, wenn sie keine Fachwahrheit ändern.
- Aufschub wird nicht gezeigt, solange der persistente Vertrag aus Q-G09-004 fehlt.
- Bündelprüfung öffnet nur die betroffenen Aufträge; sie startet keinen Command.
- Kalenderdetail ist ein Nachschlageweg; die alltägliche Aktion bleibt im Auftrag, in Terminverschiebung, Startseite oder Werkstatt.
