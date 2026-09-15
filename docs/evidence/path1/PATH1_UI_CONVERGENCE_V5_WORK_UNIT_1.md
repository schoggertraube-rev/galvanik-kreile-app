# PATH1 UI Convergence V5 — Work Unit 1 / Repair 1

Status: `V5_WORK_UNIT_1_REMOTE_CHECKPOINT_SECURED_NO_UI_PASS`.

Dieser Stand ist ausdrücklich kein UI-Teil-PASS, kein Draft-PR, kein Merge und
keine Production-Migration. Er ist nur der technische Remote-Checkpoint für
den nächsten PL-Handoff.
Die frühere Diagnose mit 92 Naht-1-Befunden und einem TypeScript-Fehler ist
geschlossen; die nachstehenden Receipts beschreiben den aktuellen Kandidaten.

## Kanonische V5-Bindung

- Referenz: `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`
- SHA-256: `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`
- Größe: `409900` Bytes
- Pointer: `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json`
- Phillip V4, Rolf V8, Auftragskarte V8 und Kundenkarte V2 bleiben die vier
  unveränderten Seitenreferenzen. V2/V3/V4-Gesamtmocks sind kein Bauinput.

## Verbraucher- und Dispositionsnachweis

Vor dem Entfernen oder Verschieben wurden die produktiven Importe und
Route-Verbraucher mit `rg` geprüft. Die Disposition ist geschlossen:

1. Die zwingenden Next-Entrypoints
   `src/app/orders/page.tsx`, `src/app/orders/[id]/page.tsx`,
   `src/app/customers/page.tsx` und `src/app/customers/[id]/page.tsx`
   bleiben dünn und komponieren nur über die öffentlichen Modul-Fassaden bzw.
   die typisierten AppAdapter.
2. App-Komposition liegt ausschließlich in
   `src/app/orders/OrdersAppAdapter.tsx`,
   `src/app/orders/OrderCardAppAdapter.tsx`,
   `src/app/customers/CustomersAppAdapter.tsx`,
   `src/app/customers/CustomerCardAppAdapter.tsx`,
   `src/app/warendurchlauf/wareneingang/WareneingangHandoffAppAdapter.tsx`,
   `src/app/warendurchlauf/galvanik/GalvanikCorrectionAppAdapter.tsx` und
   `src/app/warendurchlauf/galvanik/GalvanikHandoffAttachmentAppAdapter.tsx`.
3. Weiter benötigte echte Fachverträge wurden verlustfrei hinter
   `@/modules/orders/public` und `@/modules/customers/public` geführt.
   `getUrgency` und `orderLifecycleContract` liegen in der Order-Domain.
   Die realen Station-/Anhang-/Kartenkomponenten erhalten enge typisierte Ports;
   ihr Modulkern importiert weder `@/app/**` noch Supabase-Clientcode.
4. Direkte Verbraucher wurden auf die Fassaden/Adapter umgebunden:
   `WarenausgangQueue`, `GalvanikQueue`, `GalvanikOrderRow`,
   `OffeneAuftraegeKachel`, Wareneingang-/Galvanik-Seiten,
   `OrderIntakePanel`, Order-Read-/Command-Verträge, `OrderLabel` und der
   W4-Integrationstest.
5. Nicht mehr konsumierte Alt-UI, alte Overlay-/Form-/Analyse-Hüllen,
   `page.tsx.bak` und ausschließlich das Alt-/NOT_AVAILABLE-Verhalten
   konservierende Tests wurden nach Verbraucherprüfung entfernt. Es wurde kein
   Ersatzadapter, kein generischer Router-/URL-Tunnel und keine Baseline-Ausnahme
   angelegt.

Der vollständige aktuelle Pfadstatus steht unten; damit sind Änderung,
Entfernung, Verschiebung und Neuanlage exakt nachvollziehbar.

## Reale Customer-Persistenz

Migration:
`supabase/migrations/20260914100000_path1_customer_persistence_contract.sql`

Vertrag:

- Tenant und Akteur stammen ausschließlich aus dem serverseitigen
  Authorization-Snapshot; Clientinput enthält keine `tenantId`.
