# AKTUELLE ANWEISUNG – einzige Auftragsquelle für den Bau-Codex (Stand 03.11., 19:07)

Diese Datei **ersetzt alle früheren Fassungen**. Das Archiv `_review/archiv/AKTUELLE_ANWEISUNG_bis_2026-10-29.md` ist nur Nachschlagewerk und **kein Auftrag**. Steht etwas dort anders als hier, gilt diese Datei. Der Planungschat hält diese Datei kurz: Erledigtes fliegt raus, und nichts wird nur angehängt.

## A. Feste Regeln (gelten immer)
1. **Quellen.** Aufträge stehen nur hier im Abschnitt C. Dazu kommen ab dem Eingang die Arbeitspakete mit Status `bereit` in `docs/project/arbeitspakete/WORKQUEUE.json` (Format: `docs/project/arbeitspakete/README.md`). Das WAS steht in `docs/project/endversion/codex/BAUPLAN.json`. Grenzen setzen `_review/OWNER_ENTSCHEIDUNGEN.md` und AGENTS.md (mit Vorrangregel). Andere Dateien sind kein Auftrag.
2. **Reihenfolge.** Immer nur der oberste offene Punkt in C. Vor jedem Unterpunkt diese Datei neu lesen.
3. **Fertig heißt:**
   - Ein Integrationstest ruft die **echte** Server-Action gegen die Replay-DB auf und prüft die DB-Zeile. Nachgestellte DB, Mocks oder reine UI-Tests zählen nicht.
   - CI ist grün.
   - Es gibt eine Abgabe `docs/delivery/ABGABE_<Nr>.md` mit Befund, Datei:Zeile, DB-Soll und Owner-Klickweg. Der Klickweg beginnt mit dem **Preview-Link genau dieses SHA** (Status READY, nicht der Branch-Alias).
4. **Fehler sind sichtbar.**
   - Kein `catch` ohne serverseitiges Log mit Code.
   - Jede Meldung erscheint dort, wo gerade gehandelt wird, also im Dialog selbst.
   - Ein Lesefehler erscheint als sichtbare Zeile mit Code und wird nie still ausgeblendet.
   - Keine Ersatzwerte: Fehlt ein Wert, steht dort „fehlt“.
5. **Eine Wahrheit.**
   - Keine zweite Tabelle, Route oder Regel neben einer vorhandenen.
   - Wer etwas ersetzt, löscht das Alte im selben Paket.
   - Keine Umschreibungen, die einen Wächter austricksen.
