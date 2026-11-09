# SA-Korrektur – Zwischenstand

Basis: main 0e85c86a, PL-Prüferhalt 09.11., Punkte 1–7. Noch nicht abnahmefähig.

## Behoben: Punkte 1, 4 und 5

- Zuständigkeit ausschließlich aus einer belegten aktiven Zuweisung; der Anleger bleibt historischer Akteur. Ohne Zuweisung zeigt die Karte „Noch niemand zuständig“ und bietet den bestehenden Übernehmen-Befehl.
- Dringlichkeit und tatsächlicher Termin haben auf der Startseite Vorrang vor persönlicher Zuständigkeit. Reklamationsersteller gelten nicht ersatzweise als Zuständige.
- Ein beschädigter Zuweisungsbeleg entfernt ausschließlich die ungültige Zuständigkeitsinformation. Der Auftrag bleibt auf der Startseite; ein Diagnoseereignis mit Auftrag und Login wird protokolliert. Ein Fehler der Diagnoseablage bricht die Startseite nicht ab.

## Nachweise

Echter Replay-Test `kv_v04_server.integration.test.ts`, Fall `AK order`: PASS (8,37 s). Zwei tatsächliche Logins, bestehender Zuweisungswriter, DB/Ereignis/Karte; anschließend absichtlich beschädigter isolierter TEST-Beleg: der echte Startseitenleser liefert den Auftrag weiter und das Diagnoseereignis wird aus der DB nachgelesen. Testbeleg anschließend wiederhergestellt. Mechanische Fixturekorrektur: Termin heute statt eines zukünftigen Termins, damit die Startseite diesen Auftrag tatsächlich enthält.

Zwei gezielte SA-Korrektur-Render/Sortierfälle: PASS. Typprüfung und Lint der berührten Dateien: grün. Keine lokale Gesamtsuite.

## Offen vor ready

PL-Punkte 2, 3, 6, 7 vollständig bearbeiten; CI, exakte READY-Preview, einmaliger Sichtlauf und unabhängiges PL-Review. Die Statistik und übrige Servermeldungen sind mit diesem Zwischenstand ausdrücklich nicht abgenommen. Kein Merge durch Codex.

## Tatsächlicher Aufgabenempfänger

`taskService` verwendet ausschließlich `tasks.fuer_login` für „Deins“. Nachfassen mit Bereichsempfänger gehört nicht automatisch dem KV-Anleger. Der echte AK-02-Replay liest die generierten Aufgaben, weist sie über den vorhandenen UI-Action jeweils der anderen Person zu und liest für beide Logins neu: tatsächlicher Empfänger zuerst, alle Aufgaben bleiben sichtbar. PASS7,69s. Mechanische Fixturekorrektur: eine Person und ein Bereich sind laut unverändertem Aufgabenvertrag gegenseitig ausgeschlossen; der Test sendet wie die UI `forArea:null`. Typprüfung und betroffene Lintprüfung grün.