- Schreibrecht bleibt `perm_data_customers`.
- Die Kundennummer `K-JJJJ-NNNN` kommt atomar aus dem tenant-/jahrgebundenen
  DB-Zähler `private.customer_number_counters`; kein `SELECT max`.
- `clientEventId` und kanonischer Intent-Hash binden Retry und Intent-Konflikt.
- `CUSTOMER_CREATED_V1` sowie `private.customer_create_receipts` sind
  append-only; `private.v_customer_create_receipts_v1` validiert Event,
  Receipt und persistierten Customer.
- Erfolg wird erst nach Readback über
  `private.v_customer_summary_v1` zurückgegeben.

Der unveränderte Fresh-DB-Beleg vom 2026-09-14 bleibt gültig:

- Loopback PostgreSQL 17 auf `127.0.0.1:54322`, fresh reset bis
  `20260914100000`;
- `src/test/path1_customer_persistence.integration.test.ts`: 1 Datei,
  5/5 Tests PASS;
- Erstanlage, identischer Retry, Intent-Konflikt ohne Doppelwrite,
  Nummernkreis, Fremdtenant-Isolation, Summary-Readback, append-only
  Receipt/Event, fehlende Session und fehlendes Recht ohne Mutation;
- Migration SHA-256:
  `BE33E61198AA27DC49FAC00AA792C0F4E8F309D0BC5CBA472D56296DE6C60AA9`;
- Integrationstest SHA-256:
  `ECD5FB663F376DDC78D8FD031B9DF3A37CCE8F3717B41E2DD4723295A9726C3A`;
- keine Remote-DB-, Provider- oder Production-Mutation.

## Lokale Gate-Receipts

- Customer-Command-Unit: 1 Datei, 4/4 PASS
- betroffene fokussierte Regression: 7 Dateien, 143/143 PASS
- vollständige Unit-Suite: 104/104 Dateien, 830/830 Tests, Exit 0
- TypeScript: `npx tsc --noEmit --incremental false` PASS
- ESLint: `npm run lint:full` PASS, 0 Fehler / 0 Warnungen
- Authority-Selftest: 27/27 Negativfälle PASS; beide gültigen Zustände PASS
- Authority-Repo-Check: PASS, 7 Wahrheitsarten / 4 UI-Referenzen
- Module-Gates: PASS, exakt 0 Befunde
- No-Fake: PASS; Disk/Registry Pages 78/78, API 19/19, Actions 50/50,
  KPI 7/7, `REACHABLE_PRODUCTION_MOCKS=0`,
  `UNREGISTERED_VISIBLE_CAPABILITIES=0`,
  `ACTIVE_CAPABILITY_REAL_E2E=PASS`
- Ratchet: PASS, 0 Fehler / 0 Warnungen
- `git diff --check`: PASS
- `quality/module-gates-baseline.json`: shrink-only; ausschließlich
  `src/components/layout/KreileAppShell.tsx` entfernt, kein Zuwachs

## Geschützter Checker-Vertrag

SHA-256 von `scripts/quality/check-module-gates.mjs`:

`9CA4255E2F51465D91A38E4B9D80B963D9C45E531324F49AEA12633BD50AD53E`

Der geschützte Pull-Request-Ratchet führt den Checker aus dem Basisstand gegen
den Kandidatenbaum aus. Sein Judge-Hash bindet derzeit Workflow, Quality-Lane
und ESLint-Ratchet-Code, jedoch keinen separaten Module-Checker-Pin. Deshalb
erzeugt dieser Checker-Delta in der aktuellen Arbeitseinheit weder einen
`judgeContractHash`-Drift noch einen zulässigen Baseline-/Workflow-Delta.
Es wurde nichts still nachgezogen. Eine künftig gewünschte geschützte
Übernahme des neuen Checker-Inhalts ist ein separater Bootstrap-/Governance-
Schritt nach Integration, nicht Teil dieses uncommittierten Repair-1-Stands.

## Exakter Arbeitsbaum-Pfadstatus

Format: Git-Status und Pfad; bei Umbenennungen Alt- und Zielpfad.

### Getrackte Änderungen

