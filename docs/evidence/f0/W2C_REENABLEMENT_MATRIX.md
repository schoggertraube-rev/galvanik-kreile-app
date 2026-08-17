# W2C Restgraph-Audit und Wiederfreigabematrix

```yaml
AUDIT_HEAD: ba9b787e0a7089e7ab9eb1140a299f9c2e864e50
W2C_LOCAL_SOURCE_CLOSEOUT: PASS
F0_FINAL_STATUS: FAIL_INTERNAL
W3: REQUIRED
W4: REQUIRED
REMOTE_EDGE_RECONCILIATION: BLOCKED_EXTERNAL_PERMISSION
AUDIT_MODE: einmaliger abschließender W2C-Restgraph-Audit
NEXT_PHASE: W3
GOAL: sichere Wiederaktivierung; keine sichere leere App
```

## Evidenzgrenze und Schluss

Dieser Audit erzeugt keine Test-, Build-, Remote-, Production- oder F0-PASS-Behauptung. Er dokumentiert ausschließlich den lokalen Quellstand `ba9b787e0a7089e7ab9eb1140a299f9c2e864e50`. Die unmittelbar vorhergehende, getrennte Evidence ist: Commit-Hook **74 Test Files / 373 Tests PASS**. Sie ist kein Nachweis dieses Audits und kein F0-Abschluss.

`W2C_LOCAL_SOURCE_CLOSEOUT=PASS` gilt nur für W2C-01..09: die gefundenen aktiven gefährlichen Pfade sind lokal fail-closed oder truthful contained. Die App bleibt nicht leer: Login, Auftrags-/Kunden-/Inventar-Reads und Warendurchlauf-Listen bleiben verfügbar. Kein uncontainable P0 wurde gefunden. W3 und W4 bleiben erforderlich; `F0_FINAL_STATUS=FAIL_INTERNAL` bleibt unverändert.

## W2C-01..09 Kurzmatrix

| ID | Lokaler Kurzbeleg | Status |
|---|---|---|
| W2C-01 | Scan-/Foto-/Erfassungs-UI ist denied; 18 API-Routen liefern `503 NOT_AVAILABLE` mit `no-store`. | PASS_LOCAL |
| W2C-02 | Legacy-ID-only für Auftrag, Item, Kunde und Detail ist denied oder unavailable. | PASS_LOCAL |
| W2C-03 | `updateOrderDb`, `transitionOrderProcess`, `startProcessingStation` und `startProcessingStationService` sind denied. | PASS_LOCAL |
| W2C-04 | OCR, KI, Mail, Zahlung und Extraction sind lokal denied; 13 Edge Functions lokal denied. | PASS_LOCAL |
| W2C-05 | Today-/Status- sowie Today-/Cron-APIs liefern keine synthetische Wahrheit. | PASS_LOCAL |
| W2C-06 | Create-/Send-/Payment-/Inventory-/Time-/Tracking-Commands sind geschlossen; Offline sendet und löscht nichts. | PASS_LOCAL |
| W2C-07 | Relevante Denials haben keinen fachlichen Port. | PASS_LOCAL |
| W2C-08 | Negative Tests liegen als getrennte Commit-Hook-Evidence vor. | PASS_LOCAL |
| W2C-09 | Nur `ServiceWorkerRegister` ist aktiv; `public/sw.js` cached ausschließlich drei statische Assets. | PASS_LOCAL |

## Status-Legende

| Status | Bedeutung |
|---|---|
| `DENIED_INTERNAL/W3_W4` | Lokal bewusst abgeschaltet; Wiederfreigabe erst nach nachgewiesenem W3-/W4-Vertrag. |
| `DENIED_PRODUCT_DECISION/W3_W4` | Lokal abgeschaltet; zusätzlich Produktentscheidung nötig. |
| `LOCAL_DENIED/REMOTE_SOURCE_UNRECONCILED` | Lokal abgeschaltet; Remote-Gegenstück ist ohne Production-Owner-Freigabe nicht abgleichbar. |
| `FIRST_W3_REENABLEMENT_CANDIDATE` | Einziger erster Wiederaktivierungsschnitt; Legacy-Einstiege bleiben denied. |
| `PARTIALLY_CONTAINED/W4` | Aktive Oberfläche sicher eingegrenzt; persistente/offline/realtime Wiederfreigabe erst in W4. |

## Wiederfreigabematrix: Routen R-01 bis R-04

