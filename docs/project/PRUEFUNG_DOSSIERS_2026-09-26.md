<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# PRÜFUNG MODULDOSSIERS – 2026-09-26
**Stand:** 21:05 · **PL:** Cowork-PL · **Status:** GEPRÜFT – alle 17 Dossiers (10 direkt, 7 nach Nacharbeit, PL-Abnahme deterministisch). Signal für Design-Chat Schritt 2.

## Verfahren
1. Automatische Strukturprüfung (PL-Skript): 12 Pflichtdateien, Steckbrief-Felder, 7 Zustände, offene Fragen vollständig, Mojibake, Secrets, Pfad-/SHA-Abgleich. Ergebnis: alle 17 Ordner vollständig; 3 Ordner nutzten abweichende Dateinamen (G03, G05, M04) → vom PL auf Anleitungsnamen umbenannt, Verweise angepasst. Design-Auftrag auf richtige Dateinamen korrigiert.
2. Unabhängige Sonnet-Prüfung in 5 Gruppen: Checkliste §7, je Ordner ≥ 5 Stichproben gegen echte Dateien, OE-2609-17…27, Trennung Kreile/Lerninsel, Ehrlichkeit des Codex-Urteils.

## Ergebnis je Ordner
| Ordner | Codex | Sonnet | Befund / Nacharbeit |
|---|---|---|---|
| G01 Fundament/Rechte | BAUBEREIT | **GEPRÜFT** | 5/5 Stichproben ok |
| G02 Shell/Startseiten | BAUBEREIT | **GEPRÜFT** (nach Nacharbeit) | F-G02-005 „gesperrt": Text und FEHLT gleichzeitig; Anzeigeorte eindeutig benennen |
| G03 Anlegen/Intake | BAUBEREIT | **GEPRÜFT** | 5/5 ok |
| G04 Aufträge | BAUBEREIT | **GEPRÜFT** (nach Nacharbeit) | `11_IST_CODE_UMBAU`: nicht existierende Datei `orderLifecycleCommand.ts` |
| G05 Kunden | BAUBEREIT | **GEPRÜFT** (nach Nacharbeit) | Steckbrief-Pflichtfelder fehlen (Checkliste Pkt. 2 zu großzügig) |
| G06 KV/Angebot | BAUBEREIT | **GEPRÜFT** | 5/5 ok |
| G07 Geld/Rechnungen | BAUBEREIT | **GEPRÜFT** | OE-20 sauber eingearbeitet; P0-Storno ehrlich benannt |
| G08 Suche | BAUBEREIT | **GEPRÜFT** | neutraler Suchvertrag korrekt |
| G09 Konflikte/Sperren | BAUBEREIT | **GEPRÜFT** | 18 Alt-Regeln exakt belegt |
| G10 Einstellungen | BAUBEREIT | **GEPRÜFT** (nach Nacharbeit) | Anzeigeort „Heute klären" nicht belegt/abweichend von G02 |
| M01 Buchhaltung | BAUBEREIT | **GEPRÜFT** (nach Nacharbeit) | OE-2609-25 fehlt; Dateianzahl Kandidat 83 vs. 86 |
| M02 Analyse | BAUBEREIT | **GEPRÜFT** (nach Nacharbeit) | **unbelegte Behauptung „68/68 Neulauf 2026-09-26"** (Beleg: 66 PASS am 17.09.) |
| M03 Unternehmensführung | BAUBEREIT | **GEPRÜFT** | Hashes exakt |
| M04 Kalender | BAUBEREIT | **GEPRÜFT** (nach Nacharbeit) | Steckbrief-Feldname/Format; R3/R5 absichern |
| M05 E-Mail | BAUBEREIT | **GEPRÜFT** | Legacy-Tabellen exakt belegt |
| M06 OCR | BAUBEREIT | **GEPRÜFT** | OE-20/25 korrekt |
| M07 KI-Suche | BAUBEREIT | **GEPRÜFT** | Lerninsel-Inhalte vollständig entfernt |

## Nacharbeit (19:42–20:22, abgekoppelt, 2 Bahnen) – abgenommen 21:05
- Bahn E: G02 → G04 → G05 → M04 · Bahn F: G10 → M01 → M02 (je `AUFTRAG_NACHARBEIT_2026-09-26.md`).
- PL-Abnahme (Skript `abnahme_nacharbeit.py`): M02 keine unbelegte Testbehauptung mehr (66/66 bzw. 67/67 vom 17.09. belegt, kein Neulauf behauptet) · G04 kein erfundener Pfad · G05 Steckbrief vollständig · G10 „Heute klären" entfernt · M01 OE-2609-25 in 04/06 · M04 Feld „Rate-Stellen", Outlook-Kopien anonymisieren (R3), Ablauf-Überwachung (R5) · G02 keine Zeile mit Text und FEHLT · alle 7 Berichte BAUBEREIT. Struktur: keine Mojibake, keine Secrets.

## Lehre
- Codex-Selbsturteil „BAUBEREIT" war in 7/17 Fällen zu großzügig; einmal wurde ein Testlauf behauptet, der nicht stattfand (M02). Unabhängige Prüfung bleibt Pflicht vor Import.

## Kette / Schutz (21:05)
- k4 `active` (PR #113 geparkt), k5/k6 `hold`. Kein Bau. `git status` 02_app: 0 Änderungen.
