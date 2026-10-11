<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G05 Kunden — IST-Code und Umbau

Bewertet wurde ausschließlich der gecachte `origin/main`-Stand `21a23567d51e`; der lokale Dirty-Worktree bleibt unangetastet. „Bleibt“ bedeutet fachlich/technisch retten und weiter testen, nicht automatische visuelle Freigabe.

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| `src/modules/customers/customers.manifest.json` | Eigentum, Abhängigkeiten, Migration, Event | GEBAUT | bleibt | SHA `63F9F9BA042C` | Bei neuen Commands/Events erst nach Q-Entscheidungen versioniert erweitern. |
| `src/modules/customers/public.ts` | öffentliche Customer-UI-/Create-Typen | GEBAUT | bleibt | SHA `737CFE48C6A0` | Keine privaten Deep-Imports; neue Felder kompatibel/versioniert. |
| `src/modules/customers/server-public.ts` | serverseitiger öffentlicher Create/Read-Vertrag | GEBAUT | bleibt | SHA `66F5F8D431D9` | Update/Phone-note nicht vor Q-G05-002/003 hinzufügen. |
| `src/modules/customers/server/createCustomerCommand.ts` | sichere Kundenanlage mit Idempotenz/Receipt | GEBAUT | bleibt | SHA `991696E616AE`; Tests `E72EB254D38B` | Input um Anschrift erst mit Test/Migrationserfordernis prüfen; vorhandene reale Daten nicht synthetisch überschreiben. |
| `supabase/migrations/20260914100000_path1_customer_persistence_contract.sql` | Counter, Customer-Create, Event/Receipt/Readback | GEBAUT | bleibt | SHA `0FD379886555` | Keine Remote-Ausführung aus diesem Auftrag; additive Folgemigration statt Änderung einer angewandten Migration. |
| `src/app/actions/customers.actions.ts` | Customer-Reads/Create und fail-closed Legacy-Update | TEILWEISE GEBAUT | ersetzen durch Modul | SHA `09E90F661B94` | Reads/Create auf öffentliche Modulports konsolidieren; `NOT_AVAILABLE` nicht durch Repository-Fallback ersetzen. |
| `src/app/customers/CustomersAppAdapter.tsx` | reale Kundenliste/Suche/Zustände | GEBAUT mit Mock-CSS | umbauen auf Designsystem | SHA `29054864491E`; Tests `7161B683B749` | Logik/Zustandstexte retten; nur `kr-`-Komponenten/Tokens nach Phase 1. |
| `src/app/customers/CustomerCardAppAdapter.tsx` | Customer-Summary in Route | GEBAUT | umbauen auf Designsystem | SHA `C04F613B41CD` | Dünner HostAdapter bleiben; keine zusätzliche Fachlogik. |
| `src/modules/customers/ui/CustomerCardView.tsx` | Kundenkarte mit Kontakten, Aufträgen, Notiz und Zuständen | GEBAUT mit Mock-CSS, inhaltlich teilweise | umbauen auf Designsystem | SHA `5F6D5BB6FEFB`; Test `79C3071191A6` | Reale leere Zustände erhalten; ungebaute Bereiche nach `08` ausgrauen; Analyse/Marketing nicht übernehmen. |
| `src/modules/customers/ui/customers.module.css` | heutiges visuelles Customer-Styling | Mock-CSS | umbauen auf Designsystem | Red-Team RT-28; Codeinventar | Keine Farbwerte/Klassen kopieren; nach Phase 1 durch `kr-`-Tokens/-Komponenten ersetzen. |
| `src/components/layout/GlobalCreateFlow.tsx` | globaler Kundenanlageweg mit Receipt/Readback | GEBAUT, Felder teilweise | umbauen auf Designsystem | SHA `D9E7976D7FF7`; E2E `D8CDD026FEE3` | Sicheren Flow retten; Straße/PLZ ergänzen; Dubletten erst nach Q-G05-001; keine Demo-Kunden. |
| `src/app/customers/page.tsx` und `src/app/customers/[id]/page.tsx` | Routenkomposition | GEBAUT | bleibt | origin/main PR #112/Bestandsinventar | Routen dünn halten; ganze Placeholder-Routen vermeiden. |
| `src/modules/customers/__tests__/CustomerSurfaces.v2.test.tsx` | UI-Zustands-/Interaktionstests | GEBAUT | bleibt | SHA `79C3071191A6` | Um alle sieben Zustände, Backstack und ausgegraute Negativfälle ergänzen. |
| `src/modules/customers/__tests__/createCustomerCommand.test.ts` | Command-/Receipt-Test | GEBAUT | bleibt | SHA `E72EB254D38B` | Tenant, Idempotency, Unknown Outcome und neue Anschriftfelder abdecken. |
| `src/test/path1_customer_persistence.integration.test.ts` | Persistenzintegration | GEBAUT | bleibt | SHA `8B4DD31A65FB` | Nur synthetische Testdaten; keine Remote-/Echtdatenmigration. |
| `src/test/path1_customers_read_states.test.tsx` | reale Read-Zustände | GEBAUT | bleibt | SHA `7161B683B749` | Teilquellenausfall und keine-Fake-Daten ergänzen. |
| `src/components/erfassung/shared/DuplicateWarning.tsx` | Legacy-Dublettenwarnung | UNVERDRAHTET/Mock | ersetzen durch Modul | SHA `5C3DCF8499C6`; RT-10 | Erst nach Q-G05-001 durch serverautoritativen G05-Port; nicht reaktivieren. |
| `src/app/api/erfassung/customer-search/route.ts` | Legacy-Kundensuche | `notAvailable` | ersetzen durch Modul | SHA `088388E91906` | Öffentliche G05-Reads verwenden; „nicht verfügbar“ nie als „kein Treffer“ interpretieren. |
| `src/components/telefonnotiz/TelefonnotizDesktop.tsx` | Telefonnotizoberfläche | FoundationUnavailable-Stub | ersetzen durch Modul | SHA `EDC329FDE6D9`; RT-16 | Stub nicht zeigen; bis Q-G05-003 nur nicht klickbares Element „In Klärung“. |
| `src/app/actions/phoneNotes.actions.ts` | Legacy-CRUD Telefonnotiz | alle Writes `NOT_AVAILABLE` | ersetzen durch Modul | SHA `0684A6E7F7D0` | Sicheren G05 server-public Command nicht vor Q-G05-003 erfinden. |
| `src/app/actions/analyzePhoneNote.ts` | Analyseaktion | liefert `null` | ersetzen durch Modul | SHA `5E383618962C` | Kein Provider/Erfolg behaupten; manueller Rohnotizweg muss unabhängig funktionieren. |
| `src/hooks/usePhoneNoteAnalysis.ts` | Clientanalyse mit leeren Mock-Kunden/-Aufträgen | UNVERDRAHTET/Mock | entfällt | SHA `0AA20A524CBC` | Nicht salvagen; künftige Faktenpipeline folgt D-AI-002 und echten Ports. |
| `src/components/telefonnotiz/FloatingParkedCall.tsx` | LocalStorage-Parkzustand | Legacy/UNVERDRAHTET | entfällt | SHA `2E5BADD6E4B3` | Kein LocalStorage als Fachwahrheit oder Retentionumgehung. |
| `src/app/telefonnotiz/layout.tsx` und `telefonnotiz.css` | leere Route/Mock-Styling | kein sicherer Produktscreen | entfällt | Red-Team RT-16; Repo-Inventar | Keine ganze Placeholder-Route; Funktion später in Intake/Kundenkarte anbinden. |
| `src/db/schema.ts` — `public.customers` | breites Legacy-/Ist-Schema | GEBAUT | bleibt als Dateninventar | SHA `5A581DFAEC15` | Feldexistenz ist keine Produktfreigabe; öffentliche Verträge bleiben maßgeblich. Bestehende Daten vor additiver Migration inventarisieren. |
| `src/db/schema.ts` — `public.phone_notes` | bestehendes Telefonnotizschema | SCHEMA VORHANDEN, Produktweg fehlt | ersetzen durch Modul | SHA `5A581DFAEC15` | Q-G05-003 prüft, ob sicher härtbar; keine neue Tabelle/Remote-RLS ohne Freigabe. |
| `src/lib/privacy/dsgvoAnonymizer.ts` | Legacy-Anonymisierer | NICHT FUNKTIONSFÄHIGER Produktweg | ersetzen durch Modul | SHA `DA5E86F464B3` | Hardcodierte Werte/Repository-Update nicht nutzen; nur Vorschlag + Adminfreigabe nach Q-G05-006. |
| `src/app/marketing/components/KundenView.tsx` und kundenbezogene Analyse-/Performance-Kacheln | Marketing/Analyseansichten | außerhalb G05 | entfällt aus G05 | MODULKARTE OUT-Liste | Nicht löschen oder nach G05 ziehen; spätere zuständige Module/Ports entscheiden. |

## Bestandsdaten und Migration

- Es wurden keine Daten verändert und keine Migration ausgeführt.
- Vor einer additiven Änderung sind reale Null-/Formatverteilungen für Anschrift, Kontaktdaten, Zahlungsziel, Notizen und vorhandene `phone_notes` read-only zu inventarisieren; dieses Dossier behauptet keine Echtdatenqualität.
- Test- und Demo-Daten bleiben ausschließlich synthetisch und klar als solche markiert.
- Bereits angewandte Migrationen werden nicht umgeschrieben. Jede erforderliche Erweiterung benötigt ein eigenes Gate, Backfill-/Rollback-Konzept und unabhängige Prüfung.
