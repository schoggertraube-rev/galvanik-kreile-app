# AP-SITUATION-AKTEUR Teil B — Baufortschritt, noch keine Merge-Abgabe

Basis main ba6e0d94, eigener Branch codex/situation-akteur. PL 08.11.21:30 bindet Teil B: vorhandener Assignment-Writer am Auftrag, eigene Statistik; Admin darf alle Personen sehen. Teil A bleibt bis zur Eingang-Modulfreigabe gesperrt. Die Korrektursammlung wurde nur zum Paketstart gelesen.

## Umgesetzt

- Auftrag: Anlage, letzte Handlung und bestehende Zuständigkeit aus echten Ereignissen. Übernehmen nutzt ausschließlich assignOrderTaskAction. DB-Zeile, Ereignis, Retry ohne Duplikat und Neulesen derselben Karte gegen echte Replay-DB geprüft. Meldungen stehen unmittelbar am Knopf.
- KV und Reklamation: beide Akteure aus vorhandenen Ereignissen, aktuelle Version und Besitzerrechte bleiben maßgeblich. Ein echter KV-Test fand eine falsche Letzter-Akteur-Reihenfolge bei gleicher Uhrzeit: fachliche Ereignisversion/Lifecycle entscheidet jetzt vor Zufalls-ID. Unveränderter Gegenfall danach grün.
- Eingang, Nachrichten und Beleg: vorhandene intake_event, keine zweite Auditablage. Namensauflösung über Core-Port, keine fremden Benutzer-Tabellenzugriffe im Eingangsmodul. Belegersteller ist der tatsächliche Rechnungsspeichernde, nicht der frühere Dateiimporteur. Fehlende Altbelege bleiben unbekannt, kein erfundener Systemnutzer.
- KV-Nachfassaufgaben: eigene zuerst, andere bleiben sichtbar; keine neue Aufgabenablage. Zuständigkeitsübernahme außerhalb des Auftrags nicht neu gebaut.
- Ein reiner Statistik-Leseport gruppiert Person, Berliner Zeitraum, Vorgangsart und tatsächliche Handlung. Öffentliche Ereignisse und Eingangsereignisse kommen über ihre Besitzerports; keine neue Server-Action, Tabelle, Migration oder Statistikoberfläche.
- Neuer Unit-Wächter prüft direkte SQL-/ORM-Ereigniseinfügungen auf gebundene Login-ID; absichtlich fehlende/gefälschte Akteure werden abgewiesen. Das ist kein Nachweis, dass jede beliebige bestehende schreibende Action überhaupt ein Ereignis erzeugt: H18 behält unverändert 149 Schreibwege, 90 getestet, 59 Ausnahmen. AK-04 in dieser weitergehenden Bedeutung bleibt offen.

## Gezielt geprüft

Echte Replay-DB, keine Writer-Mocks: KV A legt an/B sagt zu (U249 PASS7.93s); Auftragsübernahme/Retry/Statistik und Nachfassen-Sortierung (2 PASS8.71s); Reklamation A erfasst/B entscheidet (PASS7.04s); Eingang A erfasst/B ändert sowie Belegimport A/echte Rechnungsspeicherung B. Nach Umstellung der Benutzerauflösung auf Core-Port die drei betroffenen Fälle zusammen erneut PASS8.45s. Letzte Statistik-Gruppierung allein PASS5.56s. Isolierte synthetische Original-/Fotometadaten sind ausdrücklich kein Nachweis für echten Storage-Upload. Render: KV-Akteure PASS3.07s, Auftragsmeldungen PASS6.19s. Ereigniswächter 2 PASS3.30s. Keine lokale Gesamtsuite.

## Offene Befunde / kein Merge-Claim

1. Die ausdrücklich freigegebene Admin-Statistik kollidiert mit dem geschützten H16-Verbot jedes neuen Rollenvergleichs. Die drei bestehenden H11c-Ausnahmen erlauben diese Stelle nicht; Inline-Ausnahme ist deaktiviert. Keine Linter-Umschreibung oder Gate-Lockerung. Gebündelte PL-Meldung im BAULOG, direkter Vergleich bleibt im Draft als sichtbarer roter Befund, nicht als bestanden ausgegeben.
2. Modul-Gate meldet DESIGN_POINTER_PAGE_BINDING aus fremden uncommitteten Planungsquellen. Diese Dateien werden nicht verändert oder mitcommittet. Eigene Fremdtabellenzugriffe wurden durch Core-Port ersetzt; finalen Gate-Log gesondert beachten.
3. AK-04 umfassender Wächter gegen ereignislose Schreibaktionen und allgemeine Anliegen-Sortierung außerhalb der KV-Nachfassliste stehen aus. Bestehende H18-Ausnahmen nicht ausgeweitet.
4. Sichtlauf/pruefe_sicht und finale CI/READY-Preview exakt am Kandidaten stehen aus. Daher Draft, keine Owner-Merge-Bitte, kein Livefähigkeitsclaim. Teil A und Belegautomatik bleiben eigene spätere Arbeit.

