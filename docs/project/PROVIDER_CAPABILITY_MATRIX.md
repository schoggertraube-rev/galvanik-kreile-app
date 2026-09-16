<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->

# Provider- und Capability-Matrix

Stand: 2026-09-14 · D-GOV-001 · D-ARCH-011/012 · D-AI-001/002 · D-RES-001 · D-UI-CORE-002
Quellen: `MODULKARTE_KANON.md`, `ARCHITEKTUR_MODULE_PATH1.md`, `F1_R0_CAPABILITY_REGISTRY.json` auf `main@456a81fee2e7a56d4c09fe781ba25b2f12a0f6ba`.

Diese Matrix ist Inventar und Acceptance-Plan, keine Scope- oder Baustartautorität. `REAL` bedeutet ausschließlich: unveränderlicher echter Beleg im Capability-Register. `PENDING` bedeutet: Vertrag, Secret oder Real-E2E fehlt. `QUARANTINE` bedeutet: nicht reaktivieren; erst eigener Abbau-/Disposition-Nachweis.

D-ARCH-012 konsolidiert die strategischen Plattformrollen, aktiviert aber
keinen Provider: Supabase bleibt Daten/Auth/Storage-Wahrheit;
Microsoft/Azure ist der bevorzugte Zielstack nach realem Struktur-, Region-,
Quota-, Capability- und Kostengate; Vercel bleibt Hosting. Direkte OpenAI API,
Mollie, Google Maps und weitere Anbieter benötigen die jeweils dokumentierte
Owner-Entscheidung beziehungsweise Reihenfolge. Es gibt keinen stillen
Runtime-Fallback.

D-AI-002 bindet ausschließlich die providerneutrale Zielnaht aus getrennten
Capture-Ports, `SourceEnvelope`, lückenlosem `FactLedger`, serverseitigem
Capability-/Command-Katalog, menschlicher Bestätigung und genau einem sicheren
Command mit Receipt/Readback. Der heutige Azure-Beleg hat nur den Status
`ISOLATED_DEV_CAPABILITY_PARTIAL`; er aktiviert keinen Produktpfad, Provider,
Secret oder Runtime-Vertrag. D-RES-001 verlangt pro späterem vertikalem Weg
Quellenerhalt, Correlation-ID, sichtbaren Endstatus und Wiederaufnahme ohne
stillen Providerwechsel. Diese Matrix bleibt Inventar und erteilt daraus keine
Baufreigabe.

D-UI-CORE-002 verwirft die gesamte bestehende sichtbare Oberfläche als Lieferbasis. Die Zeilen dieses Inventars autorisieren deshalb keine Alt-UI-Reparatur und keinen Teilfortschritt: `PATH1_UI_CONVERGENCE` ersetzt Shell, Navigation, Startseite, Orders-/Customers-UI und responsive Navigation als eine zusammenhängende Oberfläche; ausschließlich belastbare Backend-/Daten-/Auth-Verträge und sinnvolle Nicht-UI-Logik dürfen übernommen werden. A bis E sind interne Schritte desselben Programms.

## Statusvertrag je Zeile

| Status | Eigene Wahrheit | Provider/API | Querverbindung | Acceptance-Beleg | Verantwortlicher nächster Schritt |
|---|---|---|---|---|---|
| REAL | bleibt beim genannten Fachmodul | nur belegter Adapter | nur typisierter Port/View | eingefrorener Real-E2E-/Receipt-Nachweis | Vertrag erhalten |
| PENDING | keine zweite Wahrheit anlegen | fail-closed bis Vertrag/Secret/E2E | erst nach ratifiziertem Port | echte Quelle → Port → Readback → UI/Health | eigenes freigegebenes Paket |
| QUARANTINE | keine fachliche Wahrheit | nicht aktivieren | keine neue Kopplung | Nicht-Erreichbarkeit bzw. kontrollierter Abbau | S2/gesonderte Disposition |

## Planmäßige Module

