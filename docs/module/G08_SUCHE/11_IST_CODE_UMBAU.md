<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G08_SUCHE — Ist-Code und Umbau

Kein Code wird in diesem Auftrag verändert oder gelöscht. Die Entscheidungen beschreiben T-04/T-13; jede Entfernung erfolgt erst nach Importinventar, Negativtest und separater Lieferfreigabe.

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| `src/modules/suche/public.ts` | positive öffentliche Fassade | GEBAUT | bleibt | SHA `17773F401DBF`; Modul-Gate | Source-Registry-, Navigation-/Fehlerverträge explizit exportieren und versionieren; keine Tiefexports |
| `src/modules/suche/suche.manifest.json` | Ownership, Exports, Capability, Abhängigkeiten | GEBAUT | bleibt | SHA `74F28F485703` | Exports/Capabilities an neuen Vertrag anpassen; Ownership muss leer bleiben; Read-Port-Abhängigkeiten deklarieren |
| `src/modules/suche/server/searchTenant.ts` | Normalisierung, Validierung, Matching, Ranking, Kappung | GEBAUT | bleibt | SHA `F867C8C321B8`; Unit/Fresh-DB-Evidence | deterministische Logik retten; geschlossene Kreile-Branches in neutrale Source-Registry überführen; keine neue DB-Wahrheit |
| `src/modules/suche/server/types.ts` | Orders-/Customers-Dokumente und Resultattypen | GEBAUT | bleibt | SHA `B936A9727755` | generischen Request/Source/Hit/Coverage/Fehlervertrag bilden; Kreile-Dokumenttypen in HostAdapter-Konfiguration; Correlation-ID ergänzen |
| `src/modules/suche/ui/SearchDialog.tsx` | Modal, Debounce, stale-response-Schutz, Tastatur/Touch, Zustände | GEBAUT | umbauen auf Designsystem | SHA `E0CF8379EF10`; Dialogtests | Verhalten/Textbelege erhalten; UI gegen `kr-`-Bausteine; Source-Registry ohne separate `ORDER`-/`CUSTOMER`-UI-Zweige; Fokusrückgabe ergänzen |
| `src/modules/suche/ui/SearchDialog.module.css` | eigene Dialoggestaltung | ÜBERHOLT | umbauen auf Designsystem | SHA `776FFF6A161B`; OE-2609-03 | keine Farbwerte/Mock-CSS übernehmen; nach Migration nur freigegebene Tokens/Primitives |
| `src/app/actions/search.actions.ts` | Kreile-Authorization und Port-Komposition | GEBAUT | bleibt | SHA `10FC98BB0BEB` | auf schmalen Kreile-Server-AppAdapter reduzieren; G01-Capability statt festem `perm_view_leitstand`; G04/G05 nur über öffentliche Read-Fassaden; Correlation-ID |
| `src/components/layout/GlobalSearch.tsx` | Kreile-UI-AppAdapter zwischen Dialog, Action und Overlay | GEBAUT | bleibt | SHA `1255BCF650F6` | als klar benannter `*AppAdapter.tsx` in Ziel-Shell komponieren; Resultatregistry statt `if ORDER else CUSTOMER` |
| `src/app/global-search-actions.ts` | Kompatibilitätsdelegate auf kanonische Action | ÜBERHOLT | entfällt | SHA `A0280A823BD6`; Kommentar „dormant imports“ | T-13 erst nach `git grep`/Importgraph und Negativtest; keine Parallel-Action behalten |
| `src/components/layout/MockAppFrame.tsx` | aktuell gerenderter Rahmen; Suche bewusst weggelassen | GEBAUT | umbauen auf Designsystem | SHA `6D15D475D261`; Kommentar „Suche nicht angebunden“ | T-01–T-03-Designsystem zuerst; T-04 montiert Such-AppAdapter in Desktop/Tablet/Handy, ohne Mock-CSS zu kopieren |
| `src/components/layout/KreileAppShell.tsx` | komponiert Rahmen, EntityOverlayStack, GlobalCreate | GEBAUT | bleibt | SHA `5C2CC3CA7962` | Search-AppAdapter/Top-Layer-Koordination genau einmal komponieren; login-only bleibt ohne aktive Suche |
| `src/lib/overlayStore.ts` | globaler ID-Stack, Legacy-OrderStack, globaler Escape-Listener | ÜBERHOLT | bleibt | SHA `C29CAD260D32` | als app-seitigen typisierten Overlay-/Backstack-Adapter mit NavigationContext umbauen; Legacy-Funktionen und Doppel-Escape nach Importinventar abbauen; kein neues Fachmodul |
| `src/components/layout/EntityOverlayStack.tsx` | rendert oberste Order-/Customer-Karte über kanonische AppAdapter | GEBAUT | bleibt | SHA `69A1EB9D8604` | NavigationContext, Intake-Einstieg, Fokus/Scroll-Restoration und typisierte Fehler ergänzen; Module erhalten nur enge callbacks |
| `src/components/layout/KreileHeader.tsx` | alter Header mit montierter `GlobalSearch` | ÜBERHOLT | entfällt | SHA `3779424360B3`; aktuelle Shell importiert ihn nicht | nicht als Integrationsziel verwenden; T-13 nach vollständigem Import-/Routentest |
| `src/lib/server/orderStationRead.ts` | heutiger interner Orders-Read-Port | GEBAUT | ersetzen durch Modul | `search.actions.ts`-Import; View-Inventar | G04 stellt öffentliche serverseitige Read-Fassade bereit; G08 kennt Datei/View nicht direkt |
| `src/lib/server/orderIntakeRead.ts` | heutiger interner Customers-Read-Port | GEBAUT | ersetzen durch Modul | `search.actions.ts`-Import; View-Inventar | G05 stellt öffentliche serverseitige Read-Fassade bereit; 20er-Cap/`exhaustive` vertraglich offenlegen |
| `src/lib/search/globalSearch.ts` | parallele ältere Suche | ÜBERHOLT | entfällt | SHA `8ADC6AAA658B` | T-13 nach Importinventar; darf keine zweite Ranking-/Auth-Wahrheit bleiben |
| `src/features/analyse/hooks/useGlobalSearch.ts` | Analyse-Clienthook für ältere globale Suche | ÜBERHOLT | entfällt | SHA `E777BF3B0F7E` | M02 ist hinten angestellt; kein Anschluss an G08-V1; vor Entfernung Imports prüfen |
| `src/components/layout/GlobalSearchAIResult.tsx` | alte KI-Ergebnisfläche | VERWORFEN | entfällt | SHA `B9C1A5B1F976`; D-AI-001/M07-Grenze | keine KI-/Providerfunktion in V1 und kein Fake-Fallback; M07 später nur über öffentlichen Vertrag |
| `src/modules/suche/__tests__/searchTenant.test.ts` | deterministischer Kernvertrag | GEBAUT | bleibt | SHA `8B06AD51D342` | auf generische Registry, neue Source, Correlation-ID und Capability-unabhängigen Kern erweitern |
| `src/modules/suche/__tests__/SearchDialog.test.tsx` | Dialogzustände und Bedienung | GEBAUT | bleibt | SHA `AB1DBAAC6B2E` | sieben Dossierzustände, Fokusrückgabe, Designsystemsemantik und registrierte Resultattypen ergänzen |
| `src/test/search_tenant.integration.test.ts` | echte lokale DB, Session, Fremdtenant, Inkonsistenz | GEBAUT | bleibt | SHA `943481904CE2` | auf öffentliche G04/G05-Fassaden, OE-2609-09-Rechte und T-04-Exact-SHA aktualisieren; keine Remote-DB |
| `src/components/layout/__tests__/EntityOverlayStack.p3.test.tsx` | Order→Customer→Order und Customer→Order | GEBAUT | bleibt | SHA `6A01C70C6CA2` | Intake→Order, Filter, Query, Scroll, Fokus und ein-Pop-pro-Escape ergänzen |
| `src/test/path1_p3_deeplinks.test.tsx` | V8-/V2-Deep-Link nutzt AppAdapter | GEBAUT | bleibt | quellengeprüft | mit Suchauswahl gegen dieselben Adapter kombinieren |
| `docs/project/linie/_lieferungen/suche/*` | alte Lieferkopien/Source-Snapshots | ÜBERHOLT | entfällt | `09_QUELLEN_AKTUALITAET.md` | keine Codequelle; eventuelle Entfernung nur in separatem Doku-Cleanup, nicht T-04 |