Keine Echtdaten geändert, keine Remote-Migration ausgeführt, keine vorhandene Assertion entfernt oder geschwächt. Bestehende Pakettests nur um tatsächliche Akteur- und Sortierungsnachweise ergänzt; neue Fixturegrenzen ausdrücklich isoliert.

## Fortschreibung 08.11. 22:13

Owner-Merge #202 d25a35aa in den Arbeitszweig integriert; beide Seiten der Konflikte (insbesondere AF19, KV-Historie und alle neuen Assertions) erhalten. Rebase war wegen einer fremden unverändert markierten CRLF-Datei nicht möglich; normale lokale Main-Integration erhält stattdessen die veröffentlichte Historie. Kein PR-Merge durch Codex. Fremde Planungsbytes gesichert und unverändert wiederhergestellt.

Deins-zuerst gilt jetzt auch für auftragsbezogene Anliegen (aktive bestehende Zuweisung vor erstem Ereignis), Reklamationen und KV-Nachfassaufgaben. Nur Reihenfolge, keine Ausblendung. Ein gebündelter Core-Leser verwendet dieselbe vorhandene geprüfte Zuweisungsview. Echter Übernahme-/DB-/Karten-/Zuständigkeitsfall PASS7.44s; U249 nach Main-Integration beide Fälle grün. Gezielte kombinierte AK/AF18/AF19-Renderfälle 3 PASS10.40s.

AK-04 zusätzlich gegen tatsächliche Replay-DB: absichtlich ereignisloser synthetischer Schreibweg ändert eine echte TEST-Kundenzeile, der Belegwächter erkennt WRITE_WITHOUT_LOGIN_EVENT, anschließend Rollback und unveränderte Zeile nachgelesen (PASS1.15s). Derselbe Wächter akzeptiert die echte bestehende Übernahmeaction mit DB-Zeile und Login-Ereignis. Dies hebt keine der 59 bestehenden H18-Ausnahmen auf und behauptet keine pauschale Abnahme aller Altaktionen.

Preview 5004437a war READY (jp7ubnavd), erster Browserlauf zeigte Auftragskarte und Akteure; zweite Automatik scheiterte am Ziel/Locator, daher kein erfolgreiches Bildpaar und keine vollständige Sichtabnahme. Der kommende integrierte Kandidat braucht einen eigenen exakten Preview-Nachweis. Admin-H16-Entscheidung weiterhin offen; keine neue Frage an die Owner.

## Fortschreibung 08.11.22:41
W4 behoben durch Verlagerung in den vorhandenen registrierten Assignment-Leser; kein Inventar/Gate verändert. Der bei der Verlagerung fehlende reine Transaktionstypimport wird mechanisch ergänzt. Fehlende Anlageereignisse in KV/Rekla/Beleg stehen ausdrücklich sichtbar; neuer Renderfall grün.
Echter read-only Rolf-Sichtlauf am exakten 056632ce / READY20n6gdsyr: gespeicherter Auftrag Desktop1220/Handy390, Akteure sichtbar, beide Bilder unter TEMP/kreile-sa-sight-20261108 kontrolliert. Vorheriges Skript wartete nicht auf den registrierten UI-Empfänger und nutzte den falschen Dialog-Locator. Kein Produktlogin/Writer gemockt, keine Dev-Zeile verändert. Sonderzustände und vollständiger Sichtprüfer weiter offen; Admin-H16-Entscheidung bleibt offen. Kein Merge-Claim.

## Regelmigration 08.11.23:05 — weiterhin Draft

Der am 22:02 gebündelt vorgeschlagene enge Ausnahmeweg wurde nach Ablauf der 60 Minuten gemäß BAUREGELN3.1 konkret umgesetzt. Kein Laufzeitrecht geändert: unverändert eigener Login / nur vorhandene Rolle admin bei all=true, wie PL21:30 entschied. Die H16-Regel bleibt aktiv. Neu erlaubt ist ausschließlich die unveränderte Expression actor.role!==admin (mit ihrem tatsächlichen Quelltext) in quoteJournalPort.ts, darin genau Funktion actorStatisticsScope und nur mit angrenzendem dokumentiertem U250-Marker. Die drei alten Ausnahmen bleiben unverändert. Selbsttest lässt falsche Funktion, falsche Datei und fehlenden Marker weiter rot. Lokaler Selbsttest/Lint/Scope grün, keine Fehlerzahl oder Baseline erhöht.

