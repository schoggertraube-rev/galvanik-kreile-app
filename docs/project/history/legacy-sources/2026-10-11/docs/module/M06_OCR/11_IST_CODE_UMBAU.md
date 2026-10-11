<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Ist-Code und Umbau M06

## Prüfstand

Der Erstlauf dokumentierte den Codebestand ausschließlich lesend gegen den damaligen `origin/main`-Ref `21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`. Im Nachlauf wurde Git wegen des vom Nutzer benannten `dubious ownership` nicht erneut aufgerufen; die aktuelle Ref-Prüfung liegt bei PL (Q-M06-005). Kein Code wurde geändert, gestartet, gestagt oder migriert. Reale Bestandsdaten wurden nicht gelesen; der lokale Worktree blieb unangetastet.

| Bestandteil (Pfad) | Funktion | Stand | Entscheidung (bleibt / umbauen auf Designsystem / ersetzen durch Modul / entfällt) | Beleg | Hinweise Umbau/Bestandsdaten |
|---|---|---|---|---|---|
| `src/modules/dokumentenaufnahme/` | Zielmodul M06 | FEHLT | ersetzen durch Modul: neu innerhalb des später freigegebenen Path-1-Modulbaus | kein Pfad/Manifest/Handshake im Ref | nicht aus diesem Dossierauftrag anlegen; kein Code-SHA |
| `src/app/actions/ocr.actions.ts` | frühere OCR-Actions | GEBAUT als Fail-closed-Quarantäne, Funktion FEHLT | bleibt fail closed bis Adoption; dann dünner Hostadapter auf M06 statt eigener Logik | beide Actions werfen `NOT_AVAILABLE`; Blob `a24080d…`, SHA-256 `3DE3C2ACFF6E` | keine bestehende Mutation übernehmen |
| `src/app/api/ocr-process/route.ts` | frühere OCR-API | GEBAUT als Fail-closed-Quarantäne | bleibt fail closed; später nur freigegebener Serverport oder entfällt als Doppelroute | `notAvailableResponse()` | Requestbody bleibt vor Gate unangetastet |
| `src/app/api/erfassung/scan-upload/route.ts` | Scan-Upload-Route | GEBAUT als Fail-closed-Quarantäne | bleibt fail closed; später Hostadapter auf Original-first-Vertrag | `notAvailableResponse()`; SHA-256 `C2B1B792FD51` | nicht direkt Provider/Persistenz einbauen |
| `src/app/api/erfassung/scan-status/[id]/route.ts` | Scanstatus | GEBAUT als Fail-closed-Quarantäne | bleibt fail closed; später Resume-/Statusport oder entfällt als Doppelweg | `notAvailableResponse()` | Tenant/Rechte serverseitig neu prüfen |
| `src/lib/ocr/types.ts` | alter providerzentrierter OCR-Typ | GEBAUT, unzureichend | ersetzen durch Modulverträge SourceEnvelope/FactLedger; kein Direktimport | alter Vertrag arbeitet mit `imageUrl` | dauerhafte URL vermeiden; Migration nur auf Codevertrag, keine Datenmigration behaupten |
| `src/lib/ocr/GeminiProvider.ts` | direkter Gemini-OCR-Adapter | GEBAUT, QUARANTÄNE | entfällt aus Produktpfad; nicht als Fallback; erst separat löschen, wenn Owner/Repoauftrag | Provider gibt feste/fallbackartige Resultate | `GEMINI_API_KEY` nur Secretname; keine Aktivierung |
| `src/lib/ocr/geminiOcr.ts` | direkter Base64-Gemini-Aufruf | GEBAUT, QUARANTÄNE | entfällt aus Produktpfad | sendet Base64 direkt | verletzt Zielgrenze Original/Port; keine Bestandsdaten |
| `src/lib/ocr/KlippaProvider.ts` | Klippa-Adapter | GEBAUT, QUARANTÄNE | entfällt aus Produktpfad; nie Fallback | Legacyprovider | `KLIPPA_API_KEY` nur Secretname; keine Aktivierung |
| `src/lib/ocr/ManualProvider.ts` | vermeintlich manueller Provider | GEBAUT als Fake/QUARANTÄNE | ersetzen durch echten manuellen M06-Pfad; Fake entfällt | hartcodierter Aral-Beleg/0,88 | keine synthetischen Werte in Produktpfad übernehmen |
| `src/lib/ocr/Verteilung.ts` | alte automatische Verteilung/Mutation | GEBAUT, vertragswidrig | ersetzen durch M06-Zuordnungsentwurf + Hostcommand + Receipt/Readback | direkte/automatische Verteilungslogik | keine alte Mutation ausführen; Bestandswirkungen separat auditieren, nicht hier |
| `src/lib/services/ocrService.ts` | `simulateScan` | GEBAUT als Simulation/DEPRECATED | entfällt aus Produktpfad; isolierte Fixtures nur klar synthetisch | Wartezeit, Demo-Daten, Zufalls-/Festwerte | nicht in M06 importieren |
| `src/lib/buchhaltung/ocr/OcrProvider.ts` | separater Buchhaltungs-OCR-Vertrag | GEBAUT, Schattenvertragsrisiko | ersetzen durch gemeinsamen abstrakten M06-Providerport; Buchhaltung bleibt Consumer | zweiter OCR-Vertrag | keine zweite Providerwahrheit |
| `src/lib/buchhaltung/ocr/MockOcrProvider.ts` | Buchhaltungs-Mock | GEBAUT als Mock/QUARANTÄNE | entfällt aus erreichbarem Produktpfad; nur isolierte gekennzeichnete Tests | Mock/Zufallswerte | keine Fake-Erfolgsmeldung |
| `src/components/erfassung/ScanFlow/ScanUpload.tsx` | alte Scan-Upload-UI | GEBAUT, gesperrt/unvollständig | ersetzen durch Modul und auf Kreile-Designsystem aufbauen | Upload deaktiviert/manueller Weg ohne vollständigen Vertrag | nicht als fertige Optik nutzen |
| `src/components/erfassung/ScanFlow/ScanResult.tsx` | alte Ergebnis-/Aktions-UI | GEBAUT, unvollständig | ersetzen durch M06 Review/Zuordnung/Command-UI | WIP-Aktionen/Alerts | kein Action-Bypass übernehmen |
| `src/components/intake/CameraCapture.tsx` | Kameraaufnahme | GEBAUT, nicht verfügbar | ersetzen durch Modul; Kamera nur bei realer Browserfähigkeit | nicht verfügbar | Original-first und Qualitätszustände nötig |
| `src/components/intake/OCRReviewPanel.tsx` | alte Feldprüfung | GEBAUT, Teilprototyp | umbauen auf Designsystem und ersetzen durch FactLedger-Review im Modul | 0,85-UI vorhanden, aber kein vollständiger Vertrag | Schwelle nur Anzeige; kritische Fakten/HITL ergänzen |
| `src/components/intake/CustomerMatchPanel.tsx` | alter Kundenabgleich | GEBAUT, prototypisch | ersetzen durch Host-Kandidatenport im Modul | simulierte Verzögerung/alter Abgleich | höchstens drei echte Kandidaten, keine erfundene ID |
| `src/components/intake/SuggestedItemsPanel.tsx` | alte Vorschläge/Dateidaten | GEBAUT, prototypisch | ersetzen durch Modul | clientseitige Base64-/Vorschlagslogik | Original nicht im Clientzustand als Wahrheit halten |
| `src/components/buchhaltung/BelegUploadOverlay.tsx` | Belegupload-Demo | GEBAUT, Produktwahrheitsrisiko | umbauen auf Designsystem und ersetzen durch M06-Port/M01-Consumer; Demoaktionen entfallen | Texte `Foto aufnehmen (Demo)`/`Demo-Beleg laden` | keine Demo-Route/-Daten in erreichbarer App |
| `src/components/erfassung/OrderIntakePanel.tsx` | reale Intake-Original-/Attachment-Nutzung | GEBAUT als Hostbasis | bleibt; M06 nutzt abstrahierten Originalport, keinen Internimport | Reserve/Finalize-Actions, Signed Upload | Eigentum bleibt Host/Erfassung; Vertrag wiederverwenden, nicht Daten kopieren |
| `src/lib/server/orderStationAttachment.ts` | Reserve/Finalize und Evidenzleseweg | GEBAUT | bleibt als Hostfähigkeit; hinter `host.document-originals` adaptieren | vorhandene Serverfunktionen und Tests | nicht in M06-Client importieren; Bucket-/Tabellenbesitz bleibt Host |
| `src/lib/server/orderStationAttachmentStorage.ts` | Storageadapter | GEBAUT | bleibt Host-intern; M06 sieht nur opaque SourceReference | bestehender Adapter | keine daueröffentliche URL/kein M06-Secret |
| `src/modules/orders/ui/OrderStationAttachmentPanel.tsx` und Galvanik-Adapter | Auftragsstationsanhänge | GEBAUT, anderes Fachziel | bleibt; nicht mit Dokumentaufnahme verschmelzen | vorhandenes Orders-Modul | Teil-/Statusfoto ist nicht automatisch Dokument/OCR-Quelle |
| `src/test/scan_order.integration.test.ts` | Quarantäne-/Fail-closed-Test | GEBAUT | bleibt und wird bei Modulbau um Contract-, Tenant- und E2E-Tests ergänzt | prüft derzeit Ablehnung/Quarantäne | bestehender Test ist kein M06-Produktpass |
| `src/test/w4_order_station_attachment.integration.test.ts` und Attachment-Tests | Original-/Attachment-Nachweis | GEBAUT | bleibt; als Hostport-Regression erweitern | vorhandene Integration-/Unit-Tests | keine Aussage zu DI/FactLedger |
| `src/db/schema.ts` | Drizzle-Abbildung u. a. `scan_uploads` | GEBAUT, unvollständig gegenüber Baseline | bleibt; vor M06-Adapter Soll-Ist abgleichen; Änderung nur nach Strukturgate | SHA-256 `5A581DFAEC15`; weniger Felder als Baseline | keine Blindmigration; Q-M06-007 |
| `supabase/migrations/20260805180624_production_schema_baseline.sql` | vorhandene Produktionsbaseline | GEBAUT/Bestandswahrheit im Ref | bleibt; `scan_uploads` über Hostport nutzen, keine neue M06-Tabelle | SHA-256 `C472A4C8E436`; Original-/Review-/Idempotenzfelder | keine Remote-Migration; reale Daten nicht geprüft |
| `public.beleg` (Baseline/Accounting-Code) | Buchhaltungsbeleg/OCR-Felder | GEBAUT, Eigentum M01/Host | bleibt bei Buchhaltung; M06 nur über öffentliche Ports/IDs | Baseline und Buchhaltungs-UI | keine Feldkopie/Schattenbuchhaltung |
| `public.item_photos` (Baseline/Orders-Code) | Teil-/Stationsfotos | GEBAUT, Eigentum Erfassung/Orders | bleibt; nicht als M06-Dokumenttabelle umdeuten | Attachment-/Orders-Code | Datenklassen/Retention getrennt halten |