### R-01 Analyse, Qualität und Komfort-KPIs

```yaml
group: R-01
route_funktion:
  - /analyse
  - /betrieb-kvp
  - /kontrolle
  - /print-queue
  - /performance
  - /performance/baeder-material
  - /performance/ki-empfehlungen
  - /performance/kunden-markt
  - /performance/qualitaet-risiko
  - /performance/umsatz-marge
  - /performance/werkstatt-puls
  - /settings
konkretes_risiko: kein einheitlicher Session-, Tenant-, Capability- und Read-Model-Vertrag; Gefahr von Demo-/synthetischen KPIs.
abgeschalteter_einstieg: FoundationUnavailable oder deaktivierte Interaktion.
erforderlicher_w3_w4_vertrag: W3 tenant- und capability-geprüfte Reads/Commands; W4 versionierte v_*-Read-Ports sowie Event-/Messwahrheit.
wiederfreigabekriterien:
  - dokumentierter Tenant-Port
  - getrennte Loading-, Unavailable- und Empty-Zustände
  - keine Demo-KPI oder grüne Nullwahrheit
  - W3-Mutation mit Version, sofern die Route schreibt
externer_blocker: NONE.
status: DENIED_INTERNAL/W3_W4
```

```yaml
subgroup: R-01-P
route_funktion:
  - /baeder
  - /lager
konkretes_risiko: fachliche Mess- oder Bestandsregel ohne bestätigte Produktdefinition.
abgeschalteter_einstieg: FoundationUnavailable oder deaktivierte Interaktion.
erforderlicher_w3_w4_vertrag: W3 tenant- und capability-geprüfter Read-/Command-Port; W4 versioniertes v_*-Read-Model und Mess-/Ereigniswahrheit.
wiederfreigabekriterien: bestätigte Fachregel, dokumentierter Tenant-Port, getrennte Loading-/Unavailable-/Empty-Zustände, keine Demo-KPI.
externer_blocker: BLOCKED_PRODUCT_DECISION: Bad-/Lagerfachregel.
status: DENIED_PRODUCT_DECISION/W3_W4
```

### R-02 Buchhaltung, Belege, Perioden und Export

```yaml
group: R-02
route_funktion:
  - /buchhaltung
  - /buchhaltung/ausgaben
  - /buchhaltung/belege
  - /buchhaltung/belege/[id]
  - /buchhaltung/bwa
  - /buchhaltung/export
  - /buchhaltung/kosten
  - /buchhaltung/kosten/neu
  - /buchhaltung/kosten/[id]
  - /buchhaltung/kraftstoff
  - /buchhaltung/periodenabschluss
  - /buchhaltung/rechnungen
  - /buchhaltung/rechnungen/neu
  - /buchhaltung/rechnungen/[id]
  - /buchhaltung/steuerprofil
  - /buchhaltung/belege/neu (Upload deaktiviert)
konkretes_risiko: Legacy-Beleg ohne bestätigte Tenant-/Steuerklassifikation sowie unsichere Detail-, Export-, Upload- und Periodenpfade.
abgeschalteter_einstieg: FoundationUnavailable; Detail-/Export-/Upload-/Periodenaktion denied oder deaktiviert.
erforderlicher_w3_w4_vertrag: W3 Finanz-Capability, Tenant, Ownership und Version; W4 private Attachments/Evidence, append-only Accounting-Events und v_*-Reads.
wiederfreigabekriterien:
  - bestätigte Tenant-, Steuer- und Objektzuordnung vor jedem Read/Write/Export
  - private Evidence-Metadaten
  - Result-Union für Erfolg, Denial und Konflikt
  - keine grüne Null- oder Defaultwahrheit
externer_blocker: BLOCKED_PRODUCT_DECISION: DEC-01 Steuer/Accounting, DEC-02 Legacy-Beleg-Mapping, DEC-03 Bucket-/Altobjekt-Zuordnung.
status: DENIED_PRODUCT_DECISION/W3_W4
```

### R-03 Marketing, Einwilligung und Provider