Wichtige Liefergrenze: der geschützte CI-Ratchet verwendet das Plugin von main. Die neue Kandidaten-Ausnahme kann diesen Richter vor dem Merge nicht ändern; dort bleibt der direkte Rollenvergleich erwartbar rot. Neuer Beleg samt konkreter enger Migration im BAULOG für den Planungschat. Kein automatischer Override, keine Merge-Bitte, keine Behauptung vollständig grüner CI. Die Pflicht zur Planung-Diff-Abnahme bleibt bestehen.

Unveränderter Sichtprüfer am Produktstand056632ce nach einer mechanischen Routenkorrektur: sechs rote ORDER_RECEIVER_NOT_READY-Navigationsfälle; fehlende Rekla/Beleg-Routen als Gelb offen. Nicht als Gesamt-Sichtpass ausgegeben. Der getrennte echte read-only Auftrags-Akteur-Lauf1220/390 ist belegt und visuell kontrolliert. Kein weiterer Harness-Wiederholungslauf.


## PL-Entscheidung 09.11. 00:01 umgesetzt

Die oben beschriebene temporäre H16-Ausnahme ist vollständig entfernt: Plugin und Selbsttest wieder bytegleich origin/main. Keine Regel-/Ratchet-/Baseline-Migration. Der Statistikleser prüft ausschließlich das vorhandene Rechtesystem, Bereich `statistik_alle`. Im kanonischen Register als Admin-Vorlage geführt, Entwickler-Geschäftsgrenze beachtet. Tatsächliche effektive Rechte bleiben maßgeblich: Admin ohne erteiltes Recht wird abgewiesen. Keine Task-Empfängergruppe daraus erzeugt.

Additive Migration 20261108230500_actor_statistics_access_area.sql erweitert den bestehenden Rechte-Constraint und ergänzt fehlende Admin-Standardrechte ohne alte Rechte zu verändern. Dev-Abbruchprobe inklusive Rechte-/Constraint-/Migrations-Snapshot PASS; vorhandene Rechte unverändert. SA-Branch104 + zuvor freigegebene RM-Vorlage20261108222500 = gemeinsame freigegebene Union105 = Dev105. Branch allein nicht gleich Dev behauptet (PL00:01 additive Differenz bestätigt). SHA-2568579c680fff783d3bbe094751909def0ef70ddfa7d299eae60189f4878ab7c34.

Echter AK-Auftrag-Replay: zwei Logins, Anlage, Übernahme, eigene Statistik, fremde Statistik abgewiesen; Admin ohne Recht abgewiesen, mit dem tatsächlichen Recht beide Akteure gelesen. PASS7,20s. Geschützter H16-Selbsttest PASS. Neuer Kandidat benötigt CI/READY-Nachweis und Planungs-Diffprüfung; keine Merge-Bitte vorweg.


## Gezielte CI-Korrektur 09.11. 00:23

Ratchet am da34d413 bereits grün. Zwei neue konkrete Befunde behoben: statischer Import des Rechtehelfers initialisierte in bisher DB-freien Quote-Tests die Datenbank. Die unveränderte reine hasAuthorizationArea-Funktion liegt nun einmal im bestehenden kanonischen Register; der bisherige Serverport re-exportiert genau diese Funktion. Keine zweite Rechteauswertung und keine neue Policy. 41 betroffene Quote-/Settings-/Autorisierungstests PASS.

Bestehende Assertion SettingsAppAdapter: blockierte Entwickler-Geschäftsrechte Anzahl7 →8 wegen neuem Recht statistik_alle; zusätzlich explizit die neue Zeile Statistik aller Personen geprüft. Alle bisherigen Sperr-/Haken-Assertions bleiben erhalten. Dies ist die einzige bestehende Assertion-Änderung dieses Fixes.

Fresh-Rot am da34d413: Storage lieferte in sämtlichen zwölf vorbereitenden HTTP-Fällen502, bevor Produkttests starten konnten. Kein Produktcheck abgeschwächt; neuer Fix-Kandidat startet regulär neue CI. Falls dessen Fresh erneut ausschließlich Infrastruktur meldet, gilt die vorhandene einmalige Neustartregel.