| Capability | Eigene Wahrheit | Provider/API-Bedarf | Status | Querverbindungen | Acceptance | Nächster Schritt |
|---|---|---|---|---|---|---|
| `module.fundament` | Identity, Tenant, Commands, Events, Receipts, Storage/Views; Backend-Verträge real, Ziel-Shell offen | Supabase/Postgres, Auth, Storage | REAL | stellt sichere Ports bereit | bestehende F0/F1.1-Belege; kein UI-Gesamt-PASS | PATH1_UI_CONVERGENCE_A nutzt unveränderte Ports |
| `module.suche` | keine Speicherung; Search-Kernkandidat vorhanden, sichtbare Zielintegration nicht geliefert | keiner | PENDING | Orders- und Customers-Read-Ports; Ziel-Header/Overlays erst nach A–C | PR #84 ist nur DRAFT/CANDIDATE und kein akzeptierter Full-Route-Beleg | PATH1_UI_CONVERGENCE_D_REBASE_INTEGRATE_REACCEPT |
| `module.intake` | Wareneingang/Originalzuordnung | Storage; Dokumentenintelligenz bleibt separat und nicht verbunden | REAL | Customers, Orders, Fundament | F1.1-Receipt/Reload; isolierter KI-Test ist kein Intake-Produktbeleg | manuellen Kern erhalten; Capture später vertikal nach D-AI-002/D-RES-001 abnehmen |
| `module.orders` | Backend/Lifecycle teilweise real; sichtbare Auftragskarte V8 `NOT_DELIVERED` | keiner | PENDING | Intake, Customers, Accounting | F1.2/F1.3/F1.5-Receipts belegen Fachverträge, nicht V8-Gesamtansicht | PATH1_UI_CONVERGENCE_B |
| `module.customers` | Backend teilweise real; sichtbare Kundenkarte V2 `NOT_DELIVERED` | keiner | PENDING | Orders, Suche | Tenant-/Readback-Belege belegen Fachverträge, nicht V2-Gesamtansicht | PATH1_UI_CONVERGENCE_C |
| `module.calendar` | keine eigene Terminwahrheit; nur Projektion | Microsoft 365 Graph ?ber `CalendarPort` | PENDING | Termin-Ports der Fachmodule | `REMOVED_NON_RENDERING`; `M365_NOT_CONNECTED`; kein aktiver Provider | E bleibt `BLOCKED_EXTERNAL_PERMISSION` bis Konto, Consent und Provider-E2E real belegt sind |
| `module.accounting-minimal` | unveränderliche Rechnung und Zahlung | zunächst keiner; Bank/Mollie separat | REAL | Orders-Freeze/Goods-out | F1.4/F1.5-Receipts | erhalten |

## Provider-/API-Inventar