```yaml
group: R-03
route_funktion:
  - /marketing
  - /marketing/aktion
  - /marketing/aktion/neu
  - /marketing/attribution
  - /marketing/einwilligungen
  - /marketing/kanaele
  - /marketing/segmente
  - /marketing/segmente/neu
  - /marketing/segmente/[id]
  - createAktion
  - changeAktionStatus
  - updateKanalConfig
  - createSegment
  - updateSegment
  - deleteSegment
konkretes_risiko: Seed-/Prognose-/Providerpfade ohne Tenant-, Consent- und Capability-Vertrag.
abgeschalteter_einstieg: Routen und genannte Funktionen denied.
erforderlicher_w3_w4_vertrag: W3 Command- und Consent-Vertrag; W4 Telemetrie, Attribution und Provider-Receipts.
wiederfreigabekriterien:
  - kein Seed-on-Read
  - keine erfundene Reichweite oder ROI
  - Tenant-gebundene Einwilligung
  - idempotenter Provider-Receipt
externer_blocker: BLOCKED_PRODUCT_DECISION: Provider-/Kanalentscheidung.
status: DENIED_PRODUCT_DECISION/W3_W4
```

### R-04 Token, Kommunikation, Angebot, Today und Telefonnotiz

```yaml
group: R-04
route_funktion:
  - /feedback/[token]
  - /quotes
  - /quotes/new
  - /status
  - /today
  - getInquiries
  - getOpenInquiriesCount
  - createInquiry
  - createStatusEvent
  - getStatusEventsByOrderId
  - getStatusEventsByItemId
  - getRecentStatusEvents
konkretes_risiko: Token-/ID-Detailzugriff sowie Anfrage-, Status- und Today-/Cron-Wahrheit ohne Ownership- oder Eventvertrag.
abgeschalteter_einstieg: Route/Funktion denied; Feedbacktoken liefert keinen falschen Erfolg.
erforderlicher_w3_w4_vertrag: W3 Session-Tenant, Capability und Ownership; W4 append-only Status-/Anfrageereignisse, Korrelation, Idempotenz und Today-v_*-Port.
wiederfreigabekriterien:
  - Token ist scoped und ablaufbar
  - Actor, Tenant, Ownership, Version und Result-Union vor jedem Command
  - Today liest nur versioniertes v_*-Read-Model
externer_blocker: NONE.
status: DENIED_INTERNAL/W3_W4
```

```yaml
subgroup: R-04-P
route_funktion:
  - extractCustomerDataFromFreetext
  - enrichCustomerData
  - askGlobalAiAction
konkretes_risiko: Providerwirkung ohne abgeglichenen Remote-/Kosten- und Tenantvertrag.
abgeschalteter_einstieg: die providergebundenen Einstiege bleiben denied.
erforderlicher_w3_w4_vertrag: W3 Server-Actor, Tenant, Capability und Ownership; W4 Provider-Receipt, Korrelation, Idempotenz und Kosten-/Replaynachweis.
wiederfreigabekriterien: lokaler und remote abgeglichener Head, Tenant-/Kostennachweis, kein Providerport vor Guard.
externer_blocker: BLOCKED_EXTERNAL_PERMISSION: Provider-Live-Reconciliation.
status: LOCAL_DENIED/REMOTE_SOURCE_UNRECONCILED
```

```yaml
subgroup: R-04-I
route_funktion:
  - /kommunikation
  - /telefonnotiz
  - KommunikationClient
  - PhoneNoteDetailView
  - TelefonnotizDesktop
  - GlobalSearch
  - createPhoneNote
  - getRecentPhoneNotes
  - updatePhoneNote
konkretes_risiko: Kommunikations-, Telefonnotiz- und Suchzugriff ohne tenantgebundene Capability, Ownership und Ereignisvertrag.
abgeschalteter_einstieg: alle genannten internen Kommunikations-, Telefonnotiz- und Sucheinstiege bleiben denied.
erforderlicher_w3_w4_vertrag: W3 Session-Tenant, Capability und Ownership; W4 append-only Kommunikationsereignisse, Korrelation, Idempotenz und Readback.
wiederfreigabekriterien: Actor, Tenant, Ownership, Version und Result-Union vor jedem Command; negative Tenant-/Ownership-Tests; Reload-Readback.
externer_blocker: NONE.
status: DENIED_INTERNAL/W3_W4
```

## Wiederfreigabematrix: Funktionen und Plattform A-01 bis A-08

### A-01 Next-APIs