- `M	docs/evidence/f1/F1_R0_CAPABILITY_REGISTRY.json`
- `M	docs/project/PROVIDER_CAPABILITY_MATRIX.md`
- `M	docs/project/linie/00_UI_REFERENZEN_PFADE.md`
- `M	docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md`
- `M	docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md`
- `M	docs/project/linie/MODULKARTE_KANON.md`
- `M	missions/F1_ORDER_TO_CASH_PILOT_001.yml`
- `M	quality/module-gates-baseline.json`
- `M	scripts/quality/check-module-gates.mjs`
- `M	src/app/__tests__/w2cB2m5u.homeDueTruth.realRender.test.tsx`
- `M	src/app/actions/__tests__/commerceAccountingContainment.test.ts`
- `M	src/app/actions/__tests__/erfassungContainment.test.ts`
- `M	src/app/actions/__tests__/updateOrderDb.failClosed.test.ts`
- `M	src/app/actions/__tests__/w2cB2m3a.failClosed.test.ts`
- `M	src/app/actions/__tests__/w2cB2m3b.failClosed.test.ts`
- `M	src/app/actions/__tests__/w2cB2m4c.externalProvider.failClosed.test.ts`
- `M	src/app/actions/__tests__/w2cB2m5c.orderTransition.failClosed.test.ts`
- `M	src/app/actions/__tests__/w2cB2m5d.orderCreate.failClosed.test.ts`
- `M	src/app/actions/__tests__/w2cB2m5g.customerMutation.failClosed.test.ts`
- `M	src/app/actions/customers.actions.ts`
- `M	src/app/api/__tests__/quarantine.test.ts`
- `M	src/app/buchhaltung/zahlung/page.tsx`
- `M	src/app/cockpit/components/EngpassKachel.tsx`
- `D	src/app/customers/[id]/__tests__/w2cB2m5f.customerDetailPrivacy.failClosed.test.ts`
- `D	src/app/customers/[id]/actions.ts`
- `M	src/app/customers/[id]/page.tsx`
- `M	src/app/customers/page.tsx`
- `D	src/app/customers/page.tsx.bak`
- `M	src/app/layout.tsx`
- `D	src/app/orders/[id]/__tests__/w2cOrderDetail.failClosed.test.tsx`
- `M	src/app/orders/[id]/page.tsx`
- `M	src/app/orders/page.tsx`
- `M	src/app/page.tsx`
- `M	src/app/quotes/__tests__/w2cB2m5a.inquiries.failClosed.test.ts`
- `M	src/app/start/__tests__/start-page-payload.test.tsx`
- `M	src/app/station/[slug]/page.tsx`
- `M	src/app/warendurchlauf/__tests__/f1OrderIntakePage.test.tsx`
- `M	src/app/warendurchlauf/__tests__/w2cB2m5j.unavailable.realRender.test.tsx`
- `M	src/app/warendurchlauf/components/OffeneAuftraegeKachel.tsx`
- `M	src/app/warendurchlauf/galvanik/__tests__/orderStationReadback.test.tsx`
- `M	src/app/warendurchlauf/galvanik/__tests__/w4OrderStationAttachmentPanel.test.tsx`
- `M	src/app/warendurchlauf/galvanik/page.tsx`
- `M	src/app/warendurchlauf/page.tsx`
- `M	src/app/warendurchlauf/warenausgang/__tests__/w2cB2m5t.warenausgangFinance.failClosed.test.tsx`
- `M	src/app/warendurchlauf/warenausgang/page.tsx`
- `M	src/app/warendurchlauf/wareneingang/page.tsx`
- `D	src/components/customers/CustomerAuftraege.tsx`
- `D	src/components/customers/CustomerEditModal.tsx`
- `D	src/components/customers/CustomerHeader.tsx`
- `D	src/components/customers/CustomerKommHistorie.tsx`
- `D	src/components/customers/CustomerKpiRow.tsx`
- `D	src/components/customers/CustomerMemoryCard.tsx`
- `D	src/components/customers/CustomerOverlay.tsx`
- `D	src/components/customers/CustomerProfileHeader.tsx`
- `D	src/components/customers/CustomerStammdaten.tsx`
- `D	src/components/customers/CustomerTagEditor.tsx`
- `D	src/components/customers/CustomerTile.tsx`
- `D	src/components/customers/CustomerTypeConsequences.tsx`
- `D	src/components/customers/CustomerZahlungen.tsx`
- `D	src/components/customers/NewCustomerForm.tsx`
- `D	src/components/customers/PriceAgreementPanel.tsx`
- `D	src/components/customers/__tests__/w2cB2m5e.customerOverlay.failClosed.test.tsx`
- `D	src/components/customers/tabs/CustomerAnalysisTab.tsx`
- `D	src/components/customers/tabs/CustomerCommunicationTab.tsx`
- `D	src/components/customers/tabs/CustomerComplaintsTab.tsx`
- `D	src/components/customers/tabs/CustomerHistorySimilarTab.tsx`
- `D	src/components/customers/tabs/CustomerInvoicesTab.tsx`
- `D	src/components/customers/tabs/CustomerItemsProfileTab.tsx`
- `D	src/components/customers/tabs/CustomerNotesTab.tsx`
- `D	src/components/customers/tabs/CustomerOrdersTab.tsx`
- `D	src/components/customers/tabs/CustomerOverviewTab.tsx`
- `D	src/components/customers/tabs/CustomerPhotosTab.tsx`
- `D	src/components/customers/tabs/CustomerPricesTab.tsx`
- `D	src/components/customers/useCustomerData.ts`
- `D	src/components/customers/useCustomerKpi.ts`
- `D	src/components/customers/useCustomerOverlay.ts`
- `M	src/components/erfassung/OrderIntakePanel.tsx`
- `M	src/components/galvanik/GalvanikOrderRow.tsx`
- `M	src/components/galvanik/GalvanikQueue.tsx`
- `D	src/components/intake/OcrMatchResult.tsx`
- `M	src/components/layout/KreileAppShell.tsx`
- `M	src/components/layout/MobileBottomNav.tsx`
- `M	src/components/layout/__tests__/w2cB2m5v.globalBrowserProviders.failClosed.test.tsx`
- `D	src/components/orders/BenchmarkSlider.tsx`
- `D	src/components/orders/BulkLabelPrintView.tsx`
- `D	src/components/orders/CostSummaryTable.tsx`
- `D	src/components/orders/ExtraEffortToggles.tsx`
- `D	src/components/orders/ExtraWorkAdminPanel.tsx`
- `D	src/components/orders/HeadCostBadge.tsx`
- `D	src/components/orders/ItemDrawer.tsx`
- `D	src/components/orders/LabelPrintView.tsx`
- `D	src/components/orders/MaterialStepper.tsx`
- `D	src/components/orders/NewOrderForm.tsx`
- `D	src/components/orders/OrderActionGrid.tsx`
- `D	src/components/orders/OrderEditModal.tsx`
- `D	src/components/orders/OrderExtraWorkEditor.tsx`
- `D	src/components/orders/OrderFreezeButton.tsx`
- `D	src/components/orders/OrderFreezeCorrectionButton.tsx`
- `D	src/components/orders/OrderImmutableInvoiceButton.tsx`
- `D	src/components/orders/OrderMaterialTimeDrawer.tsx`
- `D	src/components/orders/OrderModalProvider.tsx`
- `D	src/components/orders/OrderModalTrigger.tsx`
- `D	src/components/orders/OrderOverlay.tsx`
- `D	src/components/orders/OrderProfitabilityCard.tsx`
- `D	src/components/orders/OrderTaskAssignmentPanel.tsx`
- `D	src/components/orders/OrderTile.tsx`
- `D	src/components/orders/OrderTimeline.tsx`
- `D	src/components/orders/PaymentDrawer.tsx`
- `D	src/components/orders/PriceLinesEditor.tsx`
- `D	src/components/orders/StationCompletionModal.tsx`
- `D	src/components/orders/StationContextBlock.tsx`
- `D	src/components/orders/StationStatusButton.tsx`
- `D	src/components/orders/StatusMailDrawer.tsx`
- `D	src/components/orders/__tests__/GalvanikCorrectionButton.test.tsx`
- `D	src/components/orders/__tests__/OrderImmutableInvoiceButton.test.tsx`
- `D	src/components/orders/__tests__/WareneingangHandoffButton.test.tsx`
- `D	src/components/orders/__tests__/w2cB2m5u.unknownCards.realRender.test.tsx`
- `D	src/components/orders/__tests__/w2cOrderOverlay.failClosed.test.tsx`
- `D	src/components/orders/variants/ErfassungVariant.tsx`
- `D	src/components/orders/variants/GalvanikExtras.tsx`
- `D	src/components/orders/variants/VersandVariant.tsx`
- `D	src/components/orders/variants/WareneingangActive.tsx`
- `D	src/components/orders/variants/WareneingangReadOnly.tsx`
- `M	src/components/start/StartScreenClient.tsx`
- `M	src/components/warenausgang/WarenausgangQueue.tsx`
- `D	src/features/customers/customer-card/__tests__/w2cB2m5e.customerCardPrivacy.failClosed.test.ts`
- `D	src/features/customers/customer-card/customerCard.actions.ts`
- `D	src/features/orders/__tests__/w2cB2m5l.orderPhoto.failClosed.test.ts`
- `D	src/features/orders/orderCost.actions.ts`
- `D	src/features/orders/orderPhoto.actions.ts`
- `D	src/features/orders/shipment.actions.ts`
- `D	src/lib/customers/matchCustomer.ts`
- `D	src/lib/orders/__tests__/w2cB2m5u.urgencyDueTruth.failClosed.test.ts`
- `D	src/lib/orders/costCalculation.ts`
- `D	src/lib/orders/stationContext.ts`
- `M	src/lib/pdf/OrderLabel.tsx`
- `M	src/lib/server/__tests__/orderIntakeRead.test.ts`
- `M	src/lib/server/commands/orderExtraWorkCommand.ts`
- `M	src/lib/server/commands/orderFreezeCommand.ts`
- `M	src/lib/server/commands/orderIntakeCommand.ts`
- `M	src/lib/server/commands/orderStationCommand.ts`
- `M	src/lib/server/commands/recordGoodsOutCommand.ts`
- `M	src/lib/server/orderIntakeRead.ts`
- `M	src/lib/server/orderStationAttachment.ts`
- `R100	src/lib/orders/getUrgency.ts	src/modules/orders/domain/getUrgency.ts`
- `R100	src/lib/orders/orderLifecycleContract.ts	src/modules/orders/domain/orderLifecycleContract.ts`
- `R081	src/components/orders/GalvanikCorrectionButton.tsx	src/modules/orders/legacy-ui/GalvanikCorrectionButton.tsx`
- `R094	src/components/orders/GalvanikHandoffAttachmentPanel.tsx	src/modules/orders/legacy-ui/GalvanikHandoffAttachmentPanel.tsx`
- `R100	src/components/orders/OrderCompactCard.tsx	src/modules/orders/legacy-ui/OrderCompactCard.tsx`
- `R098	src/components/orders/OrderWideCard.tsx	src/modules/orders/legacy-ui/OrderWideCard.tsx`
- `R073	src/components/orders/WareneingangHandoffButton.tsx	src/modules/orders/legacy-ui/WareneingangHandoffButton.tsx`
- `R082	src/app/orders/__tests__/w4OperationalOrdersReadStates.test.tsx	src/test/path1_orders_read_states.test.tsx`
- `M	src/test/s1_module_gates.test.ts`
- `M	src/test/w4_order_station_attachment.integration.test.ts`