## Umbausequenz nach Öffnung der jeweiligen Umsetzungsgates

1. Baseline/Drizzle/Hostports read-only mappen und Q-M06-007 schließen.
2. Design 1b erstellen/abnehmen; Kreile-DS verwenden, kein Mock-CSS kopieren.
3. M06 off-repo beziehungsweise nach genehmigter Mission als gekapseltes Path-1-Modul mit manuellem Pfad bauen.
4. Quarantäneimporttests zuerst; dann Original/FactLedger/Review/Kandidaten/Command/Receipt/Readback.
5. Provideradapter erst hinter G-M06-003/005 in der Kreile-eigenen S0-Produktionsumgebung; F0-Dev bleibt synthetisch, keine Ressourcenkonfiguration durch den Builder.
6. Bestehende Host-UI nur im seriellen Adoptionsgate auf Modulports umstellen.
7. Alte Pfade erst in einem ausdrücklich autorisierten Folgeauftrag entfernen; keine Löschung in dieser Mission.
8. Dokumentartbezogene Aufbewahrung nur über den Hostvertrag umsetzen; nie still löschen/anonymisieren, sondern Vorschlag, Admin-Freigabe und Receipt verlangen.

## Migrationsbedarf

Ein Migrationsbedarf ist **nicht belegt**. Er darf erst nach Q-M06-007 behauptet werden. Falls vorhandene Felder die Ledger-/Resume-Invarianten nicht tragen, muss der Writer anhalten und genau eine minimale Schemaempfehlung samt Nachteil und höchstens einer kleinen Alternative zur Strukturentscheidung vorlegen. Remote-Migration, RLS-Änderung und Bestandsdatenmutation bleiben verboten, bis sie ausdrücklich freigegeben sind.