| Capability | Eigene Wahrheit | Provider/API | Status | Querverbindungen | Echter Acceptance-Beleg | Verantwortlicher nächster Schritt |
|---|---|---|---|---|---|---|
| `provider.supabase-postgres` | keine fachliche Wahrheit; Adapter/Connection | Supabase/Postgres | REAL | tenantneutraler typisierter Capability-Port | Registry `REAL_VERIFIED` | erhalten |
| `provider.supabase-auth` | keine fachliche Wahrheit; Adapter/Connection | Supabase/Auth | REAL | tenantneutraler typisierter Capability-Port | Registry `REAL_VERIFIED` | erhalten |
| `provider.supabase-storage` | keine fachliche Wahrheit; Adapter/Connection | Supabase/Storage | REAL | tenantneutraler typisierter Capability-Port | Registry `REAL_VERIFIED` | erhalten |
| `provider.calendar-m365-graph` | keine fachliche Wahrheit; Adapter/Connection | Microsoft 365/Graph | PENDING | tenantneutraler typisierter `CalendarPort` | D-ARCH-011; kein Konto/Consent/Port/E2E | delegierten benannten Büronutzer und Least-Privilege-Consent ownerseitig bereitstellen |
| `provider.azure-foundry-openai` | keine fachliche Wahrheit; isolierter Entwicklungsbeleg, kein Produktadapter | Azure Document Intelligence + Foundry/Azure OpenAI | PLANNED_BLOCKED_EXTERNAL_PERMISSION_AND_STRUCTURE_COST_GATE | getrennte Capture-Ports hinter `SourceEnvelope`; keine Runtime-Bindung | `ISOLATED_DEV_CAPABILITY_PARTIAL`: 3 reale Bildseiten/Layout, generische Semantik verwechselte Absender/Kunde; Foundry erster Fact-Verlust FAIL, danach 24/24 und Katalog-Aktionslauf, HumanConfirm=true/writeAllowed=false; keine Originalbilder/echte PII an Foundry | erst Original-Storage, Port, RLS, Kosten-/Ausfall- und vertikalen Receipt/Readback-E2E ratifizieren |
| `provider.openai-direct-alternative` | keine fachliche Wahrheit; keine aktive Connection | direkte OpenAI API | PENDING_EXPLICIT_OWNER_GAP_DECISION | ausschließlich dieselben tenantneutralen Capability-Ports | nur als kleine Alternative bei belegtem Pflichtfähigkeits-/EU-/Quota-/Kostengap entschieden | nicht aktivieren; gegebenenfalls neue Owner-Entscheidung |
| `provider.gemini` | keine fachliche Wahrheit; eingefrorener Legacy-Adapter | Gemini/Google GenAI | LEGACY_QUARANTINE_SUPERSEDED | keine neue Kopplung | Registry `LEGACY_REMOVE`; Base64-Direktübergabe ohne Originalreferenz/FactLedger, unsichtbar und nicht als D-AI-002-Port nutzbar | nicht aktivieren; kontrollierter späterer Abbau |
| `provider.klippa` | keine fachliche Wahrheit; eingefrorener Legacy-Adapter | Klippa/OCR | LEGACY_QUARANTINE_SUPERSEDED | keine neue Kopplung | Registry `LEGACY_REMOVE`, unsichtbar/nicht erreichbar; Scanpfad quarantiniert | nicht aktivieren; kontrollierter späterer Abbau |
| `provider.mail-smtp` | keine fachliche Wahrheit; Adapter/Connection | Mail/SMTP | PENDING | tenantneutraler typisierter Capability-Port | kein aktivierter Providervertrag | eigene Entscheidung/Connection |
| `provider.mollie` | keine fachliche Wahrheit; Adapter/Connection | Mollie/Payment | PENDING_AFTER_BANK_RECONCILIATION | tenantneutraler typisierter Capability-Port | Legacy-Adapter, nicht aktiviert | erst Bankabgleich, danach eigene Owner-/E2E-Freigabe |
| `provider.banking` | keine fachliche Wahrheit; Adapter/Connection | CAMT.053 Bankabgleich | PENDING_FIRST | tenantneutraler typisierter Capability-Port | kein produktiver Adapter-/E2E-Beleg | CAMT.053-Vertrag und Abgleich vor Mollie liefern |
| `provider.datev-lexware` | keine fachliche Wahrheit; Adapter/Connection | DATEV/Lexware Export | PENDING_FIRST | tenantneutraler typisierter Capability-Port | Formatlogik ohne Provider-E2E | Exportformat und E2E vor weiteren Zahlungsprovidern ratifizieren |
| `provider.google-maps` | keine fachliche Wahrheit; keine Connection | Google Maps | PENDING_MODULE_DECISION | noch kein ratifiziertes Fachmodul/Port | D-ARCH-012 erlaubt Prüfung erst bei konkretem Modulbedarf | nicht aktivieren; bei Bedarf neue Owner-Entscheidung |
| `provider.vercel-hosting` | keine fachliche Wahrheit | Vercel Hosting | REAL_HOSTING_ONLY | Deployment-Infrastruktur, kein Fachport | bestehende Preview-/Production-Checks; keine Daten-/Providerwahrheit | auf Hosting begrenzen |
| `provider.meta-marketing` | keine fachliche Wahrheit; Adapter/Connection | Meta Ads | QUARANTINE | tenantneutraler typisierter Capability-Port | Marketing entfällt laut Modulkarte | nicht reaktivieren |
| `provider.analytics-telemetry` | keine fachliche Wahrheit; Adapter/Connection | Analytics/Telemetry | QUARANTINE | tenantneutraler typisierter Capability-Port | kein externer Vertrag; KPI-/Analyseprodukt entfällt | nicht reaktivieren |
| `provider.kommunikation` | keine fachliche Wahrheit; Adapter/Connection | WhatsApp/SMS/Push | PENDING | tenantneutraler typisierter Capability-Port | F2, kein Adapter/API | eigenes F2-Paket |
| `provider.ocr-buchhaltung-abstract` | keine fachliche Wahrheit; vorhandene abstrakte Legacy-Naht | abstrakter OCR-Port | PENDING | künftiger `DocumentIntelligencePort` nur mit Originalreferenz und FactLedger | Interface ohne Produkt-E2E; isolierter Layout-/Foundry-Beleg aktiviert es nicht | erst im vertikalen Capture-Paket nach D-AI-002/D-RES-001 binden |
| `provider.ocr-manual` | keine fachliche Wahrheit; Adapter/Connection | manuelle OCR-Eingabe | PENDING | tenantneutraler typisierter Capability-Port | ehrlicher manueller Port, kein Real-E2E | eigenes Acceptance-Paket |
| `provider.mock-ocr-buchhaltung` | keine fachliche Wahrheit; Adapter/Connection | Mock OCR | QUARANTINE | tenantneutraler typisierter Capability-Port | produktionsnaher Mock laut Registry | kontrolliert entfernen |
| `provider.mock-buchhaltung` | keine fachliche Wahrheit; Adapter/Connection | Mock Buchhaltung | QUARANTINE | tenantneutraler typisierter Capability-Port | produktionsnaher Mock laut Registry | kontrolliert entfernen |
| `provider.mock-marketing` | keine fachliche Wahrheit; Adapter/Connection | Mock Marketing | QUARANTINE | tenantneutraler typisierter Capability-Port | produktionsnaher Mock laut Registry | kontrolliert entfernen |