```yaml
group: A-01
route_funktion:
  - /api/morning-message
  - /api/email/send
  - /api/cron/send-feedback
  - /api/ocr-process
  - /api/users
  - /api/payments/mollie/create
  - /api/today/has-deadlines
  - /api/today/timeline
  - /api/today/important
  - /api/today/status
  - /api/erfassung/customer-enrich
  - /api/erfassung/customer-search
  - /api/erfassung/freetext-extract
  - /api/erfassung/inquiry-extract
  - /api/erfassung/item-photo-upload
  - /api/erfassung/notes-extract
  - /api/erfassung/scan-upload
  - /api/erfassung/scan-status/[id]
konkretes_risiko: Provider-, Storage- oder DB-Zugriff vor Autorisierung sowie synthetische Antwortwahrheit.
abgeschalteter_einstieg: jede Route 503 NOT_AVAILABLE mit no-store.
erforderlicher_w3_w4_vertrag: W3 route-spezifischer Server-Guard; W4 Evidence-/Provider-Receipt je Route.
wiederfreigabekriterien:
  - Guard vor jedem Port
  - Negativnachweis: 0 DB-, Storage- und Provider-Kosten
  - keine Public URL
  - Receipt bei erfolgreicher Wirkung
externer_blocker: NONE.
status: DENIED_INTERNAL/W3_W4
```

### A-02 Edge Functions

```yaml
group: A-02
route_funktion:
  - customer-enrich
  - email-send
  - email-webhook
  - freetext-extract
  - inquiry-extract
  - item-photo-analyze
  - kpi-insight
  - mollie-create-payment
  - mollie-webhook
  - notes-extract
  - payments-intent
  - payments-webhook-mollie
  - scan-analyze
konkretes_risiko: Service-Role-, Provider-, Webhook- und Paymentpfade ohne serverseitigen Actor/Tenant/Ownership-Vertrag.
abgeschalteter_einstieg: alle lokalen Functions liefern NOT_AVAILABLE.
erforderlicher_w3_w4_vertrag: W3 serverseitiger Actor, Tenant, Capability und Ownership; W4 Evidence-/Provider-Receipt, Idempotenz, Korrelation und Webhook-Signatur.
wiederfreigabekriterien:
  - lokaler, Deploy- und Live-Stand derselbe Head
  - Replay-, Tenant- und Kostennachweise
  - kein Service-Role-Wert in einer Response
externer_blocker: BLOCKED_EXTERNAL_PERMISSION: in der vorherigen Live-Reconciliation dokumentierte 11 Functions; in diesem Audit nicht remote verifiziert.
status: LOCAL_DENIED/REMOTE_SOURCE_UNRECONCILED
```

### A-03 Auftrags- und Stationswechsel

```yaml
group: A-03
route_funktion:
  - updateOrderDb
  - transitionOrderProcess
  - startProcessingStation
  - startProcessingStationService
  - StationStatusButton
  - OrderActionGrid
  - /station/[slug]
  - /warendurchlauf
  - /warendurchlauf/wareneingang
  - /warendurchlauf/galvanik
  - /warendurchlauf/warenausgang
  - /orders/[id]
  - getRiskOrders
konkretes_risiko: ID-only-Auftrag ohne Capability/Ownership/Version sowie geteilte Order-/Item-/Event-Schreiber.
abgeschalteter_einstieg: genannte Writer und UI-Aktionen denied.
erforderlicher_w3_w4_vertrag: vollständiger W3 Server-Command-Vertrag; W4 Event-/Evidence-Readback.
wiederfreigabekriterien:
  - genau ein atomarer Server-Command
  - Session-Actor und Session-Tenant
  - perm_op_status
  - Auftrags-ID plus Tenant- und Item-Ownership
  - expectedVersion mit explizitem Konflikt
  - tenantgebundene Items atomar
  - diskriminierte Result-Union und Negativtests
externer_blocker: NONE.
status: FIRST_W3_REENABLEMENT_CANDIDATE
```

```yaml
subgroup: A-03-P
route_funktion: persönliche Stationszuweisung innerhalb des Stationswechsels
konkretes_risiko: fachliche Zuweisungsregel ohne bestätigte Produktentscheidung.
abgeschalteter_einstieg: persönliche Zuweisung bleibt nicht Teil des ersten W3-Schnitts.
erforderlicher_w3_w4_vertrag: W3 Command-Vertrag mit expliziter Zuweisungs-Capability; W4 append-only Zuweisungsevent und Readback.
wiederfreigabekriterien: bestätigte fachliche Zuweisungsregel, Capability, Ownership, Version und Negativtests.
externer_blocker: BLOCKED_PRODUCT_DECISION: persönliche Stationszuweisung.
status: DENIED_PRODUCT_DECISION/W3_W4
```

