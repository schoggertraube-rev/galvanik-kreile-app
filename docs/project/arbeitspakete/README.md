# Arbeitspakete – einzige Bauquelle für Codex ab dem Eingang (U-218)

## Wer macht was
- **Endversion-Chat = WAS.** In BAUPLAN.json je Abschnitt: Verhalten, Felder, Regeln, Zustände inklusive `fehlt`, Rechte je Aktion und Abnahmefälle als Owner-Klickwege. Keine Code-Annahmen.
- **Planungschat = WIE.** Er übersetzt einen baureifen Abschnitt gegen den echten Code und die Dev-DB in Arbeitspakete in diesem Ordner. Er schreibt **keinen Produktcode**. Erlaubt sind nur Signaturen, Typen, Migrations-SQL, Fixtures und Akzeptanztests. Verboten sind Funktionsrümpfe und UI-Markup.
- **Codex = TUN.** Er baut **nur** Pakete aus `WORKQUEUE.json` mit Status `bereit`. Was nicht im Paket steht, baut er nicht.

## Paketordner `AP-<Nr>-<kurz>/`
Pflichtteile:

1. **`PAKET.md`** mit folgenden Abschnitten:
   - **Ziel:** ein Satz, mit Verweis auf die BAUPLAN-Abschnitt-ID.
   - **Ist → Soll:** Bei vorhandenem Code je Datei/Funktion mit `datei:zeile`. Bei neuem Code: Zielpfade der neuen Dateien.
   - **Ersetzt/Entfernt:** alte Dateien, Routen und Felder, die im selben Paket wegfallen.
   - **Verbote:** z. B. keine Parallel-Tabelle zu X, kein zweiter Weg für Y. Wird per Grep-Gate erzwungen.
   - **Datenvertrag:** je Feld `tabelle.spalte` oder eine benannte Migration, die Anzeige bei leerem Wert und der Rechte-Bereich je Aktion.
   - **Vertrag:** TS-Typen und Signatur der Server-Commands und -Reads, inklusive Fehlerfällen.
   - **Technische Freiheit:** was Codex selbst entscheiden darf, z. B. eine Bibliothek, solange die Ausgabe dem Vertrag entspricht.
   - **Gate:** Testdatei(en), Grep-Regeln und die DB-Zeile, die danach stehen muss.
   - **Abnahme:** Owner-Klickweg (höchstens 6 Schritte) mit dem Soll in der DB, aus dem BAUPLAN übernommen.
2. **`migration.sql`**, falls nötig: additiv, mit RLS und Rechten.
3. **`*.acceptance.test.ts.txt`** (Planungsort mit Endung `.txt`, damit der globale Typecheck/Lint ihn dort nicht erfasst; Codex kopiert bytegleich als `*.acceptance.test.ts`): der rote Akzeptanztest gegen die Replay-DB mit Fixture, dazu ein Negativtest für die Rechte. Codex kopiert ihn **unverändert** nach `src/test/acceptance/` (Prüfung per SHA-256 in der Abgabe). **Codex ändert Akzeptanztests nie.** Hält er einen Test für falsch, schreibt er `BLOCKER.md` im Paketordner und macht mit dem nächsten Paket weiter.
4. **`fixtures/`**: echte Beispiel-Eingaben (Mail, E-Rechnung, Scan) ohne personenbezogene Echtdaten.

## Spike-Pakete (`AP-<Nr>-SPIKE-<kurz>`)
Gibt es eine echte technische Unbekannte (OCR-Dienst, Mail-Abruf, E-Rechnung-Parsing), baut Codex in höchstens 2 h einen Wegwerf-Prototyp in `spikes/`, nie in `src/`. Dazu schreibt er eine Entscheidungsnotiz `SPIKE_ERGEBNIS.md` mit gewähltem Weg, Grenzen und Kosten. Erst danach schreibt der Planungschat die Verträge. Der Spike-Code wird nicht übernommen.

## Annahmen
Jede Annahme des Planungschats, die der BAUPLAN nicht deckt, steht in `ANNAHMEN.md`. Der Endversion-Chat bestätigt oder korrigiert sie. Ein Paket mit unbestätigter Annahme ist nicht abnahmefähig.

## Zustand
Einzige Wahrheit über den Stand sind `WORKQUEUE.json` und die Paketordner, nicht der Chatverlauf. Jede Sitzung des Planungschats beginnt mit dem Lesen von `WORKQUEUE.json`, `ANNAHMEN.md`, allen `BLOCKER.md` und `git log` seit dem letzten Paket.
Status je Paket: `entwurf` → `bereit` → `in_bau` → `abgegeben` → `abgenommen`, oder `blockiert`.
Codex setzt `in_bau` und `abgegeben`. Der Planungschat setzt `bereit` und `blockiert`. `abgenommen` setzt der Planungschat erst nach dem DB-Beleg und dem Owner-Klick.

## Schnitt
Der Eingang wird nach Kanälen geschnitten. Jeder Kanal ist für sich abnahmefähig. Reihenfolge laut Owner (U-215): Paket/persönlich → Mail inkl. E-Rechnung → OCR → Eingangsrechnungen → Telefon.
