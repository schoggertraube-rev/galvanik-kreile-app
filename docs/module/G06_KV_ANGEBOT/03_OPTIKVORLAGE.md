<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G06 KV / Angebot — Optikvorlage

## Verbindliche Quelle

`02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`  
SHA-256: `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`  
Relevanter Abschnitt: Zeilen 1112–1225, JavaScript-Fluss `Kunde → KV / Angebot → Auftrag`; insbesondere `data-mkna="kv"`, `Kostenvoranschlag anlegen`, `KV gesichert` und `data-mkna="auftrag"`.

V5 ist Inhalts- und Aufbauquelle. Nach OE-2609-03 wird kein Mock-CSS kopiert: die sichtbare Umsetzung nutzt ausschließlich das in Designphase 1 aus V5 abgeleitete Kreile-Designsystem.

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| Globales Anlegen – Auswahl | ✓ | ✓ | ✓ | 7/7 spezifiziert | V5 `openMkNew`, Kette Zeile 1112; `02_FUNKTIONEN_ABLAEUFE.md` F-G06-001 |
| Kunde für KV suchen/auswählen | ✓ | ✓ | ✓ | 7/7 spezifiziert | V5 `data-mkna="kv"`; G05-V2 als Kontrollreferenz |
| Kostenvoranschlag anlegen/bearbeiten | ✓ | ✓ | ✓ | 7/7 spezifiziert | V5 `Kostenvoranschlag anlegen`, Zeilen 1177–1192 |
| Offene KVs öffnen/fortsetzen | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 7/7 funktional spezifiziert | Kein eigener V5-Screen; realer Bestand `GlobalCreateFlow.tsx` |
| KV gesichert / Zuschlag bestätigen | ✓ | ✓ | ✓ | 7/7 spezifiziert | V5 `KV gesichert`, Zeilen 1195–1202 |
| Auftrag angelegt / Auftragskarte öffnen | ✓ | ✓ | ✓ | 7/7 spezifiziert | V5 Auftragsschritt nach Zeile 1202; G04-Auftragskarte V8 |
| KV-Dokument / Versand | fehlt → Designphase 1 | fehlt → Designphase 1 | fehlt → Designphase 1 | 2/7 belegt; Rest Q-G06-002/-003 | V5 nennt `KV senden`, aber kein produktiver Dokument-/Fehlerfluss |

## Aufbau je Screen

### Globales Anlegen – Auswahl

- Ein globaler Griff `Anlegen`; keine KV-Kachel auf der Startseite.
- Eine Überschrift, dann kompakte Wahl `Kunde anlegen`, `Auftrag / KV anlegen`, `Offene KVs bearbeiten`.
- Innerhalb höchstens zwei Handlungen beginnt die Eingabe.
- Weitere Anbindungen werden nicht als aktive Wege vorgetäuscht.

### Kostenvoranschlag anlegen/bearbeiten

- Kopfkette `Kunde › KV / Angebot › Auftrag`, eine Hauptüberschrift.
- Kundenkontext sichtbar, nicht erneut eintippen.
- Positionen dicht, touchfähig und in dieser Reihenfolge: Teil/Bezeichnung, Menge, Material, Oberfläche, Netto je Stück; Zeilensumme nur berechnet.
- Danach gewünschter Termin, Hinweis und berechnete Netto-Gesamtsumme.
- Primäraktion `KV sichern`; `KV senden · In Aufbau` gedämpft und nicht klickbar.
- Schnellerfassung/Wiederverwendung ist ein Hilfsmittel im selben Screen, keine zweite Route.

### Offene KVs

- Kompakte Liste mit KV-Nummer, Kunde, Stand, Terminwunsch und Netto-Summe.
- Auswahl öffnet denselben Bearbeitungsscreen.
- Lade-, Leer-, Fehler- und Unklarzustand belegen die Datenwahrheit; kein Skeleton mit erfundenen Werten.

### KV gesichert / Zuschlag

- Sichtbar: KV-Nummer, Kunde, Positionszahl, Netto-Summe, Status, Version und Terminwunsch.
- Bearbeiten bleibt möglich, solange `draft`.
- Zugesagter Auftragstermin ist ein eigenes Pflichtfeld unmittelbar am Zuschlagsknopf.
- Zusatzfelder aus V5 bleiben gemäß Q-G06-001 als `Auftragsdetails · In Klärung` gesperrt, bis der G04/G07-Vertrag feststeht.
- Nach Erfolg führt genau eine Primäraktion zur echten Auftragskarte.

## Designsystem-Bausteine (`kr-`)

Wird nach Phase 1 ergänzt. Verbindliche Leitplanken sind bereits: Fraunces für Display/Überschrift, Inter für Bedien- und Datentext, Navy/Cream aus zentralen Tokens, mindestens 48 px Touch-Ziel, sichtbarer Fokus, keine eigenen Farbwerte, keine kopierten Mock-CSS-Klassen. Benötigt werden mindestens `kr-Dialog`, `kr-StepChain`, `kr-Field`, `kr-LineItems`, `kr-Money`, `kr-State`, `kr-Receipt`, `kr-Conflict`, `kr-Button` und `kr-DisabledCapability`.

## Kontrollreferenzen, nicht bindend

- `KREILE_STARTSEITE_ROLF_V8_2026-08-20.html` und `KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html` prüfen nur Einbettung/Dichte der Shell.
- `TargetShell.module.css` ist aktueller Ist-Code, aber nach OE-2609-03 keine Zieloptik.
- V2–V4 und V6 sind keine Zielvorlagen; ihre Einstufung steht in `09_QUELLEN_AKTUALITAET.md`.
