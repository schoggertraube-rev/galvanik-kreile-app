<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Test- und Abnahmematrix

Jeder Test läuft am exakten Implementierungs-SHA. Produktive Abnahme verwendet Fresh-Supabase-Replay, echte Session-Kette und keine Mocks oder synthetischen Produktdaten; synthetische Fixtures sind nur in isolierten Tests zulässig und dort gekennzeichnet.

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| G03-T01 | G03-A01 | Given jede Kernseite und ein zulässiges Profil, when `+ Anlegen` und eine Option gewählt werden, then steht der Fokus spätestens nach zwei Klicks im ersten Feld. | E2E + Owner-UX | vorhanden teilweise: `path1GlobalCreateFlow.realRender.test.tsx` `D32EFC869C76`; echter Browser-E2E FEHLT |
| G03-T02 | G03-A02, A21 | Given M04/M06 ohne Konfiguration, when der manuelle Weg durchlaufen wird, then entsteht der Auftrag ohne Provideraufruf und OCR bleibt deaktiviert. | Smoke + E2E | FEHLT → neuer Adapter-Abwesenheits-E2E |
| G03-T03 | G03-A03 | Given belegte Kunden, when nach Name, Nummer und Ort gesucht wird, then werden nur kanonische Treffer angezeigt und die gewählte ID verwendet. | E2E | bestehende Real-Render-Abdeckung `D32EFC869C76`; Browserbeleg FEHLT |
| G03-T04 | G03-A04 | Given ähnliche Kundendaten, when Neuanlage gestartet wird, then erscheint eine Warnung und es erfolgt ohne bewusste Wahl kein Merge. | E2E + Owner-UX | Altkomponente `DuplicateWarning.tsx` `5C3DCF8499C6`; kanonische Integration FEHLT |
| G03-T05 | G03-A05, A06 | Given vollständige Neukundendaten, when gespeichert wird, then enthalten DB, Receipt und Readback inklusive Straße/PLZ/Ort exakt die Eingabe. | E2E | Basis vorhanden: `path1_customer_persistence.integration.test.ts` `8B4DD31A65FB`; Adresserweiterung FEHLT |
| G03-T06 | G03-A05 | Given fehlende Adresse, when Versand oder Rechnung gewählt wird, then ist Speichern gesperrt; bei Abholung bleibt die Kundenanlage möglich. | E2E + Owner-UX | FEHLT → neuer Adressregeltest |
| G03-T07 | G03-A07 | Given ein KV-Entwurf, when Seite neu geladen und danach mit korrekter Version geändert wird, then bleiben Daten erhalten und die Version steigt genau einmal. | E2E | vorhanden: `path1_quote_to_order.integration.test.ts` `5D1AB9418F8C`; UI-Test `D32EFC869C76` |
| G03-T08 | G03-A07 | Given eine stale KV-Version, when gespeichert wird, then wird nichts überschrieben und der Konflikt bleibt sichtbar. | E2E | vorhanden: `path1_quote_to_order.integration.test.ts` `5D1AB9418F8C` |
| G03-T09 | G03-A08 | Given ein gespeicherter KV, when zwei Vergaben parallel erfolgen, then existieren genau ein Auftrag und replaybare KV-/Intake-Receipts. | E2E | vorhanden: `path1_quote_to_order.integration.test.ts` `5D1AB9418F8C` |
| G03-T10 | G03-A09 | Given globaler oder Wareneingang-Einstieg, when direkter Intake gewählt wird, then verwenden beide denselben Public-Port und keine Legacy-Mutation. | E2E + Architekturtest | UI-Abdeckung vorhanden `D32EFC869C76`; Modul-Containment nach Umbau FEHLT |
| G03-T11 | G03-A10, A11 | Given Katalog- und Freitextmodus, when 1 beziehungsweise 20 gültige Positionen gespeichert werden, then sind die Snapshots identisch strukturiert und bleiben nach Katalogänderung unverändert. | E2E | F1.1-Grenzen teilweise vorhanden `B82BFCD5CC8D`; Katalogmodus FEHLT |
| G03-T12 | G03-A11 | Given 0, 21, Dezimal-/Null-/Negativmenge oder zu kurze Texte, when Command aufgerufen wird, then erfolgt kein DB-Write. | Smoke | Unit-Basis `orderIntakeCommand.ts` `0409B46490A4`; vollständige Boundary-Matrix beim Bau ergänzen |
| G03-T13 | G03-A12 | Given mindestens 20 parallele unterschiedliche Intake-Requests im selben Jahr/Tenant, when committed, then sind alle Nummern eindeutig und kanonisch. | E2E | Implementierung belegt `0409B46490A4`; expliziter Parallel-/Lastbeleg FEHLT |
| G03-T14 | G03-A13, A14, A15 | Given Abholung, Versand und freigegebener Rechnungskunde, when Intake gespeichert wird, then akzeptiert der Server nur die jeweilige Regel und liest sie exakt zurück. | E2E | Zahlungsschema `4D61ED0800DF`; Ziel-Command/UI-Test FEHLT |
| G03-T15 | G03-A16 | Given unterschiedliche Wunsch- und Zusagedaten, when Auftrag angelegt wird, then stehen beide nach Reload in `due_date` und `promised_due_date`. | E2E | Schema vorhanden; heutiger Command `0409B46490A4` verliert den Wunsch; Zieltest FEHLT |
| G03-T16 | G03-A17, A18 | Given ein bestätigter Auftrag, when Terminprojektion läuft, then existiert genau ein App-Termin; ohne M04 gibt es keinen Graph-Aufruf, mit M04 nur eine Projektion. | E2E | FEHLT → Terminport-Test; Outlook-Anteil erst M04-Gate |
| G03-T17 | G03-A19 | Given kein Foto, when Intake bestätigt wird, then entsteht der Auftrag und der nicht blockierende Hinweis bleibt sichtbar. | E2E + Owner-UX | FEHLT → globaler Flow-Fotohinweis |
| G03-T18 | G03-A20 | Given gültiges Originalfoto, when reserve/upload/finalize/read ausgeführt werden, then stimmen Hash, Pfad, Receipt und Zielposition exakt überein. | E2E | bestehende Panel-Implementierung `5C0275447321`; Integration in kanonischen Flow FEHLT |
| G03-T19 | G03-A20 | Given falscher MIME, >12 MiB, Hash-/Pfadabweichung oder fehlendes Fresh-Read, when Upload versucht wird, then erscheint kein bestätigtes Original. | Smoke + E2E | Komponentenbasis im `OrderIntakePanel`; End-to-End-Negativmatrix FEHLT |
| G03-T20 | G03-A22 | Given verlorene Antwort, when derselbe Request geprüft/wiederholt wird, then existieren genau ein Auftrag/Event/Receipt und identischer Readback. | E2E | vorhanden: `f1_order_intake.integration.test.ts` `B82BFCD5CC8D` |
| G03-T21 | G03-A22 | Given manipuliertes Receipt oder abweichende Arbeitsliste, when Erfolg geprüft wird, then bleibt der Zustand Fehler/In Klärung. | Smoke | vorhandene Negativmatrix in `OrderIntakePanel.test.tsx`; Quelldatei beim Build neu hashen |
| G03-T22 | G03-A23 | Given fehlende Session, fremder Tenant, gesperrtes Profil oder zusätzliche Payload-Felder, when mutiert wird, then gibt es null Writes. | E2E | vorhanden teilweise: `B82BFCD5CC8D` und Command-Unit-Tests; OE-2609-09-Sperrmodell FEHLT |
| G03-T23 | G03-A24 | Given Rolf, Phillip und Gregor ohne Admin-Sperre, when G03 geöffnet wird, then ist der Weg für alle verfügbar; mit Sperre nur der belegte Sperrzustand. | E2E | FEHLT → echte Rollen-/Capability-Matrix |
| G03-T24 | G03-A25 | Given Netzabbruch vor Receipt, when Verbindung wiederkehrt, then bleibt der Entwurf erhalten und derselbe Intent erzeugt genau einen Auftrag. | E2E | FEHLT → Phase-3-Offline-Test nach Q-G03-004 |
| G03-T25 | G03-A26 | Given 1914×917, 1220×880 und 390×844, when alle Screens bedient werden, then sind Fokus, Touch-Ziele, Aktionen und Inhalte unverdeckt und V5-konform. | E2E + Owner-UX | FEHLT → CI-Browser-Screenshots plus Owner-Preview |
| G03-T26 | G03-A27 | Given jede Funktion, when jeder der sieben Zustände injiziert wird, then ist genau ein dominanter Zustand sichtbar und sein Text entspricht `02_FUNKTIONEN_ABLAEUFE.md`. | Smoke + E2E | FEHLT → Zustandsmatrix nach Designphase 1 |
| G03-T27 | G03-A28 | Given der Zielmodulbaum, when Import-/Textscan läuft, then enthält der Kern keine Kreile- oder Fremdapp-Fachbegriffe und HostAdapter-Imports zeigen nur nach außen. | Smoke | FEHLT → Architektur-/Terminologiescan |
| G03-T28 | Gesamtgate | Given Fresh-Supabase-Replay und echte Kreile-Session, when der gesamte Kunde→KV→Auftrag- sowie Direktintake-Fluss läuft, then sind DB-Zeilen, Events, Receipts und UI-Readbacks exakt und mockfrei. | E2E + Owner-UX | bestehende Teilbelege `D32EFC869C76`, `B82BFCD5CC8D`, `8B4DD31A65FB`, `5D1AB9418F8C`; Gesamtbeleg FEHLT |

## Abnahmefolge

1. Smoke: Typen, Imports, Manifest, Zustände, Command-Negativfälle.
2. Fresh-Supabase-Replay: Migrationen, echte Session-/Tenant-Kette, Commands, Receipts, Readbacks und Parallelität.
3. Browser-E2E: vollständige Flüsse für Rolf, Phillip und Gregor auf allen drei Viewports.
4. Owner-UX: Element-für-Element-Abgleich gegen V5; keine Freigabe anhand des HTML allein.
5. Unabhängiger Read-only-Review des exakten SHAs; erst danach kann der Dossierstatus FREIGEGEBEN werden.

