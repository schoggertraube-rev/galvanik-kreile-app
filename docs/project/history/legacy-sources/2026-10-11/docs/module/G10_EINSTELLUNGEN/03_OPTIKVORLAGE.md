<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 03 — Optikvorlage

## Verbindliche Quelle

Einzige Ablauf-/Zwischenschritt-Referenz ist `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` mit vollständigem SHA-256 `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA` (D-UI-V5-003). Der Anker `function settingsPage()` belegt Route, Kreile-Shell und den grundsätzlichen Admin-Einstieg, aber nur eine Demo-OCR-Karte und keine fachlich ausreichenden G10-Screens. Demo-Werte und Mock-CSS sind keine Produktdaten und werden nicht übernommen.

Die vier Seitenmocks bleiben Seitenwahrheit für Shell, Typografie, Abstände und Navigation. V6 ist verworfen. Fraunces/Inter, Navy/Creme, mindestens 48 px Touchziel, klare Fokusmarkierung und reduzierte Kreile-Sprache sind verbindlich. Konkrete `kr-`-Bausteine werden nach Designsystem-Phase 1 ergänzt; bis dahin wird kein paralleles Komponenten- oder Token-System erfunden.

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| G10-Übersicht / Gregor-Einstieg | V5-Shell und Seitenkopf belegt; fachliche Karten fehlen → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 7/7 aus `02`, visuelle Ausprägung fehlt | V5 `settingsPage()`; OE-2609-02/03/04 |
| Firmenstammdaten / E-Rechnung | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 7/7 textlich belegt | F1.4; OE-2609-14 |
| Kataloge & Preise | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 7/7 textlich belegt | Register #3/#9; F1.3 Extra Work |
| Nummernkreise `A-` / `R-` | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 7/7 textlich belegt | Register #2/#4 |
| Zahlung, Skonto und Zahlungsziel | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 7/7 textlich belegt | OE-2609-07/11 |
| Kartenterminal | gedämpfte Karte fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 7/7; vor M01 nur `In Aufbau` | OE-2609-12 |
| Rechte je Person | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 7/7 textlich belegt | OE-2609-09; RT-05 |
| Aufbewahrung | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 7/7 textlich belegt | OE-2609-20 |
| Laufende Kosten / Kontostand | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 7/7 textlich belegt | OE-2609-24 |

## Layout- und Interaktionsvertrag für Designphase 1

- Desktop: linke Kreile-Navigation bleibt sichtbar; Inhalt maximal zweispaltig, aber Formulare selbst einspaltig mit klarer Speichern-/Verwerfen-Zone. Kritische Zustände stehen oberhalb der ersten Falz.
- Tablet: eine Spalte; Bereichsnavigation als 48-px-Segmentleiste oder Dropdown aus dem Designsystem, keine horizontal abgeschnittenen Alt-Tabs.
- Handy: eine Spalte, kein Tabellenzwang; Datensätze als Karten, primäre Aktion sticky nur nach Designfreigabe, niemals unter der Systemnavigation.
- `In Klärung` und `In Aufbau`: gedämpfte Karte, Statuschip, Erklärung, nicht klickbar, keine Route und kein Provideraufruf. Nicht die gesamte `/settings`-Route sperren.
- Formularfehler stehen am Feld und zusätzlich als fokussierbare Zusammenfassung; gespeicherte Änderungen zeigen Receipt/Readback statt bloßem Toast-Erfolg.
- Beträge werden in der UI deutsch formatiert, technisch in Cent geführt; Daten und Uhrzeiten werden mit Zeitzone angezeigt. Secret-Felder existieren nicht in der UI.

