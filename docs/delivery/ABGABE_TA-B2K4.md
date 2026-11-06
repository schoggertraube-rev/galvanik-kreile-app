# TA-B2k4 · CI-Prüfungen beschleunigen

Stand: **in Arbeit, nicht merge-reif**. Der Anker verändert Prüfabläufe, keine Produktfunktion und keine Datenbank.

- Die Browserprüfungen für generierte Wege und den V5-Shell-Smoke sind für das gebundene Playwright-Image `v1.60.0-jammy` vorbereitet. Replay-Datenbank und SQL-Prüfungen bleiben auf dem Runner.
- Bei Pull Requests kann `_pr_scope.json` die Seiten des Pakets bestimmen; zusätzlich läuft der erste Fall jeder übrigen Seite. Eine unbekannte Seite führt zum Fehler. Bei leerer oder fehlender Liste sowie auf Main und im Nachtlauf bleibt der vollständige Prüfsatz erhalten.
- Der zuvor vorbereitete Planungssync entfällt nach P93. Die Planungsdateien bleiben lokal erhalten; das Nachtlaufprotokoll bleibt außerhalb des Commits.

## Nachweise und offene Punkte

- Lokale Auswahlliste: PR-Scope `ware` 41 Fälle in 15 Dateien; Main und leere Auswahl 334 Fälle. Unbekannte Seite wird abgewiesen. TypeScript, ESLint, YAML-Parse, Generator- und Scope-Selbsttest bestanden.
- Das Image und die beiden lokalen Replay-Ports sind geprüft. Nach einer gescheiterten Windows-Build-/Linux-Container-Kombination bestand die Gegenprobe mit Linux-Build und isolierten Linux-Abhängigkeiten: der echte Browserfall N01 lief gegen die lokale Replay-DB 1/1 durch, Container-Exitcode 0. Das Image verwendet Node 24.15.0; die Anwendung deklariert 24.18.0, was bei der Installation eine Warnung erzeugte. Der endgültige GitHub-Workflow ist noch gesondert zu prüfen.
- P96 ergänzt eine auf Branch und Basis begrenzte Scope-Ausnahme für die erlaubten Dateien. Der Baseline-Vergleich erlaubt ausschließlich die freigegebene Änderung von `judgeContractHash`; Tests prüfen auch unzulässige Pfade und Budgetänderungen. Der exakte Kandidat muss noch in CI geprüft werden.
- PR-Link, SHA, READY-Preview und vollständiger Status der Checks folgen erst nach Commit und Push des vollständigen Ankers.
