<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G05 Kunden — Akzeptanz- und Testmatrix

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-G05-001 | A-G05-001, A-G05-020 | Given zwei Tenants und leseberechtigte Person, when `/customers` geladen wird, then erscheinen nur reale Kunden des aktiven Tenants. | E2E | erweitern: `src/test/path1_customers_read_states.test.tsx`; Code `29054864491E` |
| T-G05-002 | A-G05-002 | Given Bestandskunden, when Name/Kundennummer/Ort gesucht und Treffer gewählt wird, then öffnet genau dessen `/customers/[id]` ohne Neueingabe. | E2E | `src/modules/customers/__tests__/CustomerSurfaces.v2.test.tsx` plus neuer Router-E2E |
| T-G05-003 | A-G05-003, A-G05-011 | Given Kunde mit/ohne aktive Aufträge, when Karte geladen wird, then stammen Kundenfelder aus G05 und Aufträge ausschließlich aus dem Orders-Read-Port. | E2E | `CustomerSurfaces.v2.test.tsx`; View `5F6D5BB6FEFB` |
| T-G05-004 | A-G05-004, A-G05-023 | Given jeder definierte Read-Zustand, when Liste/Karte rendert, then steht der exakte Text aus `02` und es erscheinen keine Fake-Daten/aktiven Attrappen. | Smoke | `path1_customers_read_states.test.tsx`; Owner-UX für In-Aufbau/In-Klärung ergänzen |
| T-G05-005 | A-G05-005 | Given gültige Anlage und Idempotency-ID, when Command zweimal identisch ausgeführt wird, then existiert genau ein Kunde/eine Kundennummer und beide Aufrufe referenzieren dasselbe Receipt. | E2E | `src/modules/customers/__tests__/createCustomerCommand.test.ts`; Migration `0FD379886555` |
| T-G05-006 | A-G05-006 | Given Timeout nach serverseitigem Commit, when UI keinen Readback hat, then zeigt sie keinen Erfolg und nimmt mit derselben Idempotency-ID wieder auf. | E2E | `e2e/path1-ui-convergence-v5-global-create.spec.ts`; Negativfall ergänzen |
| T-G05-007 | A-G05-007 | Given Kunde ohne Straße/PLZ/Ort, when Rechnung oder Versand abgeschlossen werden soll, then blockiert der Server und benennt fehlende Felder. | E2E | Rechnung vorhandenen Test beibehalten; Versandtest neu erforderlich |
| T-G05-008 | A-G05-008, A-G05-009 | Given Kundenanlage, when Anschrift/Kontakt/Präferenz erfasst und bestätigt werden, then Readback enthält dieselben normalisierten Werte. | E2E | neuer Create-Command- und Flow-Test nach Vertragserweiterung |
| T-G05-009 | A-G05-010 | Given keine beziehungsweise vorhandene persistierte Notiz, when Karte lädt, then erscheint der definierte Leertext beziehungsweise exakt der gespeicherte Inhalt. | Smoke | `CustomerSurfaces.v2.test.tsx` erweitern |
| T-G05-010 | A-G05-012 | Given Öffnen aus Kundenliste und Auftrag, when Zurück gewählt wird, then landet die Person jeweils an der vorherigen Stelle mit erhaltenem Kontext. | E2E | neuer Backstack-E2E |
| T-G05-011 | A-G05-013 | Given potenzielle Dublette, when Anlage geprüft wird, then erscheinen Kandidaten mit Gründen und es findet kein Auto-Merge statt. | E2E | nach Q-G05-001; Legacy-`DuplicateWarning` allein ist kein Beleg |
| T-G05-012 | A-G05-014 | Given zwei Bearbeiter mit gleicher Ausgangsversion, when beide ändern, then wird nur der erste bestätigte Command geschrieben und der zweite erhält Konflikt statt Überschreiben. | E2E | nach Q-G05-002 neu |
| T-G05-013 | A-G05-015, A-G05-016 | Given Rohnotiz mit mehreren/mehrdeutigen Fakten, when gespeichert wird, then bleibt Snapshot unverändert und nur einzeln bestätigte Fakten werden verknüpft. | E2E | nach Q-G05-003 neu; bestehende Actions `0684A6E7F7D0` sind Negativbeleg |
| T-G05-014 | A-G05-015 | Given Analyse/Provider nicht verfügbar, when Telefonnotiz erfasst wird, then geht der Rohtext nicht verloren und es wird kein Analyseerfolg behauptet. | E2E | nach Q-G05-003 neu |
| T-G05-015 | A-G05-017, A-G05-018 | Given fällige und rechtlich noch gebundene Daten, when Retentionlauf prüft, then entsteht nur für fällige Daten ein Vorschlag und ohne Adminfreigabe keine Änderung. | E2E | nach Q-G05-006 neu |
| T-G05-016 | A-G05-017, A-G05-019 | Given freigegebene Anonymisierung, when Command erfolgreich ist, then sind Personenmerkmale nicht re-identifizierbar, Geschäftszahlen erhalten und Receipt/Readback belegt. | E2E | nach Q-G05-006 neu |
| T-G05-017 | A-G05-020 | Given fehlende Rechte, falscher Tenant oder manipulierte ID, when Read/Create/Update aufgerufen wird, then ist die Antwort fail-closed und ohne fremde Daten. | E2E | Create-/Read-Tests vorhanden; Update/Phone-note nach Freigabe ergänzen |
| T-G05-018 | A-G05-021 | Given Dublette, Versions- oder Receiptkonflikt, when erkannt, then erscheint ein deduplizierter Eintrag im Startseiten-Konfliktbereich mit Rolf/Phillip und Auflösungsaktion. | E2E | neuer Host-Port-/Konflikt-E2E |
| T-G05-019 | A-G05-022, A-G05-023 | Given Desktop/Tablet/Handy, when Kunde-Liste/Karte/Create visuell geprüft werden, then werden nur freigegebene `kr-`-Komponenten/Tokens genutzt und Attrappen sind nicht klickbar. | Owner-UX | nach Designphase 1: Screenshot-/Kontrast-/Interaktionsreview |
| T-G05-020 | A-G05-024 | Given ungeklärter Fotospeicher, when Kundenkarte geöffnet wird, then zeigt der Bereich nicht klickbar `In Klärung` und erzeugt keinen Request. | Smoke | neuer Render-/Network-Negativtest |
| T-G05-021 | A-G05-025 | Given kundenspezifisches oder Standard-Zahlungsziel, when Kunde/Rechnungsübergang gelesen wird, then gilt genau die reale Konfiguration und Änderung ist nachvollziehbar. | E2E | nach Q-G05-008 neu |
| T-G05-022 | A-G05-026 | Given Modul-Boundary-Check, when G05 und Host kompiliert/geprüft werden, then enthält der Kern keine Kreile-only-Begriffe und keine privaten Fremdimporte. | Smoke | Boundary-Test/Import-Scan ergänzen; Manifest `63F9F9BA042C` |

## Gate-Regel

- Bestehende Tests sind nur Beleg für den verifizierten Ist-Stand, nicht für die noch offenen Funktionen.
- Jede freigegebene Q-ID zieht die zugehörigen als „neu“ markierten Negativ-, Receipt-, Tenant- und Wiederaufnahmetests nach sich.
- Owner-UX prüft nicht nur Screenshots, sondern auch Nicht-Klickbarkeit, Zustandskopien, Tastaturfokus und die Abwesenheit synthetischer Daten.
