# Meldungen des Endversion-Chats an Planungschat und Codex

Laufendes Protokoll (neueste oben). Der Endversion-Chat pflegt spec.json und erzeugt daraus `docs/project/endversion/codex/BAUPLAN.json`. Er schreibt nicht in den App-Code.

## 27.10. ca. 23:15 – Einarbeitung F1, F3/F4, F5–F7 abgeschlossen, Gegenprüfung Runde 2 läuft

- spec `8faee2a3d317`, Bauplan neu erzeugt. Baureif bleiben **Login, F0, F2**. F1 steht im Bauplan nur mit Korrekturen.
- Befunde aus Runde 1 sind eingearbeitet: F1 49, F3/F4 38, F5–F7 47. Neue Annahmen gehen bis A-79. Mock und Abläufe (Buchen, Kunde, Mail, Rechnung, Einstellungen) laufen ohne Fehler.
- Neu in F6: **Stornorechnung** (`rechnungstorno`) und **Zahlung stornieren** (`zahlungsstorno`). F6 steht auf „spec-fertig“, bis die Owner diese zwei Seiten abhakt (OR-17).
- Neu: **F7b Datenkiste (Import)** als eigener Abschnitt, „in Arbeit“. In F7 ist sie ausgeblendet, bis F7b gebaut ist.
- **Korrektur zur Vorgabe „kein Skonto“:** Das war falsch. Es gilt die Owner-Entscheidung **U-111**: Rechnung auf Ziel 14 Tage, 2 % Skonto bei Zahlung in 10 Tagen. Satz und Frist werden je Kunde gespeichert und in der Rechnung ausgewiesen. Eine Zahlung innerhalb der Frist mit dem Skontobetrag schließt die Rechnung (A-73).
- Nächster Schritt: Ein frischer Prüfer prüft F1, F3/F4 und F5–F7 erneut. Baureif wird ein Abschnitt erst nach einer Runde ohne blockierende Punkte.
- Codex: unverändert nur Login → F0 → F2 bauen bzw. korrigieren. Kein Neubau von F3–F7.

## 27.10. abends – Login, F0, F2 baureif

- `BAUPLAN.json › baureife`: **Login, F0 und F2 baureif** (Gegenprüfung nach 5 Runden bestanden, spec `faba82e2e3ff`).
- Codex: Korrekturen für diese drei Abschnitte jetzt nach dem baureifen Bauplan, Reihenfolge Login → F0 → F2. F0 zuerst wegen der Bereichsprüfung, inkl. `migration_altbestand` und `server_umstellung.bereich_je_stelle`.
- Korrekturen mit Zielen aus F3–F6 sind `zurueckgestellt`: Daten, Filter und Text bauen, das Ziel vorerst über den bestehenden Pfad (`verhalten_appweit.ziele_bestand`).
- F1, F3/F4, F5–F7: Befunde werden gerade eingearbeitet, danach folgt die Gegenprüfung.
- Offene Sachfrage an die Owner: **Bundesland der Firma** (Feiertage, A-13). Bis dahin gelten die bundesweiten Feiertage.

## 27.10. ca. 23:30 – Stand Baureife

- Verträge, Ableitungen und Abnahmen liegen für alle Abschnitte F0–F7 vor. Die mechanische Prüfung `baureife()` ist für F0–F7 grün.
- Gegenprüfung aus Bauenden-Sicht (nur BAUPLAN.json), blockierende Punkte je Runde:
  - Login/F0/F2: 9 in Runde 1, 10 in Runde 2 (tiefer). Beide eingearbeitet, Runde 3 läuft.
  - F1: 11, wird eingearbeitet.
  - F3/F4: 13, wird eingearbeitet.
  - F5–F7: Prüfung läuft.
- Ablauf je Abschnitt: Befunde einarbeiten, dann prüft ein frischer Prüfer erneut. Baureif ist ein Abschnitt erst, wenn eine Runde ohne blockierende Punkte endet. Erst dann steht dort `baureif: true`.
- Neu im Bauplan:
  - `verhalten_appweit`: zentrale oeffne(ziel, arg), Zurück, Speichern, Rechte, Zeit, Tastatur, Geräte, Ziele im Bestand.
  - `annahmen` (A-01 …): Produktannahmen, die die Owner morgen bestätigt.
  - F0 mit `migration_altbestand` und `server_umstellung.bereich_je_stelle`.
  - Rangfolge bei Widerspruch: klaerungen > annahmen > Verträge > Struktur > Freitext.
- Reihenfolge der Korrekturen: Login → F0 → F1 → F2. F0 kommt zuerst, weil die übrigen Korrekturen Bereiche prüfen.
- Codex: weiter nur Korrekturen. Commit `a2381463 feat(f3)` ist vor der Sperre entstanden. Bitte nicht weiterbauen, bis F3 baureif ist.

## 27.10. 22:45 – Baureife-Sperre (U-211), Auftrag der Owner

Die Owner will: Was gebaut wird, soll beim ersten Mal richtig gebaut werden, keine Fehlersuche mehr.
Die Code-Durchsicht von Login, F0, F1 und F2 hat 56 Befunde ergeben, davon 14 schwer. Ursache: Der Bauplan war unvollständig. Viel Verhalten stand nur im Mock-Code und in Musterzeilen, und genau die bekommt Codex nicht. Dazu kommt: Der spec-check prüfte nur Kennungen.

**Neu, ab sofort verbindlich:**
1. `BAUPLAN.json › baureife`: Neu gebaut wird nur, wo `baureif: true` steht. Ein Abschnitt ist baureif, wenn alle drei Bedingungen erfüllt sind:
   - Jeder Baustein hat einen Vertrag (`bausteine_vertraege`).
   - Jeder Datenblock hat eine `ableitung`.
   - Jede Seite hat `abnahme`-Fälle **und** die Gegenprüfung aus Sicht des Bauenden ergab keine blockierenden Punkte.
2. Im Moment ist kein Abschnitt baureif. **Codex arbeitet nur den Korrekturteil ab** (H5 in AKTUELLE_ANWEISUNG.md), ohne Neubau von F3–F7 und ohne Backend-Vorarbeit für F3–F7 nach 4e.2.
3. Vor jedem Neubau schreibt Codex `codex/RUECKFRAGEN_<Abschnitt>.md`. Raten ist verboten.
4. Die Abgabe enthält je Abnahmefall Datei:Zeile. Klicktests macht weiterhin die Owner (Regel 4d).

**Heute Nacht im Endversion-Chat:** Verträge, Ableitungen und Abnahmen für alle Abschnitte werden geschrieben, dann folgt die Gegenprüfung. Sobald ein Abschnitt sie besteht, steht er in BAUPLAN.json als baureif. Codex liest BAUPLAN.json vor jedem Paket neu.

**Zum Merge 6:50:** Die zwei schweren F0-Befunde sind unverändert der erste Korrekturpunkt.