### Neue, noch ungetrackte Paketpfade

- `A — docs/evidence/path1/PATH1_UI_CONVERGENCE_V5_WORK_UNIT_1.md`
- `A	docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json`
- `A	docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`
- `A	src/app/customers/CustomerCardAppAdapter.tsx`
- `A	src/app/customers/CustomersAppAdapter.tsx`
- `A	src/app/orders/OrderCardAppAdapter.tsx`
- `A	src/app/orders/OrdersAppAdapter.tsx`
- `A	src/app/warendurchlauf/galvanik/GalvanikCorrectionAppAdapter.tsx`
- `A	src/app/warendurchlauf/galvanik/GalvanikHandoffAttachmentAppAdapter.tsx`
- `A	src/app/warendurchlauf/wareneingang/WareneingangHandoffAppAdapter.tsx`
- `A	src/components/home/RolfHome.module.css`
- `A	src/components/home/RolfHome.tsx`
- `A	src/components/home/RolfHomeClient.tsx`
- `A	src/components/home/WerkstattHome.tsx`
- `A	src/components/layout/EntityOverlayStack.module.css`
- `A	src/components/layout/EntityOverlayStack.tsx`
- `A	src/components/layout/TargetHeader.tsx`
- `A	src/components/layout/TargetNavigation.tsx`
- `A	src/components/layout/TargetShell.module.css`
- `A	src/components/start/StartScreenClient.module.css`
- `A	src/modules/customers/__tests__/createCustomerCommand.test.ts`
- `A	src/modules/customers/customers.manifest.json`
- `A	src/modules/customers/public.ts`
- `A	src/modules/customers/server/createCustomerCommand.ts`
- `A	src/modules/customers/server/types.ts`
- `A	src/modules/customers/ui/CustomerCardView.tsx`
- `A	src/modules/customers/ui/CustomersView.tsx`
- `A	src/modules/customers/ui/customers.module.css`
- `A	src/modules/orders/__tests__/GalvanikCorrectionButton.test.tsx`
- `A	src/modules/orders/__tests__/WareneingangHandoffButton.test.tsx`
- `A	src/modules/orders/__tests__/unknownCards.realRender.test.tsx`
- `A	src/modules/orders/__tests__/urgencyDueTruth.failClosed.test.ts`
- `A	src/modules/orders/orders.manifest.json`
- `A	src/modules/orders/public.ts`
- `A	src/modules/orders/server/types.ts`
- `A	src/modules/orders/ui/OrderCardView.tsx`
- `A	src/modules/orders/ui/OrdersView.tsx`
- `A	src/modules/orders/ui/orders.module.css`
- `A	src/test/path1_customer_persistence.integration.test.ts`
- `A	supabase/migrations/20260914100000_path1_customer_persistence_contract.sql`

