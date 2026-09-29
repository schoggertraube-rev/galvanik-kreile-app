<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G08_SUCHE — Abnahme und Tests

Vorhandene Tests wurden für dieses Dossier quellenlesend geprüft, nicht ausgeführt; der Auftrag erlaubt keine Repo-Schreibvorgänge und Testläufe können Cache-/Artefaktdateien erzeugen. T-04 muss die vollständige Suite auf seinem exakten Produkt-SHA ausführen und belegen.

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-G08-001 | A-G08-002 | Given leere, blanke und einstellige Eingaben, when normalisiert wird, then entsteht ein leeres `OK` ohne Portaufruf. | Smoke | vorhanden: `src/modules/suche/__tests__/searchTenant.test.ts`, SHA `8B06AD51D342` |
| T-G08-002 | A-G08-003 | Given Nicht-String oder 81 Zeichen, when gesucht wird, then kommt Validierungsfehler vor jedem Portzugriff. | Smoke | vorhanden: `searchTenant.test.ts`, SHA `8B06AD51D342` |
| T-G08-003 | A-G08-006, A-G08-011 | Given ein über den echten Intake-Vertrag angelegter synthetischer Auftrag im lokalen Fresh-Tenant, when Nummer, Titel, Kunde, Aufgabe, Teil, Material, Oberfläche oder Termin gesucht wird, then weist der Treffer Feld, Wert, Quelle und Order-ID nach. | E2E | Unit vorhanden; Fresh-DB vorhanden: `src/test/search_tenant.integration.test.ts`, SHA `943481904CE2` |
| T-G08-004 | A-G08-007, A-G08-011 | Given ein über den echten Intake-Vertrag angelegter synthetischer Kunde im lokalen Fresh-Tenant, when Name, Firma, Nummer, Ort oder belegte Cross-Field-Phrase gesucht wird, then weist der Treffer Feld, Wert, Quelle und Customer-ID nach. | E2E | Unit/Fresh-DB vorhanden, SHAs `8B06AD51D342`, `943481904CE2` |
| T-G08-005 | A-G08-009, A-G08-010 | Given Dubletten und je 16 passende Orders/Customers, when gesucht wird, then ist die Reihenfolge deterministisch, das Resultat hat 20 eindeutige Hits und `truncated=true`. | Smoke | vorhanden: `searchTenant.test.ts`, SHA `8B06AD51D342` |
| T-G08-006 | A-G08-016 | Given Orders-, Customers-, Clock- oder Schemafehler, when gesucht wird, then ist das Gesamtergebnis `UNAVAILABLE`, enthält keine Hits und keine internen Fehlermeldungen. | Smoke | vorhanden: `searchTenant.test.ts`, SHA `8B06AD51D342` |
| T-G08-007 | A-G08-005 | Given keine Session, ein Fremdtenant und tenantinkonsistente Daten, when gesucht wird, then erfolgen Denial, leeres Fremdtenantresultat beziehungsweise fail-closed `UNAVAILABLE`. | E2E | vorhanden: `search_tenant.integration.test.ts`, SHA `943481904CE2` |
| T-G08-008 | A-G08-001, A-G08-022 | Given ein berechtigter Nutzer auf jeder Kernroute, when Suchtrigger oder Ctrl/Cmd+K betätigt wird, then öffnet derselbe Dialog fokussiert; Escape/Backdrop schließen nur ihn und Fokus kehrt zurück. | E2E | teilweise vorhanden: `SearchDialog.test.tsx`, SHA `AB1DBAAC6B2E`; Full-Route/Fokusrückgabe FEHLT |
| T-G08-009 | A-G08-004 | Given zwei überlappende Requests, when die ältere Antwort zuletzt eintrifft, then bleibt ausschließlich die neuere Antwort sichtbar. | Smoke | vorhanden: `SearchDialog.test.tsx`, SHA `AB1DBAAC6B2E` |
| T-G08-010 | A-G08-023 | Given eine vollständig geprüfte Suche ohne Treffer, when das Resultat gerendert wird, then erscheinen geprüfte Quellen und sichere Alternativen, aber keine unbelegte „nicht gefunden“-Behauptung. | Smoke | vorhanden: `SearchDialog.test.tsx`, SHA `AB1DBAAC6B2E` |
| T-G08-011 | A-G08-008 | Given eine synthetische dritte Source-Definition mit Validator und Navigator, when sie im Test-Host registriert wird, then sucht/rankt der Kern sie ohne neuen Typzweig und meldet sie nur nach Erfolg als geprüft. | Smoke | FEHLT — T-04 Source-Registry-Test |
| T-G08-012 | A-G08-018 | Given alle sechs technischen Rollen und eine individuell gesperrte Person, when gesucht wird, then dürfen alle nicht gesperrten Personen lesen und nur die gesperrte Person erhält `FORBIDDEN`. | E2E | FEHLT — nach G01-Capability-Vertrag |
| T-G08-013 | A-G08-001, A-G08-021, A-G08-026 | Given vollständige authentisierte Routen in 1914×917, 1220×880 und 390×844, when die Suche geöffnet und benutzt wird, then sind Trigger, Dialog und Ergebnisse bedienbar, ohne Alt-/Mock-CSS oder horizontalen Overflow. | Owner-UX | FEHLT — T-04 Browserbeleg nach Designphase 1 |
| T-G08-014 | A-G08-012 | Given je ein Order- und Customer-Treffer, when ausgewählt wird, then öffnet derselbe V8-/V2-AppAdapter wie Liste und Deep-Link. | E2E | Adapter/Deep-Link teilweise belegt: `path1_p3_deeplinks.test.tsx`; vollständige Suchroute FEHLT |
| T-G08-015 | A-G08-013 | Given Home→Order→Customer→Order und Customer→Order, when jede Ebene geschlossen wird, then erscheint exakt die vorherige Entity. | Smoke | vorhanden: `EntityOverlayStack.p3.test.tsx`, SHA `6A01C70C6CA2` |
| T-G08-016 | A-G08-013, A-G08-014 | Given Intake→Order sowie gesetzte Route, Filter, Querystring, Scroll und Fokus, when verschachtelte Karten geöffnet und geschlossen werden, then wird der gesamte Ausgangskontext exakt restauriert. | E2E | FEHLT — NavigationContext im Store fehlt |
| T-G08-017 | A-G08-013 | Given Suchdialog über einem Karten-Overlay, when einmal Escape gedrückt wird, then sinkt die Top-Layer-/Stacktiefe exakt um eins. | Smoke | FEHLT — deckt Doppel-Listener-Risiko ab |
| T-G08-018 | A-G08-015 | Given jede der vier Funktionen, when die sieben Pflichtzustände injiziert werden, then erscheint jeweils der Wortlaut aus `02` oder der dort verknüpfte graue Klärungszustand. | Owner-UX | FEHLT — Zustandsmatrix nach Designphase 1 |
| T-G08-019 | A-G08-017 | Given ein Port-, Navigator- und Datenkonflikt, when der Fehler erscheint, then nennt die UI Wirkung, sichere Datenlage, Correlation-ID und nächsten erlaubten Schritt; Serverlogs sind darüber auffindbar. | E2E | FEHLT — D-RES-001-Lücke |
| T-G08-020 | A-G08-019 | Given ein Suchlauf und eine Trefferauswahl, when DB-/Command-Audit geprüft wird, then existiert keine von G08 ausgelöste Mutation und kein G08-Event. | E2E | Manifest belegt Ownership leer; Laufbeleg in T-04 FEHLT |
| T-G08-021 | A-G08-020 | Given Modul-Gates, when T-04 geprüft wird, then importieren G08/HostAdapter Orders und Customers nur über öffentliche Fassaden und kein fremdes `server`-/`lib`-Internum. | Smoke | FEHLT — heutige `search.actions.ts` verletzt das Ziel |
| T-G08-022 | A-G08-024 | Given fehlender Dokument-Port, when die Suche geöffnet und ausgeführt wird, then gibt es keinen Dokument-Portaufruf, keinen Dokumenttreffer und höchstens „Dokumente — In Klärung“ ohne Aktion/Route. | E2E | FEHLT — Q-G08-001-Zwischenzustand |
| T-G08-023 | A-G08-025 | Given der T-04-V1-Produktbaum, when Imports, Netzwerkaufrufe und Abhängigkeiten inventarisiert werden, then gibt es keinen Modell-, Internet-, OCR- oder Providerpfad. | Smoke | vorhandene P3-Evidence nennt `metered_cost=0`; auf T-04-SHA neu zu belegen |
| T-G08-024 | A-G08-026 | Given frischer synthetischer Kreile-Tenant und reale Logins, when der komplette Weg Kopfzeile→Suche→V8/V2→verschachtelt zurück auf drei Zielgrößen läuft, then sind alle Readbacks korrekt und P0/P1-Abweichungen null. | E2E + Owner-UX | FEHLT — finale T-04-Abnahme |

## Abnahme-Reihenfolge

1. Smoke: Kern, Registry, negative Validatoren, Modul-Gates.
2. Fresh-Tenant-E2E: Session, Capability, RLS, reale Orders/Customers, Fehler-/Kappungsfälle.
3. Full-Route-E2E: Kopfzeile, Dialog, Originalkarten, Backstack, Filter/Scroll/Fokus.
4. Owner-UX: side-by-side gegen V5 plus Seitenwahrheiten bei den drei verbindlichen Größen.
5. Unabhängiger read-only Review auf exakt demselben Produkt-SHA; ein älterer P3-Beleg ist kein Ersatz.
