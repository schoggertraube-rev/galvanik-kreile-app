<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G06 KV / Angebot — Ist-Code und Umbau

Referenz ist der lokal vorhandene `origin/main`-Commit `21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`. Alle hier aufgeführten aktiven G06-Dateien waren beim Prüfen bytegleich zu diesem lokalen Ref. Es wurde kein Code verändert.

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| `src/modules/quotes/quotes.manifest.json` | Modulgrenze, Exporte, Capabilities, Tabellen, Events, Abhängigkeiten | GEBAUT | bleibt; bei neuen ratifizierten Ports aktualisieren | SHA `83B48043CD95` | Kein paralleles `capability.manifest.json`; bestehendes Manifest ist Wahrheit. |
| `src/modules/quotes/public.ts` | providerfreie Client-Typfassade | GEBAUT | bleibt | SHA `6FA83658278D` | Nur ratifizierte Typen exportieren; keine Serverimporte/Personen/Provider. |
| `src/modules/quotes/server-public.ts` | einzige öffentliche Server-Fassade | GEBAUT | bleibt | SHA `D6791B054FA8` | Import-Containment beibehalten. |
| `src/modules/quotes/server/types.ts` | Quote-, Positions-, Receipt- und Conversion-Verträge | GEBAUT | bleibt; Erweiterung aus Q-G06-001 erst nach G04/G07-Vertrag | SHA `6AFD957CB47C` | Keine vorauseilenden Zahlungs-/Express-Schattenfelder. |
| `src/modules/quotes/server/quoteCommands.ts` | Create, Update, Prepare Conversion und Receipt-Reads | GEBAUT | bleibt | SHA `B4EE0EB9CF28` | Validierung, Idempotenz und Tenantbindung erhalten; Schnellübernahme schreibt weiter nur über diese Commands. |
| `src/modules/quotes/server/quoteReads.ts` | KV-Readback und offene Liste | GEBAUT | bleibt | SHA `33329DAE5D4B` | Reuse liest Fremddaten über neuen Host-Port, nicht hier direkt. |
| `src/app/actions/quotes.actions.ts` | Kreile-Authorization und Orchestrierung KV→F1.1-Auftrag | GEBAUT | bleibt als Hostkomposition; auf G01-Personenrechte und geklärten Q-G06-001-Vertrag umbauen | SHA `E748C8238A35` | Aktuell Capability-Mapping über `perm_data_orders`/`perm_view_leitstand`; keine zweite Order-Schreiblogik hinzufügen. |
| `src/app/GlobalCreateAppAdapter.tsx` | verbindet Kunden-, KV-, Auftrag-, Navigation- und Session-Ports | GEBAUT | bleibt als Kreile-HostAdapter; Portoberfläche auf G01/G04/G05/G09 ausrichten | SHA `2E48304973B6` | `sessionStorage` darf nur die letzte `quoteId` halten, nie Fachdaten oder Erfolg. |
| `src/components/layout/GlobalCreateFlow.tsx` | einzige sichtbare Kunde/KV/Auftrag-Komposition inklusive Zuständen | GEBAUT | KV-Flächen in eine G06-UI-Fassade innerhalb `src/modules/quotes/ui` schneiden; GlobalCreate orchestriert nur; auf Designsystem umbauen | SHA `D9E7976D7FF7` | Verhalten/Textsicherheit erhalten; keine zweite Route oder Engine. Bestehende Bestandsdaten unverändert weiterlesbar. |
| `src/components/layout/TargetShell.module.css` | aktuelles Layout/Mock-nahes Styling auch für GlobalCreate | GEBAUT, optisch überholt | umbauen auf Designsystem | SHA `1BDA75C55A86`; OE-2609-03 | Keine CSS-Werte kopieren; nach P-DS ausschließlich zentrale `kr-`-Tokens/Bausteine. |
| `src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx` | Render-, Fehler-, Konflikt- und Rettungszustände | GEBAUT | bleibt und wird auf 7-Zustände, Sperrtexte und DS-Semantik erweitert | SHA `D32EFC869C76` | Tests dürfen synthetische, klar markierte Fixtures nutzen. |
| `src/modules/quotes/__tests__/quoteCommands.test.ts` | Command-Validierung/Mapping | GEBAUT | bleibt und wird bei jedem Vertragszuwachs erweitert | SHA `EC367856114D` | Kein Testbiegen; Exact-Key-Regeln erhalten. |
| `src/modules/quotes/__tests__/quoteReads.test.ts` | Read-/Listenvertrag | GEBAUT | bleibt | SHA `EDF9DF45CB00` | Leere/Fehler/Fremdtenant-Fälle erhalten. |
| `src/test/path1_quote_to_order.integration.test.ts` | Fresh-DB-Kette Create/Edit/Replay/Zuschlag/Failure/Tenant | GEBAUT | bleibt; Nummern-Nebenläufigkeit und neue sichere Hostverträge ergänzen | SHA `5D1AB9418F8C` | Nur lokale synthetische Daten; keine Remote-Datenbank. |
| `e2e/path1-ui-convergence-v5-global-create.spec.ts` | reale Browserkette Kunde→KV→Edit/Fortsetzen→Auftrag | GEBAUT | bleibt als Fach-E2E; auf drei Zielviewports und DS-Screens aktualisieren | SHA `D8CDD026FEE3` | Screens/Receipts an Exact-SHA; keine Detailassertion als Ersatz für Owner-UX. |
| `e2e/path1-v5-shell-smoke.real.spec.ts` | schlanker Rollen-/Geräte-Shell-Smoke | GEBAUT | bleibt; G06 nur durch eigenen kleinen Fach-Smoke ergänzen | SHA `33337D337BE1` | Nicht zu einer großen Testmatrix aufblasen. |
| `supabase/migrations/20260914110000_path1_quote_persistence_contract.sql` | Quote-Persistenz, Nummer, Create/Conversion/Receipts | GEBAUT | bleibt unverändert als Historie | SHA `AE82314EB68D` | Niemals bestehende Migration umschreiben; neue Schemaentscheidung nur als neue Migration nach Gate. |
| `supabase/migrations/20260916090000_path1_quote_product_lifecycle.sql` | Versionierung, offene Liste, Update-Receipts | GEBAUT | bleibt unverändert als Historie | SHA `DA29633EAB78` | Keine Remote-Migration in diesem Auftrag. |
| `docs/evidence/path1/PATH1_UI_CONVERGENCE_V5_WORK_UNIT_2.md` | historischer WU2-Nachweis | ÜBERHOLT | bleibt als Historie, nicht als aktuelle Lieferwahrheit | SHA `01A02E1613AE` | Alte Hashes/Testzahlen nicht in neue Evidence übernehmen. |
| `docs/evidence/path1/PATH1_UI_CONVERGENCE_V5_QUOTE_PRODUCT.md` | historischer P2-Nachweis | ÜBERHOLT | bleibt als Historie; neuer Exact-SHA-Nachweis bei Umbau | SHA `8CF2964ECD04` | Kein aktueller UI-/Production-PASS daraus ableiten. |
| `src/components/erfassung/InquiryFlow/InquiryToQuote.tsx` | alte, nicht importierte Inquiry→Quote-Oberfläche | VERWORFEN | entfällt fachlich; nicht verdrahten, spätere Löschung nur in autorisiertem Kill-Ticket | SHA `761DD042B1B3`; keine Importe gefunden | Keine Bestandsdaten; in diesem Auftrag nichts löschen. |
| `src/app/quotes`, `src/app/quotes/new` | frühere direkte KV-Routen | nicht vorhanden | entfällt; 404 beibehalten | Evidence Work Unit 2; Dateiinventar | Keine Ersatzroute anlegen. |
| Noch nicht vorhanden: G06-UI-Fassade/`kr-`-Komposition | modulare Ziel-UI | FEHLT | auf Designsystem bauen, ohne neue Fachwahrheit | `03_OPTIKVORLAGE.md`; P-DS-Gate | Struktur bleibt im bestehenden Modul; keine neue Runtime-Abhängigkeit. |
| Noch nicht vorhanden: Dokument-/Send-Port | PDF/Versand | FEHLT | erst nach Q-G06-002/-003; dann als Host-/Modulport, nicht im Kern-Provider | offene Fragen | Bis dahin ausschließlich gedämpfte Elemente, keine Datenmigration. |

## Migrations- und Bestandsdatenurteil

- Für Designsystem-Umbau, Personenrechte-Adapter, G09-Projektion und schnelle Wiederverwendung ist keine G06-Bestandsdatenmigration erforderlich.
- Bestehende KV-, Position-, Receipt- und Eventdaten bleiben unverändert lesbar; Migrationen werden nicht rückwirkend editiert.
- Q-G06-001/-002/-003 können neue dauerhafte Datenwahrheiten erfordern. Dafür ist vor einem Bauticket eine explizite gemeinsame Strukturentscheidung und anschließend eine neue vorwärtsgerichtete Migration erforderlich; dieses Dossier legt keine Tabelle vorab fest.