### A-04 Erfassung, Zeit, Foto, Versand und Kosten

```yaml
group: A-04
route_funktion:
  - startZeit
  - stopZeit
  - erfasseZeitDirekt
  - erfasseVerbrauch
  - uebernehmeVorlage
  - createOrderFromErfassung
  - createOrderDb
  - bookStationCosts
  - getStationCostSummary
  - saveShipmentInfo
  - sendShippingConfirmation
  - Erfassung UI
konkretes_risiko: Multi-Write-, Provider- und Storagepfade ohne Command-, Evidence- oder Transaktionsvertrag.
abgeschalteter_einstieg: genannte Funktionen und UI denied.
erforderlicher_w3_w4_vertrag: W3 Command-Vertrag; W4 Original-/Bild-/Extraktions-, Kosten- und Eventvertrag.
wiederfreigabekriterien:
  - Original vor fachlicher Zuordnung erhalten
  - atomarer Command
  - Actor, Tenant, Capability, Ownership und Version
  - Idempotenz und Reload-Readback
externer_blocker: NONE.
status: DENIED_INTERNAL/W3_W4
```

```yaml
subgroup: A-04-P
route_funktion:
  - createOrderFromScan
  - processImage
  - processImageWithAI
  - uploadOrderPhotoRecord
  - CameraCapture
  - Foto UI
  - /scan
konkretes_risiko: Original-, Bild-, Extraktions- und Storagewirkung ohne bestätigte Bucket-/Altobjekt-Zuordnung.
abgeschalteter_einstieg: genannte Capture-/Fotoeinstiege bleiben denied.
erforderlicher_w3_w4_vertrag: W3 Command-Vertrag; W4 Original-/Bild-/Extraktionsvertrag mit privater Evidence.
wiederfreigabekriterien: Original zuerst, bestätigte Bucket-/Altobjekt-Zuordnung, Actor/Tenant/Capability/Ownership/Version, Idempotenz und Reload-Readback.
externer_blocker: BLOCKED_PRODUCT_DECISION: Bucket-/Altobjekt-Zuordnung.
status: DENIED_PRODUCT_DECISION/W3_W4
```

### A-05 Kunden, Items, Lagerbewegung und Preise

```yaml
group: A-05
route_funktion:
  - createCustomerDb
  - updateCustomerDb
  - getCustomerDetailsAction
  - /customers/[id]
  - customer-card.getCustomerCard
  - customer-card.getCustomerOrders
  - customer-card.getCustomerTimeline
  - customer-card.getCustomerFinancials
  - customer-card.getCustomerSimilarOrders
  - customer-card.getCustomerItems
  - customer-card.getCustomerPrices
  - customer-card.getCustomerComplaints
  - customer-card.updateCustomerCore
  - customer-card.addCustomerTag
  - customer-card.removeCustomerTag
  - createItemDb
  - updateItemDb
  - deleteItemDb
  - createInventoryMovementAction
  - createPriceLineDb
  - updatePriceLineDb
  - deletePriceLineDb
konkretes_risiko: ID-Eingaben ohne vollständige Ownership-, Versions- und Eventprüfung.
abgeschalteter_einstieg: genannte Mutation/Detail-Funktionen denied oder unavailable.
erforderlicher_w3_w4_vertrag: W3 Aggregat-Read- und Command-Vertrag; W4 Bewegungs-, Preis-, Event- und Read-Model-Vertrag.
wiederfreigabekriterien:
  - ID plus serverseitiger Tenant
  - feingranulare Capability
  - Version und Konflikt
  - Lagerbewegung atomar mit append-only Movement
externer_blocker: NONE.
status: DENIED_INTERNAL/W3_W4
```

### A-06 Accounting, Versand und Druck

