<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# IST-Code und Umbauentscheidung

Bestandsurteil gilt für `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`. Dieses Dossier führt keine Migration aus und verändert keine Bestandsdaten. Bestehende echte Daten werden nie durch synthetische Werte ergänzt.

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| `src/components/layout/GlobalCreateFlow.tsx` | globaler V5-Kunde/KV/Direktintake samt Zuständen | GEBAUT, Zielumfang teilweise | ersetzen durch Modul | SHA `D9E7976D7FF7`; Real-Render-Test | Ablauf in `src/modules/erfassung/ui/` teilen; Shell importiert nur Public-Fassade; vorhandene Receipt-/Unklar-Logik erhalten |
| `src/app/GlobalCreateAppAdapter.tsx` | bindet Session, Actions, Navigation und Modulports | GEBAUT | bleibt | SHA `2E48304973B6` | dünn halten; keine Fachvalidierung; OE-2609-09-Capability statt Legacy-Permissions anbinden |
| `src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx` | Kunde→KV→Auftrag, Direct-Intent, Read-/Fehlerzustände | GEBAUT | bleibt | SHA `D32EFC869C76` | Imports auf Public-Fassade umstellen; Zielzustände/Adressen/Zahlung/Termine ergänzen |
| `src/components/erfassung/ErfassungProvider.tsx`, `ErfassungModal.tsx`, `StartGate.tsx` | älterer paralleler Erfassungsdialog | GEBAUT, parallel | ersetzen durch Modul | Importbelege in Header/Kommandozentrale/Shortcut; Warendurchlauf-Test schließt Provider bereits aus | alle Trigger auf denselben G03-Create-Intent; keinen zweiten Writer behalten |
| `src/components/erfassung/ManualFlow/ManualWizard.tsx`, `CustomerWizard.tsx`, `CustomerSection.tsx`, `DateSection.tsx`, `ItemsSection.tsx` | älterer manueller Wizard | GEBAUT, uneinheitlich | ersetzen durch Modul | `ManualWizard` lädt `OrderIntakePanel`; Alt-Dublettenkomponente | nur belegte Such-/Dublettenlogik übernehmen; keine Fetch-API als Schattenport |
| `src/components/erfassung/InquiryFlow/InquiryToQuote.tsx` | ältere Anfrage→KV-Oberfläche | GEBAUT, parallel | ersetzen durch Modul | ErfassungModal-Import | KV bleibt im Quotes-Modul; G03 komponiert dessen Public-Port |
| `src/components/erfassung/OrderIntakePanel.tsx` | F1.1 manueller Intake, Receipt/Readback, Originalfoto | GEBAUT | ersetzen durch Modul | SHA `5C0275447321`; Komponenten-/Integrationstests | sichere Command-/Readback-/Foto-Logik übernehmen; UI auf V5/Designsystem; keine parallele Mutation |
| `src/components/erfassung/shared/DuplicateWarning.tsx` | warnende Bestandskundendublette | GEBAUT, nicht kanonisch integriert | umbauen auf Designsystem | SHA `5C3DCF8499C6` | deterministische Regel erst nach Q-G03-003; nie Auto-Merge |
| `src/components/erfassung/shared/ItemPhotoUploader.tsx` | älterer Foto-Uploadbaustein | GEBAUT, Parallelbestand | ersetzen durch Modul | Quarantäne-/Containment-Bestand | nur Evidenz-Port nutzen; keine direkte Storage-Wahrheit in UI |
| `src/components/erfassung/BestaetigenButton.tsx`, `ErfassungCard.tsx`, `ErfassungSheet.tsx`, `MengenStepper.tsx`, `VorschlagBanner.tsx`, `ZeitSlider.tsx` | ältere UI-Bausteine | GEBAUT, kein freigegebenes DS | umbauen auf Designsystem | Verzeichnisinventar `src/components/erfassung/` | nur fachlich belegte Interaktionen übernehmen; `kr-`-Komponenten nach Designphase 1, kein Mock-CSS |
| `src/components/erfassung/ScanFlow/ScanUpload.tsx`, `ScanResult.tsx` | OCR-/Scanweg im alten Modal | HINTEN_ANGESTELLT/Quarantäne | entfällt | OP-09; OE-2609-04; Quarantänetests | aus G03 entfernen; M06 baut eigenen Adapter gegen G03-Port, kein Code- oder Provider-Fallback |
| `src/components/intake/CameraCapture.tsx`, `CustomerMatchPanel.tsx`, `IntakeEntry.tsx`, `OCRReviewPanel.tsx`, `SuggestedItemsPanel.tsx` | unverbundener älterer OCR-Intake | Quarantäne/kein kanonischer Import | entfällt | `git grep` findet nur Definitionen/TODO für diese Gruppe | nicht in G03 übernehmen; M06 darf nur belegte Konzepte, keine simulierte Funktion übernehmen |
| `src/app/actions/erfassung.actions.ts` | Server-Action-Grenze für alten/neuen Intake | GEBAUT | bleibt | Containment-Test | auf `server-public.ts` reduzieren; keine Imports interner Moduldateien |
| `src/app/api/erfassung/customer-search/route.ts` | älterer Kunden-Such-HTTP-Weg | GEBAUT, Parallelport | ersetzen durch Modul | `CustomerSection.tsx` nutzt Route | Suche über Kunden-Public-Port; keine zweite Ergebnisform |
| `src/app/api/erfassung/item-photo-upload/route.ts` | ältere Foto-Uploadfreigabe | GEBAUT | ersetzen durch Modul | API-Inventar; vorhandener Evidenzvertrag | durch Evidenz-Public-Port/Actions ersetzen; Bucket- und Receipt-Semantik erhalten |
| `src/app/api/erfassung/scan-upload/route.ts`, `scan-status/[id]/route.ts`, `customer-enrich/route.ts`, `freetext-extract/route.ts`, `inquiry-extract/route.ts`, `notes-extract/route.ts` | alte Provider-/Extraktionsrouten | Quarantäne/Providergrenze ungeklärt | entfällt | Quarantänetests; OP-09 | nicht aus G03 erreichbar; spätere Adapter gehören M06 oder einem eigens freigegebenen Modul |
| `src/lib/server/commands/orderIntakeCommand.ts` | atomarer F1.1-Command, Idempotenz, Nummernlock, Event/Receipt | GEBAUT | ersetzen durch Modul | SHA `0409B46490A4`; Integration `B82BFCD5CC8D` | Semantik in `src/modules/erfassung/server/` bewahren; V2 ergänzt Wunsch/Zusage/Eingang/Zahlung/Express; V1 nicht still ändern |
| `src/lib/server/orderIntakeRead.ts` | Receipt-Readback | GEBAUT | ersetzen durch Modul | SHA `A221D5DA2FD6` | V1 und V2 explizit lesen; Altbestand nicht als erfundener Terminwunsch anzeigen |
| `src/lib/services/intakeService.ts` | absichtlich fail-closed gelegter alter Service | Quarantäne/`NOT_AVAILABLE` | entfällt | Quarantäne- und fail-closed Tests | bis Entfernung fail-closed lassen; niemals als Fallback aktivieren |
| `src/lib/erfassung/klassifikator.ts`, `snapshot.ts`, `src/db/schema_erfassung.ts` | ältere Erfassungs-/Kalkulationshilfen | Altbestand, nicht aktueller Intake-Vertrag | entfällt | altes Erfassungsmanifest `B5E2ED819109` | Eigentümer separat klären; nicht in G03-Datenmodell kopieren |
| `docs/architecture/modules/erfassung.manifest.json` | altes Manifest mit OCR/Scans | ÜBERHOLT | ersetzen durch Modul | SHA `B5E2ED819109` | neues `src/modules/erfassung/erfassung.manifest.json`; OCR- und Anbieterbesitz entfernen |
| `src/modules/customers/` | kanonischer Kunden-Command/Read/Public-Port | GEBAUT | bleibt | Manifest `63F9F9BA042C`; Command `991696E616AE` | Public-Vertrag um Straße/PLZ/Ort/Notiz und Receipt-Readback erweitern; keine neue Kundentabelle |
| `src/modules/quotes/` | persistenter KV, Versionierung, Conversion | GEBAUT | bleibt | Manifest `83B48043CD95`; Command `B4EE0EB9CF28` | Public-Port verwenden; Positionssnapshots und exakt-ein-Auftrag-Garantie behalten |
| `supabase/migrations/20260812133649_f1_order_intake_contract.sql` | Intake-Event/Receipt/Constraints | GEBAUT | bleibt | SHA `1A9D69BA9647` | historische Migration nie ändern; V2 nur per Vorwärtsmigration |
| `supabase/migrations/20260905201850_f1_5_payment_mode_intake_contract.sql` | Payment-Mode und Default | GEBAUT, Owner-Regel nicht vollständig | bleibt | SHA `4D61ED0800DF` | historische Migration nie ändern; neue Server-/DB-Regel vorwärts ergänzen |
| `supabase/migrations/20260914100000_path1_customer_persistence_contract.sql` | Kundenreceipt/-nummer | GEBAUT | bleibt | SHA `0FD379886555` | nur Public-Vertrag/Forward Migration erweitern |
| `supabase/migrations/20260914110000_path1_quote_persistence_contract.sql`, `20260916090000_path1_quote_product_lifecycle.sql` | KV-Persistenz/Lifecycle | GEBAUT | bleibt | `AE82314EB68D`, `DA29633EAB78` | nicht umschreiben |
| `src/test/f1_order_intake.integration.test.ts` | Fresh-Supabase-Intake, Replay, Tenant, Rechte | GEBAUT | bleibt | SHA `B82BFCD5CC8D` | um V2-Felder, Rollenmodell und Nummernparallelität ergänzen |
| `src/test/path1_customer_persistence.integration.test.ts` | Kundenpersistenz/Receipt | GEBAUT | bleibt | SHA `8B4DD31A65FB` | Adresse/Notiz/Dublettenwarnung ergänzen |
| `src/test/path1_quote_to_order.integration.test.ts` | KV-Persistenz und genau-eine Conversion | GEBAUT | bleibt | SHA `5D1AB9418F8C` | neue Intake-V2-Felder und Terminprojektion ergänzen |
| bestehende V1-Intake-Datensätze (`source='F1_ORDER_INTAKE'`, V1-Receipt) | bisher nur ein als Zusage behandeltes `due_date` | Bestandsdaten vorhanden möglich | bleibt | Command-Kommentar/Schema-Ist | Forward-Migration plant: Wert nach `promised_due_date`, `due_date=NULL`; Readmodell zeigt `Terminwunsch nicht separat erfasst`; keine Remote-Ausführung ohne Freigabe |

## Zielbaum

```text
src/modules/erfassung/
  public.ts
  server-public.ts
  erfassung.manifest.json
  ui/
    OrderIntakeFlow.tsx
    ...Designsystem-Komponenten
  server/
    createOrderIntakeCommand.ts
    orderIntakeRead.ts
    types.ts
  __tests__/
```

Der Zielbaum ist die bereits vorgegebene Path1-Modulstruktur, kein zweites Repository und keine neue Fachdomäne. Kunden, KV, Evidenz, Termine, M04 und M06 bleiben über Ports außerhalb dieses Baums.

