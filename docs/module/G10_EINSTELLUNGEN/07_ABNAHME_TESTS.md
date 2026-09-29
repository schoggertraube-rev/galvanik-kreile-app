<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 07 — Abnahme und Tests

Alle Testdaten sind synthetisch, als solche markiert und tenantisoliert. `Soll:` bezeichnet neu anzulegende Tests; vorhandene Hashes sind nur Ist-Belege, keine Behauptung, dass der Solltest bereits besteht.

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-G10-001 | A-G10-001 | Given keine, falsche oder doppelte Produktbindung, when `/settings`, then Redirect `/start` ohne Inhalt. | E2E | Ist: `SettingsAppAdapter.test.tsx` `277ABB0D5C9D`; Soll: Real-Auth-Negativtest |
| T-G10-002 | A-G10-002 | Given Rolf, Phillip, Gregor, when Login, then nur Gregor landet `/settings` und die anderen auf ihrem Home. | E2E/Owner-UX | Ist: `SettingsAppAdapter.tsx` `D5C04CD018C6`; Soll: Rollenbrowsermatrix |
| T-G10-003 | A-G10-003 | Given drei Viewports, when alle G10-Screens, then V5-Typografie/Farben, Fokus und Touchziele ≥48 px. | Owner-UX | V5 `75258FF3BD4C`; Soll: Visual-/A11y-Suite |
| T-G10-004 | A-G10-004 | Given je Funktion sieben Fixtures, when Render, then exakt alle Texte/Zustände aus `02`. | Smoke/E2E | Soll: `settings.states.test.tsx` + Browserzustandsmatrix |
| T-G10-005 | A-G10-005 | Given Tenant A/B, when Actor A IDs von B liest/schreibt, then leer/forbidden und keine Mutation. | E2E | Soll: `settings.tenant-isolation.integration.test.ts` plus RLS-Negativtest |
| T-G10-006 | A-G10-006 | Given gleiche `clientEventId` und veraltete Version, when Command wiederholt, then identisches Receipt beziehungsweise Conflict ohne Doppelwrite. | E2E | Soll: Command-Contract-Integration je Write |
| T-G10-007 | A-G10-007 | Given neue Person, when effektive Fähigkeiten gelesen, then alle freigegeben; nach Admin-Deny/Allow nur Zielperson geändert. | E2E | Soll: `personAccessPolicy.integration.test.ts` |
| T-G10-008 | A-G10-008 | Given inherit/deny/allow, when Rechteansicht, then `Standard`, `Gesperrt`, `Erweitert` statt Rollenmatrix. | Smoke/Owner-UX | Soll: `PersonAccessSettings.test.tsx` |
| T-G10-009 | A-G10-009 | Given Nicht-Admin, Cross-Tenant und parallele Adminwrites, when Änderung, then denied/conflict; gültiger Write hat Audit/Receipt/Readback. | E2E | Soll: `updatePersonAccess.integration.test.ts` |
| T-G10-010 | A-G10-010 | Given null, eine oder zwei Firmenzeilen, when Read/CreateInvoice, then nur exakt eine vollständige Zeile gilt. | E2E | Ist: F1.4 Migration `BE493C63FD88`; Soll: G10-Readporttest |
| T-G10-011 | A-G10-011 | Given jedes F1.4-Pflichtfeld einzeln leer, when Rechnung, then fail-closed mit Feldhinweis; vollständig then erlaubt. | E2E | Ist: `w2cCompanySettings.failClosed.test.ts` `1791038F7B74`; F1.4 Migration |
| T-G10-012 | A-G10-012 | Given bestätigtes Profil und vollständige/unvollständige Ausstellerdaten, when Validator, then gültig beziehungsweise feldgenau gesperrt. | E2E/Owner-UX | Soll nach Q-G10-004: ZUGFeRD-Validator-E2E |
| T-G10-013 | A-G10-013 | Given alle G10-Flows, when DOM/Logs/Receipts exportiert, then keine Secret-Werte, Mailboxinhalte oder Zugangsdaten. | E2E | Soll: Secret-redaction-Test |
| T-G10-014 | A-G10-014 | Given Admin und Katalogposition, when create/update/deactivate, then View, Version, Receipt und Readback stimmen. | E2E | Ist: Extra-Work-Migration `3A38310E5E57`, Command `458B7C330605`; Soll: G10-Kompositionstest |
| T-G10-015 | A-G10-015 | Given alter Stundensatz, when neuer Centbetrag, then Current-View neu und Historie unverändert. | E2E | Ist: Extra-Work-Migration/Command; Soll: Settings-UI-E2E |
| T-G10-016 | A-G10-016 | Given Q-G10-005 offen, when Katalogkarte, then nicht klickbar und kein Request an `items`/`price_lines`. | Smoke/E2E | Soll: closed-capability network assertion |
| T-G10-017 | A-G10-017 | Given reale Sequenzreads, when Nummernkreise, then getrennte `A-`/`R-`-Karten mit Jahr/letztem Wert/Vergabezeit. | E2E | Soll: `numberSequenceReadPort.integration.test.ts` |
| T-G10-018 | A-G10-018 | Given parallele Auftrags-/Rechnungserstellung, when Abschluss, then eindeutige Nummern und kein G10-Edit-/Reset-Endpunkt. | E2E | Ist für `R-`: F1.4; Soll für `A-`: RT-15-Paralleltest plus Route-surface test |
| T-G10-019 | A-G10-019 | Given Abholung oder sonstiger Fall, when Regelread, then Methoden bar/Karte beziehungsweise Modus Vorkasse; nie freie Zielrechnung. | E2E/Owner-UX | Soll: PaymentPolicy-Matrix OE-2609-07 |
| T-G10-020 | A-G10-020 | Given Kunde ohne/mit Freigabe, when Zielrechnung, then serverseitig gesperrt/erlaubt nur für diesen Kunden. | E2E | Soll: G05/G07 `invoiceOnAccountPermission.integration.test.ts` |
| T-G10-021 | A-G10-021 | Given aktive Policy, when Zielrechnung, then 200 Basispunkte, 10 Skontotage und 14 Netto-Tage im neuen Snapshot. | E2E | Soll: PaymentPolicy→Invoice-Snapshot-Test |
| T-G10-022 | A-G10-022 | Given bestehende Rechnung, when Firmen-/Payment-Policy geändert, then Snapshot/PDF-Hash unverändert. | E2E | F1.4-Unveränderlichkeit plus Soll-Regressionsfall |
| T-G10-023 | A-G10-023 | Given kein M01-/Owner-Gate, when Terminalkarte, then `In Aufbau`, kein API-Aufruf; manuelle Bestätigung bleibt. | Smoke/E2E | Soll: network-negative terminal test; Ist-Stub `CB7EEF25D933` |
| T-G10-024 | A-G10-024 | Given Policy je Dokumentart, when View, then Quelle, Beginn, Ende, Hemmung und Aktion sichtbar. | Smoke/E2E | Soll nach Q-G10-007: RetentionPolicy-Readtest |
| T-G10-025 | A-G10-025 | Given vier Dokumentarten, when Fristberechnung, then 8/6/3 Jahre und Jahresendregel korrekt; Hemmung verlängert. | E2E | Soll: datengesteuerter Fristen-Test; OP-13-Gate separat |
| T-G10-026 | A-G10-026 | Given freigegebener abgelaufener Datensatz, when Anonymisierung, then Personenbezug weg, Geschäftszahlen/Aggregat erhalten. | E2E | Soll: Fachcommand-Integration mit synthetischen Daten |
| T-G10-027 | A-G10-027 | Given Zeitablauf ohne Adminfreigabe, when Prüflauf, then nur Vorschlag; nach Freigabe genau ein Fachcommand/Receipt. | E2E | Soll: Retention-Proposal/Approval-Idempotenztest |
| T-G10-028 | A-G10-028 | Given Mailboxobjekt, when Retention, then kein G10-Delete-/Anonymize-Port und erklärender Ausschluss. | Smoke/E2E | Soll: Portsurface- und UI-Test |
| T-G10-029 | A-G10-029 | Given Admin/Nicht-Admin und gültige Kostenzeile, when speichern, then nur Admin erhält Receipt/Readback. | E2E | Soll nach Q-G10-008: RunningCost-Commandtest |
| T-G10-030 | A-G10-030 | Given Betrag/Stichtag, when Admin speichert, then Readback enthält Betrag, `asOf`, Serverzeit, Actor; Nicht-Admin sieht nichts. | E2E | Soll: AccountBalance-Command/RLS-Test |
| T-G10-031 | A-G10-031 | Given bestätigtes X und Stichtag X/X+1 Tage alt, when View, then Warnung nur jenseits Grenze und keine fachliche Sperre. | Smoke/E2E | Soll nach Q-G10-008: Grenzwerttest |
| T-G10-032 | A-G10-032 | Given Gehaltsplanung mit Personenwerten, when G10-Port, then nur freigegebene Summe in Payload/DOM/Log. | E2E | Soll: PayrollSummary-Datensparsamkeitstest |
| T-G10-033 | A-G10-033 | Given Bankvorschlag und manueller Wert, when ohne Bestätigung/ablehnen/bestätigen, then kein Write/kein Write/genau ein Write; manueller Wert bleibt nachvollziehbar. | E2E | Soll nach Provider-Gate: BankSuggestion-E2E |
| T-G10-034 | A-G10-034 | Given keine Owner-Freigabe, when Terminal-/Bankaktivierung, then kein Provider, Secret oder kostenpflichtiger Call erreichbar. | E2E | Soll: capability-closed route/network test |
| T-G10-035 | A-G10-035 | Given neues Settings-Modul, when Quality, then Manifest/Fassade vollständig und keine Tiefimporte. | Smoke | Soll: `npm run quality:module-gates`; Schema `94962E694CBB` |
| T-G10-036 | A-G10-036 | Given G10-Code, when statische/Integrationstests, then keine direkten Writes auf Customers/Orders/Invoices und nur deklarierte Views/Fassaden. | Smoke/E2E | Soll: Module-Gate plus SQL-/Repository-Negativtest |

## Owner-UX-Abnahme

Owner-UX umfasst mindestens Gregor Desktop/Tablet/Handy, Rolf mit erlaubtem und gesperrtem Fachbereich sowie Phillip mit gesperrtem Fachbereich. Geprüft werden verständliche Bereichsnamen, alle `In Klärung`/`In Aufbau`-Karten, fehlende Pflichtfelder, Fokusführung, Verwerfen/Speichern, Receipt-Verständlichkeit und der sichere Rückweg. Ein Owner-UX-PASS ersetzt keine Server-, DB-, RLS-, Provider- oder Rechtsfreigabe.