6. **Scheitern.** Scheitert ein Unterpunkt fachlich nach einem Fixversuch, wird er zurückgenommen, `RUECKFRAGEN_<Nr>.md` geschrieben und der nächste Unterpunkt begonnen. Mechanische Folgearbeit zählt nicht als Fixversuch: Lint-Umbenennung, Fixture-Feld, Manifest, Testselektor. Bei einem Werkzeug-Timeout entscheidet CI.
7. **Grenzen.**
   - Branch nach Mission: Anker TA-B2 auf `codex/ta-b2`, danach AP-01 auf `kreile/b2-eingang` (#154 ist erledigt).
   - Kein Merge und kein Production-Deploy durch Codex.
   - Nichts löschen, keine Secrets, keine alte Migration ändern.
   - Dev-DB-Migrationen nur additiv; danach belegen, dass die Migrationsliste der DB gleich dem Repo ist.
   - Eine App: ein Repo, ein Vercel-Projekt, eine Dev-DB (U-219).
   - Codex macht keine Klicktests; die macht die Owner (4d).
8. **Eingang eingefroren.** Nichts am Eingang bauen oder reparieren, bis dazu Arbeitspakete mit Status `bereit` vorliegen.
9. **Nicht härten, was die Endversion ersetzt (U-220).** Codex testet und repariert nur Aktionen, die der Planungschat als stabiler Stufe-1-Kern bestätigt hat. Alles, was auf der Ausnahmeliste als eingefroren, Stub, ersetzt, Legacy-außerhalb-Stufe-1 oder Stufe-2 steht, bleibt unangetastet und wird erst gebaut und getestet, wenn die Endversion es neu schneidet. Im Zweifel: nicht anfassen, als Frage an den Planungschat.
10. **Test schreibt nicht, wer den Code schrieb (U-221).** Der Abnahmefall je Fix (Eingaben → Soll-Zeile in der DB → Soll-Ansicht) wird vom lesenden Prüf-/Red-Team-Codex und vom Planungschat vorgegeben, nicht vom Bau-Codex. Der Bau-Codex erfüllt ihn, definiert ihn nicht. Nur der Bau-Codex schreibt auf dem Branch; der Prüf-Codex liest und urteilt, er baut nichts. Keine zweite schreibende Codex-Sitzung auf demselben Branch.
11. **Durchlauf statt Pingpong (U-224).**
   - Vor jedem Commit und PR läuft die komplette lokal ausführbare Strecke von `quality` und `agentur-gate`: authority-gate (+selftest), delivery-contracts (+selftest), package-scope-selftest, live-regression-selftest, module-gates, h18 (+selftest), h16 (+selftest), no-fake-production (+selftest), f0-doc-truth, supabase-client-boundary, `git diff --check origin/main` (Whitespace/Merge-Marker, muss leer sein), `npx tsc --noEmit --incremental false`, `npm run lint:full`, `npm run test:unit`. Alle Befunde werden **gesammelt** gemeldet, nie einzeln.
   - **Selbst lösen, dokumentieren, weitermachen** bei rein mechanischen Befunden: Import-Pfade/Dateiorte nach Gate-Regeln, Testselektoren, Fixture-Felder, Lint-Formalien, Benennung, Ablage im Planungsordner — solange der Akzeptanztest bytegleich bleibt, kein Gate/Workflow/Hash/`tsconfig.json` geändert und kein Produktverhalten anders als im Paket gebaut wird.
   - **Stoppen nur bei:** Änderung geschützter Checker/Workflows/Hashes/`tsconfig.json` über die freigegebene Liste hinaus; Lockern einer Regel; Inhalt eines Akzeptanztests; `createOrderIntake` oder bestehende Migrationen; fehlende Produktentscheidung; Merge/Deploy. Dann **alle** offenen Punkte in **einer** Meldung, je mit Empfehlung.

12. **Spec-Freeze je Paket (U-226).** Der Bauplan, den WORKQUEUE für das laufende Paket nennt (spec + SHA-256), gilt bis zu dessen Merge. Der Endversion-Chat ändert `docs/project/endversion/codex/BAUPLAN.json` nicht, solange ein Anker oder Paket offen ist; Änderungen legt er in `docs/project/endversion/codex/BAUPLAN.next.json` ab (nicht im Repo). Der Planungschat übernimmt sie beim nächsten Anker und nennt die neue SHA. Weicht die SHA im Arbeitsbaum von WORKQUEUE ab: Codex stoppt nicht, sondern meldet es und baut nach der WORKQUEUE-SHA, sofern diese Datei vorliegt; sonst Stopp.
13. **Wegeprüfung vor dem Bau (U-229).** Jedes Paket enthält eine Wege-Matrix: jeder Aufruf × Zustand × Aktion (Speichern/Buchen, Abbrechen, ×, Esc, Zurück, Ebene öffnen/schließen, Fehler, Doppelklick, ohne Recht) → sichtbare Anzeige + DB-Wirkung, abgeglichen mit `werkbank.interaktion`, `screens[].aktionen` und `verhalten_appweit`. Der Planungschat prüft sie vor der Übergabe; Codex baut und testet genau diese Matrix (realRender je Zeile). Vor jedem Owner-Klicktest läuft der Planungschat die Matrix selbst per Playwright auf der Preview genau dieses SHA (Codes nur aus Umgebungsvariablen).
14. **Paket ist abschließend (02.11.).** Gebaut wird nur, was das gültige Paket ausdrücklich nennt. Sagt der Bauplan mehr (z. B. Schlüssel statt Anzeigewerte, andere Tabellen, weitere Felder), wird das **nicht** im Vorbeigehen gebaut, sondern in NACHTLAUF C als „Bauplan > Paket: Stelle, Bauplan sagt, Paket sagt, Vorschlag“ gemeldet; der Planungschat entscheidet im Paket. Datenumstellungen (Schlüssel, Spaltenbedeutung) nur mit Datenmigration im selben Paket – nie nur für neue Zeilen.
15. **Eine Auftragsquelle (02.11.).** Gültig ist nur Abschnitt C dieser Datei; der Planungschat **ersetzt** ihn bei jeder Änderung (nichts anhängen). `_review/NACHTLAUF_2026-11-02.md` ist Protokoll: Codex meldet dort unter C, der Planungschat schreibt Befunde unter P. Ein P-Eintrag gilt als Auftrag nur, wenn C ihn nennt.
16. **Blocker und Weiterarbeit (02.11.).** Fehlt ein Pfad, eine Freigabe oder eine Entscheidung: in NACHTLAUF C melden (Pfad/Stelle, Grund, Vorschlag) und am nächsten Punkt von C weiterarbeiten. Ein Schritt „PR pushen“ wird trotzdem ausgeführt (CI-rot nur wegen fehlender Freigabe ist erwartbar und steht in der Abgabe) – sonst kann der Planungschat nicht prüfen.
17. **Meldetakt und Git (02.11.).** Nach jedem Commit eine Zeile in NACHTLAUF C (SHA, Inhalt, Tests). `git add` nur mit ausdrücklichen Pfaden; Planungsdateien (`_review/**`, `docs/project/arbeitspakete/**`, `docs/project/endversion/**`) nie stashen, stagen oder committen – außer unverändert im Anker. Previews nur aus Git, nie per CLI.
18. **PR-Status nur belegt (02.11. 23:55).** Den Zustand eines PR meldet Codex erst nach `gh pr checks <n>` über **alle** Jobs und deren Schritte (auch `h16-schema` → „Generated BAUPLAN flows“). „Erwartbar rot“ nur mit Run-Link, Schritt und Fehlerzeile. Was lokal grün ist, muss in CI mit demselben Befehl laufen; Abweichung CI ≠ lokal ist ein eigener Befund und wird vor allem anderen behoben.
19. **UI-Wahrheit (U-239, 03.11.).** Aussehen, Aufbau, Reihenfolge und Größen jedes Screens kommen **nur** aus `docs/project/endversion/ui/` (zuerst `LIESMICH.md` lesen): `endversion_design.css` wird **eingebunden, nicht abgeschrieben**; `SICHTVERTRAG.json` ist das Soll je Seite × Rolle × Größe (Kennungen `data-spec-id`, Texte wörtlich, Klassen wie dort, Hauptaktion in der Dialog-Fußzeile ohne Scrollen sichtbar, Knöpfe ≥ 44 px); `pruefbilder/` zeigen es. Keine eigenen Nachbauten in Tailwind/shadcn/globals.css, kein Mock-/Prototyp-Code, keine Musterdaten. Alte Layouts (z. B. Reiter-Werkbank „1 Kunde · 2 Positionen · 3 Prüfung“, dunkle 3.0-Kacheln) werden im Teil ihrer Seite gelöscht, nicht daneben weitergeführt. Server-Wege, Tabellen, Befehle und Tests bleiben. **Fertig heißt zusätzlich:** `node docs/project/endversion/ui/pruefe_sicht.cjs --app <READY-Preview genau des SHA> --routen docs/project/endversion/ui/routen.json --nur <Seiten des Teils>` grün (Gelb nur mit Grund in der Abgabe), Bericht in der Abgabe. Das Skript wird nie geändert.

## B. Stand (Planungschat, 03.11., 19:07)
- main mit #163/#164. **Runde 52 gebunden:** BAUPLAN `DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4` (spec `ee64f8882bb7`), UI `docs/project/endversion/ui/`: Bündel 35146E45, Sichtvertrag B1A53EA6, Prüfskript FDA7C59C, Referenz 1509BE93; Prüfbilder `ui/pruefbilder/` = Sichtvorlage. Größenregel U-240 (Desktop kompakt, Tablet dicht + Tastatur, Handy V8, Enter = nächstes Feld). Alle früheren Stopps sind aufgehoben; bis zum Ende von AP-EIN ändert sich die Vorgabe nicht (Spec-Freeze, Regel 12).

## C. Warteschlange – Durchbau (ersetzt alle früheren C-Fassungen)

**Ziel der Mission (nicht verhandelbar):** Eingang komplett – 13 Seiten aus paket.seitenkatalog, 306 Fälle grün, jede Seite in allen drei Größen gleich der Vorschau V41 (Sichtvertrag B1A53EA6 grün), echte Server-Wege und DB, kein Mock. Gebaut wird nur das, nichts daneben. Pilot 30.11.
**Sichtbericht:** immer mit --aus <Pfad außerhalb des Repos>; nie Berichte/Bilder in docs/project/endversion/ui/ schreiben. Gate geprüft: PIN-Login + Share laufen (Planungschat 19:10, Teil-1-Altstand rot wie erwartet).
1. **TA-B2f** nach `TRUST_ANCHOR_B2F.md` Abschnitt „Fassung Runde 52“: rebasen auf main, Probe gegen den obersten AP-EIN-Branch, ready, `gh pr checks` vollständig in C. Owner merged sofort.
2. **Teil 0 → 0b → 1 → 2 → 3 → 4 → 5 → 6** nach `AP-EIN-eingang-komplett/PAKET.md` (Fassung 3, Nachträge, Bindung Runde 52) ohne Pause, gestapelt, je Draft-PR. Oberfläche nach Sichtvertrag + Prüfbildern, Server/DB wie geplant, `geprueft` nach P39.
3. **Tempo-Regeln (Owner 03.11.):**
   - Ein Commit je fertigem Teil-Schritt (nicht je Kleinkorrektur); der volle Commit-Hook läuft damit selten. Zwischenstände lokal ohne Commit.
   - Je Teil genau ein vollständiger Lauf (A11 + Fälle der Seiten + `pruefe_sicht --nur <Seiten>`), dann Push. Kein Wiederholen unveränderter Läufe.
   - Ein Fixversuch je Befund; klemmt es fachlich: eine Zeile in C (Stelle, Bauplan sagt, Vorschlag), betroffene Fälle rot lassen, weiter. Der Planungschat entscheidet stündlich.
   - Meldungen in C kurz: SHA, Fälle grün/rot, Sicht-Ampel, offene Punkte. Keine Prosa.
4. **Sichtlauf mit PIN:** `routen.json` ohne PIN; Lauf mit temporärer Kopie außerhalb des Repos (PIN aus `<ROLLE>_PASSWORT`, Share aus Umgebungsvariable), Kopie danach löschen. Skript nie ändern.
5. Migrationen: je Teil eine Datei `*_ein<n>_*.sql`, Datei + SHA in C; Dev erst nach „Migration geprüft“ und Merge.
6. **Nie:** Merge, Dev ohne Freigabe, Vercel-CLI/Env, Secrets, `git stash`, Force-Push auf fremde Branches, Planungsdateien stagen (außer unverändert im Anker), Prüfwerkzeuge/Sichtvertrag/Bündel ändern, Beispieldaten aus Prüfbildern/Spec in Code, Seeds oder Tests, Gates außerhalb der Anker-Allowlist.

### C4 · H17 Produktions-DB – erst in der Woche vor Go-live
Erst nach dem Owner-Schritt (Supabase-Projekt anlegen, Vercel-Tarif für gewerbliche Nutzung). Ablauf genau nach `docs/delivery/GO_LIVE_ABLAUF.md`.

### Gesperrt bis nach Go-live
Stationsspalten, `tenant_features`, Tenant-Default, Drizzle-Angleich außerhalb der Paket-Tabellen, toter Code außerhalb eines ersetzenden Pakets, nächtlicher Bericht, Schreibpfade für `orders.payment_status`.