```yaml
group: A-06
route_funktion:
  - createBelegAction
  - freigebenBelegAction
  - stornoBelegAction
  - assignBelegeBatchAction
  - exportBelegeAction
  - createRechnungAction
  - createKostenpostenAction
  - getBelegAction
  - getRechnungAction
  - getKostenpostenAction
  - runEnergieVerteilungAction
  - schliessePeriodeAction
  - finalSchliessePeriodeAction
  - sendeZahlungserinnerung
  - sendeMahnung
  - generateOrderLabel
  - generateDeliveryNote
konkretes_risiko: Accounting-, Export- und Lieferwirkung ohne belegte Tenant-, Steuer- und Objektwahrheit.
abgeschalteter_einstieg: genannte Funktionen denied oder unavailable.
erforderlicher_w3_w4_vertrag: W3 Accounting-Capability, Ownership und Version; W4 Evidence, append-only Events und v_*-Read-Ports.
wiederfreigabekriterien:
  - Tenant-, Evidence-, Steuer- und Periodenwahrheit
  - Export ausschließlich aus geschlossenem Read-Model
  - idempotenter Delivery-Receipt
externer_blocker: BLOCKED_PRODUCT_DECISION: DEC-01, DEC-02, DEC-03.
status: DENIED_PRODUCT_DECISION/W3_W4
```

### A-07 Systemverwaltung, Identität und Plan

```yaml
group: A-07
route_funktion:
  - createUser
  - updateUserRole
  - updateUserPin
  - toggleUserStatus
  - toggleFeatureFlag
  - updateFeatureFlagRoles
  - initializeDefaultFlags
  - getCompanySettings
  - updateCompanySettings
  - runSupabaseWriteTest
  - dismissWarnung
  - refreshWarnungen
  - speichereJahresplan
  - savePhoneNote
  - trackUiEvent
konkretes_risiko: Identitäts-, Rollen-, Flag-, Firmen- und Planänderung ohne per-Capability, Ownership oder Version.
abgeschalteter_einstieg: genannte Funktionen denied oder deaktiviert.
erforderlicher_w3_w4_vertrag: W3 `perm_sys_*`-Command-Vertrag; W4 Audit-/Event-/Read-Vertrag.
wiederfreigabekriterien:
  - serverseitige Session
  - explizite System-Capability
  - Zieltenant
  - Version, Actor und Result-Union
  - kein blanket admin
externer_blocker: NONE.
status: DENIED_INTERNAL/W3_W4
```

### A-08 Service Worker, Offline und Realtime

```yaml
group: A-08
route_funktion:
  - ServiceWorkerRegister
  - public/sw.js
  - SyncProvider
  - OfflineManager
  - OfflineOutbox
  - RealtimeSyncProvider (dormant)
  - ParkedCallProvider (dormant)
  - FloatingParkedCall (dormant)
konkretes_risiko: Queue-, Cache- und Realtimepfade könnten simulieren, löschen oder tenantübergreifend wirken.
abgeschalteter_einstieg: SW cached nur statische Assets; Sync sendet/löscht nichts; Realtime-/Parked-Provider nicht gemountet.
erforderlicher_w3_w4_vertrag: W3 Commands; W4 Receipts, Idempotenz, Outbox- und Realtime-/Read-Model-Vertrag.
wiederfreigabekriterien:
  - kein Blindlöschen
  - Device-/Tenant-Bindung
  - Receipt und Konfliktanzeige
  - Realtime-Tenant- plus RLS-Nachweis
externer_blocker: BLOCKED_EXTERNAL_PERMISSION für spätere Realtime-Remoteprüfung.
status: PARTIALLY_CONTAINED/W4
```

## Aktive W3-/W4-Aufnahme, keine weitere Routenquarantäne

| ID | Intake | Zielphase und enger Folgeschritt |
|---|---|---|
| I-01 | `getOrdersDb`/`getOrderCountDb`/Warendurchlauf lesen breit, mit hartkodiertem Tenant und globalem 5-s-Cache. | W3: Tenant-Snapshot, Capability und tenant-keyed Read-Port. |
| I-02 | `getLagerbestandAction`, `getSystemStats` und `getDeveloperCockpitStats` ohne vollständigen Tenant-/Capability-Read-Port. | W3: enger Guard-Fix statt Routenquarantäne. |
| I-03 | `/admin/analytics` feste Zahlen; `/kvp`, `/kalender`, `/buchhaltung/einstellungen`, `/buchhaltung/fristen` und `/buchhaltung/zahlung` enthalten Komfortwahrheit. | W4: v_*-Read-Model, keine weitere Vollquarantäne. |
| I-04 | `OfflineSyncBadge.getPendingCount` öffnet IndexedDB v2; Upgrade löscht `read_cache`. | W4: Inventar, Export/Restore und kein Blindlöschen. |
| I-05 | `createCustomerFromErfassung`, `createOperationalOrderService`, `moveOperationalOrderToStationService`, `createBathMeasurementDb`, `updateBathDb`, `createComplaint`, `updateComplaint` und `resolveComplaint` sind `DORMANT_UNREACHABLE/W3_INTAKE`; davon getrennt bleiben zugehörige Reads eigenständige W3-/W4-Read-Port-Intake. | Vor Reimport zwingend deny/delegate; W3/W4-Vertrag. |
| I-06 | Ungemountete globale Realtime-Subscriptions. | Nicht remounten vor Tenant-/RLS-Negativtests; W4. |
| I-07 | Ein frischer Build macht eine dormante Action aktiv. | STOP_INTERNAL; erst Audit und enger Vertrag. |

