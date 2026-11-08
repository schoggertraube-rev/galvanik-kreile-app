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