## Bestandsdaten und Migration

- G08 besitzt keine Bestandsdaten; es gibt nichts zu migrieren, zu importieren oder zu löschen.
- Orders-/Customers-Daten bleiben unverändert in ihren Besitzermodulen. T-04 verändert keine Tabelle, View, RLS-Regel oder Remote-Migration.
- Die Umstellung des OverlayStores betrifft flüchtigen Clientzustand. Falls irgendwo persistierter Stack-/Filterzustand gefunden wird, muss T-04 ihn vor Änderung inventarisieren; ohne Beleg wird kein persistiertes Format angenommen.
- Tests verwenden ausschließlich klar synthetische Daten und den lokalen Loopback-Stack.

## Empfohlene T-04-Schnittfolge

1. G01-Capability- und G04/G05-public-Read-Fassaden festziehen.
2. Suchkern auf neutrale Source-Registry und Correlation-ID umstellen; bestehende Ranking-/Fail-closed-Tests erhalten.
3. App-seitigen NavigationContext-/Top-Layer-Backstack bauen und alle drei Sequenzen testen.
4. Nach Designphase 1 den Dialog auf `kr-`-Bausteine setzen und in die Ziel-Shell integrieren.
5. Fresh-Tenant-, Full-Route- und Owner-UX-Gates auf einem SHA ausführen.
6. Altpfade erst anschließend im separaten T-13-Scope nach Importinventar entfernen.
