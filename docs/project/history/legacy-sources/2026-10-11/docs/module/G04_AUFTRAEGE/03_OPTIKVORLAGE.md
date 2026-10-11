<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G04 · Optikvorlage

## Verbindliche Quellen

- Gesamtstruktur: `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`, SHA-256 `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`, Anker/Player `ordersPage` und eingebettete Referenz `order`.
- Einzelkontrolle Auftragskarte: `02_app/docs/project/linie/ui/KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html`, SHA-256 `C4F74528ED4D516A9FED958FECEE1CB7F52B324788B0AA927551647892F1F365`.
- Textfassung zur Quellenkontrolle: `00_BIBEL/MOCK_BAUANLEITUNG_V5.md`, SHA-256 `FDED519ED887…`, Abschnitte 2.4, 2.5 und 5.
- Fachliche Übersteuerung: OE-2609-03 und OE-2609-27. V5/V8 liefern Informationsarchitektur und responsive Varianten, aber keine zu kopierende CSS-Schicht, keine Demo-Daten und keine doppelten Kicker-/Titel-/Erklärtext-Stapel.

## Geräte- und Zustandsabdeckung

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| Auftragsliste | ✓ | ✓ | ✓ | 5/7; `In Klärung`/`In Aufbau` durch Dossier ergänzt | V5 `ordersPage`; Bauanleitung §2.4 |
| Auftragskarte | ✓ | ✓ | ✓ | 5/7; `In Klärung`/`In Aufbau` durch Dossier ergänzt | V5 Referenz `order`; V8; Bauanleitung §2.5 |
| Terminzeile und Terminänderung in der Auftragskarte | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7 fachlich, 0/7 visuell | OE-2609-13/-19; Q-G04-006 |
| Terminübersicht Woche/Monat | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7 fachlich, 0/7 visuell | OE-2609-13/-19; Q-G04-006 |
| Ausgegrauter Auftragsstorno | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 1/7 | OE-2609-21; Q-G04-002 |

## Informationsarchitektur der vorhandenen Vorlagen

### Auftragsliste

Eine Hauptüberschrift `Aufträge`, primäre Aktion `Neuer Eingang`, Suche nach Auftrag/Kunde/Teil/Oberfläche, Filter und eine kompakte Liste mit den Spalten Auftrag, Ort & Termin, nächste Handlung und Öffnen. Demo-Zahlen, Demo-Aufträge und statische Badge-Werte werden niemals übernommen. Der Filter-Leerzustand lautet in der realen App `„Keine Aufträge gefunden.“`.

### Auftragskarte

Ein Kopf mit Auftragsnummer, Titel, Kundenlink und aktuellem Termin; die fachliche Kette `angenommen → Galvanik → fertig → Zahlungsgate → raus/abgeholt`; danach nächste Handlung, Teile, Abschluss/Freeze, Notizen, Fotos/Dokumente, Schnellaktionen und Verlauf. Das Zahlungsgate ist kein Produktionsschritt. Die Karte bleibt auf Desktop dreispaltig/kompakt, auf Tablet reduziert und auf dem Handy vollflächig mit erreichbaren Aktionen; drei echte Varianten sind nachzuweisen.

Die V8-Demoaussagen `Foto zwingend` und immer gleiche T-01…T-04 sind fachlich verworfen: Foto ist keine generelle harte Pflicht, und Teile kommen ausschließlich aus realen Auftragsdaten. `Kalkulation & Kennzahlen` wird nicht als eigener Kartenabschnitt übernommen; nach OE-2609-22 erscheinen später nur relevante Einzelwerte am Objekt, während Analyse ein eigener Bereich ist.

## Inhaltsliste für Designphase 1b

| Screen | Person | Daten (Felder) | Aktionen | Zustände | Quelle |
|---|---|---|---|---|---|
| Terminblock Auftragskarte | alle mit `orders.schedule.read/write` | KV-Wunschtermin (Herkunft), bestätigter Termin, Abholtermin, letzte Änderung mit Grund/Akteur, Auftragsversion | bestätigten Termin ändern; Abholtermin setzen/ändern; Verlauf öffnen | Daten, lädt, leerer optionaler Abholtermin, Fehler, gesperrt, In Klärung, In Aufbau | OE-2609-13, OE-2609-19, OE-2609-21 |
| Terminänderungsdialog | alle mit `orders.schedule.write` | Auftragsnummer, aktueller Wert, neues Datum, Terminart, Pflichtgrund, Version | speichern; abbrechen; bei Konflikt neu laden | Daten, lädt, Fehler, gesperrt, Versionskonflikt, Ausgang ungeklärt | OE-2609-13; D-RES-001 |
| Terminübersicht Woche | Rolf/Phillip nach Capability | Zeitraum, bestätigte Termine, Abholtermine, Auftragsnummer, Kundenkurzname, Status, Konfliktfakt; externe Abwesenheit/Betriebstermin später mit Quellenmarker | Woche wechseln; Monat öffnen; Auftrag öffnen; Termin ändern | alle 7 gemäß `02_FUNKTIONEN_ABLAEUFE.md` | OE-2609-13, OE-2609-19, OE-2609-26 |
| Terminübersicht Monat | Rolf/Phillip nach Capability | dieselben Fakten aggregiert pro Tag; keine zweite Speicherung | Monat wechseln; Woche/Tag öffnen; Auftrag öffnen | alle 7 gemäß `02_FUNKTIONEN_ABLAEUFE.md` | OE-2609-13, OE-2609-19 |
| Storno-Platzhalter | alle mit Detailzugriff | kein Stornoformular; nur Statushinweis | keine | In Klärung | OE-2609-21; Q-G04-002 |

## Designsystem-Bausteine

Status: **wird nach Phase 1 ergänzt**. Bis zur Freigabe werden keine neuen `kr-`-Namen erfunden. Verbindlich sind bereits: Kreile-Farb-/Typo-Tokens (Fraunces/Inter), eine Hauptüberschrift pro Bereich, hohe Informationsdichte, klare Handlung statt Erklärtext, sichtbarer Fokus, Touch-Ziele, keine überdeckten Inhalte und keine Abhängigkeit von `src/styles/mock/mock-kreile-compat.css`.

## Visuelle Abnahme

Die Owner-UX prüft gegen Exact-SHA bei 1914×917, 1220×880 und 390×844. Erforderlich sind echte Session und echte Read-Ports, kein Mockdaten-Seed; Liste/Karte müssen Daten-, Leer-, Fehler- und Sperrzustand belegen, neue Terminflächen zusätzlich `In Aufbau`/`In Klärung`. Screenshots sind CI-Artefakte, keine Produktwahrheit.