Diese Intake-Liste ist ausdrücklich kein Auftrag zum weiteren Auffinden oder Abschalten von P1-Komfortpfaden. Nach diesem Audit endet W2C.

## Erster W3-Schnitt: atomarer Auftragswechsel Wareneingang nach Galvanik

```yaml
scope: authentifizierter, fähiger Werkstattnutzer verschiebt ausschließlich einen bestehenden tenantzugehörigen Auftrag wareneingang -> galvanik
input: '{ orderId, expectedVersion }'
target: galvanik (serverseitig fest; nicht Client-Input)
candidate_paths:
  - supabase/migrations/<additive-orders-version-local-only>.sql
  - src/db/schema.ts
  - src/lib/types/operationalOrder.ts
  - src/lib/server/commands/orderStationCommand.ts
  - src/lib/server/operationalOrders.ts
  - src/app/actions/orders.actions.ts
  - src/app/warendurchlauf/wareneingang/page.tsx
  - src/components/orders/StationStatusButton.tsx
  - src/lib/server/commands/__tests__/orderStationCommand.test.ts
  - src/app/warendurchlauf/wareneingang/__tests__/orderStationTransition.test.tsx
  - docs/evidence/f0/W3_ORDER_STATION_TRANSITION_EVIDENCE.md
command_boundary: server-only service-role command ohne Public Execute
already_denied_writers: updateOrderDb, transitionOrderProcess, startProcessingStation, startProcessingStationService
dormant_unreachable_w3_intake: createCustomerFromErfassung, createOperationalOrderService, moveOperationalOrderToStationService; vor jedem Reimport zwingend deny/delegate
criteria:
  1: genau ein Writer
  2: Client kann Actor, Tenant, Capability, Ziel oder Ownership nicht vorgeben; Input bleibt exakt orderId plus expectedVersion
  3: Capability perm_op_status
  4: foreign oder missing liefert keine Information und erzeugt keinen Side-Effect
  5: expectedVersion erzeugt expliziten Konflikt
  6: Auftrag und tenantzugehörige Items ändern atomar
  7: Tenant-Snapshot-Read ohne globalen Cache
  8: bereits denied Writer bleiben denied; DORMANT_UNREACHABLE/W3_INTAKE wird vor Reimport deny/delegate
  9: nach Erfolg nach Reload nicht mehr in Wareneingang und in Galvanik sichtbar
  10: keine Remote-Migration, kein Deploy, keine RLS-/Grant-Änderung
tests:
  - keine Session
  - falsche Capability
  - fremder Auftrag
  - fehlender Auftrag
  - falsche Station
  - ungültiger Übergang
  - stale Version
  - Happy Path
  - atomare Order-und-Tenant-Items-Integration
  - UI Denial, Konflikt, Erfolg und Reload
  - Rollback und No-Side-Effect bei jedem Denial oder Konflikt
result_union: OK|UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|CONFLICT|VALIDATION_ERROR|UNAVAILABLE
stop_conditions:
  - persönliche Stationszuweisung: BLOCKED_PRODUCT_DECISION
  - Replay-Fehler: Historie nicht umschreiben
  - Remote-Migration nötig: lokal vorbereiten, dann STOP
  - Evidence-Vollständigkeit: W4 erforderlich
```

## Abschluss W2C

W2C ist nach diesem einmaligen Restgraph-Audit beendet. Der nächste Schritt ist ausschließlich der oben definierte W3-Atomschnitt. Wiederaktivierung erfolgt nur vertragsbasiert, nachweisbar und in Kernabläufen; das Ziel bleibt eine sichere, wieder nutzbare App, nicht eine sichere leere App.