## Alle sichtbaren und Legacy-Seitenrouten aus dem Register

Jede Route besitzt eine eigene, konkrete Inventarzeile. `REAL` gilt nur für den ausdrücklich genannten Beleg; `PENDING` ist nicht geliefert; `QUARANTINE` ist ein sichtbarer Abbaufehler und keine verfügbare Capability.

| Registry-ID | Route | Eigene Wahrheit | Provider/API | Status | Querverbindungen und echter Acceptance-Beleg | Verantwortlicher nächster Schritt |
|---|---|---|---|---|---|---|
| `page.root` | `/` | Rollen-Home nach D-UI-CORE-002; aktuelle Alt-Shell | keiner | PENDING | Fundament-Rollen → Phillip/Rolf/Settings; OWNER_UX_FAIL; Rollen-/Full-Route-A noch nicht belegt | PATH1_UI_CONVERGENCE_A |
| `page.admin.analytics` | `/admin/analytics` | Legacy: keine akzeptierte Wahrheit | Analytics | QUARANTINE | keine neue Kopplung; Disposition gemäß Modulkarte; Registry: sichtbar+erreichbar; kein akzeptierter Full-Route-E2E | PATH1_UI_CONVERGENCE_A: Link-/Importprüfung, dann Route entfernen oder 404 |
| `page.admin.devices` | `/admin/devices` | Fundament | keiner | PENDING | keine neue Kopplung; Disposition gemäß Modulkarte; Registry: sichtbar+erreichbar; kein akzeptierter Full-Route-E2E | zuständiges Path-1-Teilpaket mit Full-Route-E2E |
| `page.admin.import` | `/admin/import` | Fundament | Import ungeklärt | PENDING | keine neue Kopplung; Disposition gemäß Modulkarte; Registry: sichtbar+erreichbar; kein akzeptierter Full-Route-E2E | zuständiges Path-1-Teilpaket mit Full-Route-E2E |
| `page.admin.testanalyse.live` | `/admin/testanalyse/live` | Legacy-Testtool | keiner | QUARANTINE | keine neue Kopplung; Disposition gemäß Modulkarte; Registry: sichtbar+erreichbar; kein akzeptierter Full-Route-E2E | PATH1_UI_CONVERGENCE_A: Link-/Importprüfung, dann Route entfernen oder 404 |
| `page.admin.testanalyse` | `/admin/testanalyse` | Legacy-Testtool | keiner | QUARANTINE | keine neue Kopplung; Disposition gemäß Modulkarte; Registry: sichtbar+erreichbar; kein akzeptierter Full-Route-E2E | PATH1_UI_CONVERGENCE_A: Link-/Importprüfung, dann Route entfernen oder 404 |
| `page.buchhaltung` | `/buchhaltung` | Accounting-minimal Einstieg | keiner | PENDING | keine neue Kopplung; Disposition gemäß Modulkarte; Registry: sichtbar+erreichbar; kein akzeptierter Full-Route-E2E | zuständiges Path-1-Teilpaket mit Full-Route-E2E |
| `page.buchhaltung.rechnungen` | `/buchhaltung/rechnungen` | Accounting-minimal | keiner | PENDING | keine neue Kopplung; Disposition gemäß Modulkarte; Registry: sichtbar+erreichbar; kein akzeptierter Full-Route-E2E | zuständiges Path-1-Teilpaket mit Full-Route-E2E |
| `page.customers.id` | `/customers/[id]` | Customers-Backend PARTIALLY_REAL; Kundenkarte V2 NOT_DELIVERED | keiner | PENDING | Customers ↔ Orders ↔ Intake; Detailroute vorhanden; Gleichheit mit V2-Overlay nicht belegt | PATH1_UI_CONVERGENCE_C |
| `page.customers` | `/customers` | Customers-Backend PARTIALLY_REAL; Kundenkarte V2 NOT_DELIVERED | keiner | PENDING | Customers ↔ Orders ↔ Intake; reale Liste vorhanden; identische V2 Listen-/Overlay-/Detailwahrheit fehlt | PATH1_UI_CONVERGENCE_C |
| `page.orders.id` | `/orders/[id]` | Orders-Backend PARTIALLY_REAL; Auftragskarte V8 NOT_DELIVERED | keiner | PENDING | Orders ↔ Customers ↔ Accounting-minimal; Detailroute vorhanden; Gleichheit mit V8-Overlay nicht belegt | PATH1_UI_CONVERGENCE_B |
| `page.orders` | `/orders` | Orders-Backend PARTIALLY_REAL; Auftragskarte V8 NOT_DELIVERED | keiner | PENDING | Orders ↔ Customers ↔ Accounting-minimal; reale Liste vorhanden; identische V8 Listen-/Overlay-/Detailwahrheit fehlt | PATH1_UI_CONVERGENCE_B |
| `page.settings` | `/settings` | Fundament/App-Konfiguration | keiner | PENDING | nur berechtigte Rollen admin/developer; Rollenweiterleitung und Full-Route-A fehlen | PATH1_UI_CONVERGENCE_A |
| `page.start` | `/start` | Fundament-Login; aktuelle Startseite noch nicht login-only | keiner | PENDING | Auth → `/` Rollen-Home; Login-only ohne Wetter/Event/Provider noch nicht belegt | PATH1_UI_CONVERGENCE_A |
| `page.warendurchlauf.galvanik` | `/warendurchlauf/galvanik` | Orders: flacher Galvanik-Blackbox-Drilldown | keiner | PENDING | Orders-Lifecycle-Port; bestehender Fachpfad; Ziel-Shell-/Nav-Abnahme fehlt | PATH1_UI_CONVERGENCE_A_THEN_B |
| `page.warendurchlauf.neu` | `/warendurchlauf/neu` | Intake-Aktionspfad | Storage | PENDING | Intake → Orders; F1.1 realer Vertrag; Einbindung in Ziel-Shell offen | PATH1_UI_CONVERGENCE_A |
| `page.warendurchlauf` | `/warendurchlauf` | S4-Werkstatt-Innenmodul DELIVERED; Gesamt-Shell NOT_DELIVERED | keiner | PENDING | Phillip-Ports → Orders/Intake/Accounting; S4-Innenmodul belegt; Full-Route-A ausdrücklich offen | PATH1_UI_CONVERGENCE_A |
| `page.warendurchlauf.wareneingang` | `/warendurchlauf/wareneingang` | Intake-Backend REAL; Wareneingang-Aktionspfad | Storage | PENDING | Intake → Orders; F1.1 Receipt real; Full-Route-Zielintegration offen | PATH1_UI_CONVERGENCE_A |

## Belegte Quarantänebefunde

- `src/lib/buchhaltung/ocr/MockOcrProvider.ts`, `src/lib/buchhaltung/providers/MockBuchhaltungProvider.ts` und `src/lib/marketing/marketingMockProvider.ts` sind im Capability-Register als `LEGACY_REMOVE` belegt. Sie werden hier nicht aktiviert, umverdrahtet oder gelöscht.
- Weitere PENDING- oder QUARANTINE-Fähigkeiten werden nicht durch Dokumentation verfügbar. Ohne echten Vertrag, Provideraufruf, Receipt, Readback und sichtbaren Zustand bleiben sie geschlossen.