## Provider-/AI-Konfliktscan und Disposition vom 2026-09-14

- `D-ARCH-012` bindet die strategische Konsolidierung, Plattformrollen und
  Aktivierungsgates. `D-AI-001` bindet Cheap-first-Eskalation,
  Dokumentenintelligenz und berechtigte Suche. Beide IDs kommen im
  Entscheidungsregister genau einmal vor.
- `provider.gemini` und `provider.klippa` waren im Inventar als
  `REAL_PENDING_SECRET` und damit fälschlich secret-aktivierbar beschrieben.
  Ihre real vorhandenen Adapter bleiben unangetastet, unsichtbar und nicht
  erreichbar; Registry und Matrix klassifizieren sie jetzt als
  `LEGACY_QUARANTINE_SUPERSEDED`/`LEGACY_REMOVE`. Es gibt keine neue Kopplung.
- Azure Foundry/Azure OpenAI ist ausschließlich
  `PLANNED_BLOCKED_EXTERNAL_PERMISSION_AND_STRUCTURE_COST_GATE`. Responses
  API, Bild/PDF, Structured Outputs, Region, Quota und Kosten besitzen noch
  keinen Realbeleg. Direkte OpenAI API ist nur die dokumentierte, erneut
  owner-entscheidungspflichtige Alternative bei einem belegten Gap.
- Die bestehende Google-Kalenderseite bleibt der dokumentierte sichtbare
  Quarantänedefekt. Diese Dokumenteinheit aktiviert weder Google noch M365 und
  verändert keine Runtime- oder Kalenderdatei.
- OCR-, Scan-, Mail- und Office-Inhalte bleiben untrusted data. Originale
  werden zuerst privat gesichert; ein editierbarer Vorschlag darf erst nach
  menschlicher Bestätigung genau einen bestehenden sicheren Command aufrufen.
- Kosten/Usage, Secrets, SDKs, Providerzugriffe, Runtime-Abhängigkeiten,
  Remote-DB, Deployment und kostenpflichtige Dienste wurden weder angelegt
  noch aktiviert.

## Nächster enger Schritt

Repair 1 ist lokal gate-grün und besitzt keine offenen Naht-/TypeScript-/
Unit-Befunde. Der mission-bound Stand wird ausschließlich als technischer
Remote-Checkpoint gesichert. Der nächste Produktbau bleibt die persistente
KV-/Quotes-Wahrheit samt Receipts; Providerarbeit wird nicht gestartet.
UI-Konvergenz V5 ist weder akzeptiert noch geliefert.
