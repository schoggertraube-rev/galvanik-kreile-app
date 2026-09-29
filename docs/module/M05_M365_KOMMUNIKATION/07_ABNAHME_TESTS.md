<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Abnahme und Tests

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-M05-001 | A-M05-023/024 | Given das eingefrorene Candidate-Verzeichnis, when alle 86 Dateien gehasht werden, then entspricht der Set-Hash exakt dem freigegebenen Candidate-Hash. | Smoke | am 2026-09-26 PASS: `DC26CD06043911EC1ACD13319DE84FF3FD2C904D41381EE8FCC94D354F3F74DF` |
| T-M05-002 | A-M05-001–012, 021–024 | Given unveränderte Candidate-Quellen, when die Node-Test-Suite seriell läuft, then bestehen alle Tests ohne Netz/Provider. | Smoke | am 2026-09-26 PASS: 76/76, 0 fail |
| T-M05-003 | A-M05-023 | Given Paket und Manifest, when Imports/Dependencies geprüft werden, then gibt es keine UI-, Netzwerk-, Provider-, Login-, Schema- oder Migrationsabhängigkeit. | Smoke | CAND Manifest/Report; bei Adoption erneut ausführen |
| T-M05-004 | A-M05-002/019 | Given zwei getrennte Kreile-Testscopes und eine gesperrte Person, when Read/Command versucht wird, then liefert jeder Scope-/Rechtsverstoß fail-closed ohne Daten. | E2E | FEHLT · HostAdapter |
| T-M05-005 | A-M05-003/004 | Given typed note und speech transcript sowie zwei gleichnamige Kunden, when Intake läuft, then entstehen sichere Fälle, aber keine Zuweisung ohne explizite Auswahl. | E2E | Candidate-Unitdeckung vorhanden; realer G05-E2E FEHLT |
| T-M05-006 | A-M05-005/006/028 | Given Mail mit Original und zwei Anhängen, when UDI vollständig attestiert, then werden nur Claims/Refs persistiert; bei fehlendem Original wird blockiert. | E2E | FEHLT · UDI/Document Original |
| T-M05-007 | A-M05-005/009 | Given spoof/quarantine/evidence drift, when Review oder Aktion versucht wird, then bleibt der Fall gesperrt und Konflikt wird sichtbar. | E2E | Candidate-Unitdeckung vorhanden; Host/UI FEHLT |
| T-M05-008 | A-M05-007 | Given mehrere Kandidaten und veraltete candidateSetVersion, when bestätigt wird, then wird stale confirmation abgewiesen. | E2E | Candidate-Unitdeckung vorhanden; G05-Port FEHLT |
| T-M05-009 | A-M05-008 | Given abgelaufener/verweigerter Disclosure-Grant, when Kontext gelesen wird, then enthält die Antwort keinen Fachinhalt und auditierbaren Denial. | E2E | Candidate-Unitdeckung vorhanden; G01/Owner-Ports FEHLT |
| T-M05-010 | A-M05-009/010 | Given bestätigter Routingvorschlag, when Owner-Command ausgeführt wird, then gilt Erfolg erst nach dauerhaftem Receipt plus Readback. | E2E | Candidate-Unitdeckung vorhanden; Customers/Orders/Quotes FEHLT |
| T-M05-011 | A-M05-010/011 | Given Timeout nach Submit, when Recovery läuft, then erfolgt kein blinder Resubmit und der Fall wechselt sichtbar zu unknown/escalated. | E2E | Candidate-Unitdeckung vorhanden; Durable Worker FEHLT |
| T-M05-012 | A-M05-012 | Given attestierte Eingangsmail, when Recipient/Draft nach Confirmation driftet, then blockiert Send; nur exakt bestätigte Revision darf passieren. | E2E | Candidate-Unitdeckung vorhanden; GraphAdapter FEHLT |
| T-M05-013 | A-M05-014/016 | Given das reale lizenzierte benannte Kreile-Büropostfach, when Subscription abläuft oder eine andere Mailbox-/Rechteart konfiguriert wird, then wird erneuert bzw. die Konfiguration abgewiesen und Delta reconciled. | E2E | FEHLT · externes Entra/Graph-Gate Q-M05-017 |
| T-M05-014 | A-M05-013/014 | Given Graph 429 mit Retry-After und Delta-Token, when Worker weiterläuft, then respektiert er Backoff, Concurrency und Cursor ohne Lücke/Duplikat. | E2E | FEHLT · reale Graph-Laufzeit |
| T-M05-015 | A-M05-015 | Given Graph sendMail antwortet 202, when Sent-Items-Readback noch fehlt, then zeigt die App nicht „gesendet“; erst passender Readback bestätigt. | E2E | FEHLT · reale Graph-Laufzeit |
| T-M05-016 | A-M05-021 | Given Upsert, Revoke, Sequence-Lücke und abgelaufene TTL, when G02/G08/M02 konsumieren, then sind Rohinhalte abwesend und Sichtbarkeit/Health korrekt. | E2E | Candidate-Unitdeckung vorhanden; Projektionsempfänger FEHLT |
| T-M05-017 | A-M05-022 | Given Ablauf der dokumentartspezifischen Frist, when Retention läuft, then entsteht zunächst nur ein Vorschlag; erst Admin-Freigabe tombstoned/anonymisiert M05-Inhalt, Evidenzmetadaten bleiben prüfbar und Microsoft-Postfach sowie Owner-Daten unverändert. | E2E | Candidate-Unitdeckung vorhanden; externe Bestätigung Q-M05-016 und reale Key-/Store-Laufzeit FEHLT |
| T-M05-018 | A-M05-017 | Given Modul ist nicht adoptiert, when Navigation und Direkt-URL geprüft werden, then existiert kein Ziel und `/kommunikation` ist 404/fail-closed; graue Elemente sind nicht klickbar. | E2E | Repo-Inventar: keine Page; Phase-1b-Grundstammelement FEHLT |
| T-M05-019 | A-M05-018 | Given Phase-1b-Prototyp, when alle acht Einbettungs-Screens auf drei Geräten geprüft werden, then sind alle sieben Zustände, 48-px-Touch und Tastatur/Screenreader abgenommen. | Owner-UX | FEHLT · Designphase 1b/Q-M05-003 |
| T-M05-020 | A-M05-020 | Given jeder Konflikttyp K-M05-001–010, when er auftritt, then erscheint er genau oben im Dringlichkeitsbereich der zuständigen Startseite von Rolf/Phillip oder im Systemzustand bei Gregor und ist auflösbar. | Owner-UX | FEHLT · Zuständigkeitsmatrix/Q-M05-012 |
| T-M05-022 | A-M05-027 | Given mehrere E-Mail-/Telefonfälle desselben bestätigten Kunden, when Kundenkarte/Suche öffnet, then sind alle auffindbar, bleiben aber getrennte evidenzgebundene Fälle. | Owner-UX | FEHLT · Q-M05-006 |
| T-M05-023 | A-M05-024 | Given irgendein offenes Adoption-Gate, when Transfer versucht wird, then wird die gesamte Adoption abgewiesen; es entsteht kein Teilprodukt. | Smoke | CAND `ATOMIC_ADOPTION.md`; Gate-Automation FEHLT |
| T-M05-024 | Gesamtfreigabe | Given geschlossene Anbindungsfragen und externe Gates, unabhängiger Opus-/Dossierreview und echte Host-/Graph-E2Es, when Owner-Transfergate läuft, then wird exakt ein atomarer, reproduzierbarer Adopt/Build-Weg freigegeben. | E2E/Owner-UX | FEHLT; Dossier-BAUBEREIT ist keine Gate-Freigabe |
| T-M05-025 | A-M05-029 | Given Microsoft-Notification und fälliger Recovery-Job, when Vercel-Route und Supabase Cron laufen, then schreibt die Route nur idempotent in die DB-Outbox und der Worker verarbeitet mit Receipt/Lease ohne Verlust oder Doppelwirkung. | E2E | Laufzeitlinie GEKLÄRT Q-M05-001; Tabellenentscheidung FEHLT Q-M05-018 |
| T-M05-026 | A-M05-030 | Given Dev und Production, when Umgebungsbindung geprüft wird, then enthält Dev nur synthetische Daten, Production gehört Kreile und der Dev-E2E wurde im Kreile-Tenant wiederholt. | E2E/Owner-UX | FEHLT · externes Ressourcengate Q-M05-017 |
| T-M05-027 | A-M05-031 | Given erkannter Terminverschiebungswunsch, when die Person bestätigt, then erhält das Auftragsobjekt genau einen Command mit Receipt/Readback und die zuständige Startseite den Konflikt, ohne Kalendernavigation. | E2E | FEHLT · Owner-Port Q-M05-004 |

## Abnahmefolge

1. Candidate-Hash, Test-Suite, P2 und unabhängiges Opus-Schlussgate schließen.
2. Persistenz-/Hostport- und Datenbesitzentscheidungen schließen; Verträge mit G01/G04/G05/G06/G08/G09/G10/M01 festschreiben und M06 vor M05 bereitstellen.
3. Phase 1b auf drei Geräten inklusive aller sieben Zustände abnehmen.
4. HostAdapter mit echter dauerhafter Persistenz, Recovery und Projektionsverbrauchern E2E prüfen.
5. Kreile-eigene Entra/Graph/Azure-/Supabase-Ressourcen nach Owner-Freigabe inventarisieren und echten Mail-In/Draft/Send/Readback-E2E im Kreile-Tenant abnehmen.
6. Datenschutz/Retention, Back-up/Restore, Störung und Cross-Tenant testen.
7. Erst danach atomare Adoption und Owner-Transfergate; kein Production-Promotion-Schritt in diesem Dossier.
