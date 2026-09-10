# Provider- und Capability-Matrix

Stand: 2026-09-10 · D-GOV-001 · D-ARCH-011
Quellen: `MODULKARTE_KANON.md`, `ARCHITEKTUR_MODULE_PATH1.md`, `F1_R0_CAPABILITY_REGISTRY.json` auf `main@13240de2a5ca9e9cfae4f8c72552443dac1d7630`.

Diese Matrix ist Inventar und Acceptance-Plan, keine Scope- oder Baustartautorität. `REAL` bedeutet ausschließlich: unveränderlicher echter Beleg im Capability-Register. `PENDING` bedeutet: Vertrag, Secret oder Real-E2E fehlt. `QUARANTINE` bedeutet: nicht reaktivieren; erst eigener Abbau-/Disposition-Nachweis.

## Statusvertrag je Zeile

| Status | Eigene Wahrheit | Provider/API | Querverbindung | Acceptance-Beleg | Verantwortlicher nächster Schritt |
|---|---|---|---|---|---|
| REAL | bleibt beim genannten Fachmodul | nur belegter Adapter | nur typisierter Port/View | eingefrorener Real-E2E-/Receipt-Nachweis | Vertrag erhalten |
| PENDING | keine zweite Wahrheit anlegen | fail-closed bis Vertrag/Secret/E2E | erst nach ratifiziertem Port | echte Quelle → Port → Readback → UI/Health | eigenes freigegebenes Paket |
| QUARANTINE | keine fachliche Wahrheit | nicht aktivieren | keine neue Kopplung | Nicht-Erreichbarkeit bzw. kontrollierter Abbau | S2/gesonderte Disposition |

## Planmäßige Module

| Capability | Eigene Wahrheit | Provider/API-Bedarf | Status | Querverbindungen | Acceptance | Nächster Schritt |
|---|---|---|---|---|---|---|
| `module.fundament` | Identity, Tenant, Commands, Events, Receipts, Storage/Views | Supabase/Postgres, Auth, Storage | REAL | stellt sichere Ports bereit | bestehende F0/F1.1-Belege | erhalten |
| `module.suche` | keine Speicherung; deterministische Komposition vorhandener Reads | keiner | PENDING | Orders- und Customers-Read-Ports | unabhängiger Exact-SHA-PASS und Merge | Mission steuert |
| `module.intake` | Wareneingang/Originalzuordnung | Storage; OCR separat | REAL | Customers, Orders, Fundament | F1.1-Receipt/Reload | erhalten |
| `module.orders` | Auftrag, Teil, Lifecycle, Ereignisse | keiner | REAL | Intake, Customers, Accounting | F1.2/F1.3/F1.5-Receipts | erhalten |
| `module.customers` | Kunde/Kundenkarte | keiner | REAL | Orders, Suche | realer Tenant-/Readback-Beleg | erhalten |
| `module.calendar` | keine eigene Terminwahrheit; nur Projektion | Microsoft 365 Graph über `CalendarPort` | PENDING | Termin-Ports der Fachmodule | echtes M365-Konto, Consent, Delta/Webhook, Reconciliation und UI-E2E | `BLOCKED_EXTERNAL_PERMISSION` |
| `module.accounting-minimal` | unveränderliche Rechnung und Zahlung | zunächst keiner; Bank/Mollie separat | REAL | Orders-Freeze/Goods-out | F1.4/F1.5-Receipts | erhalten |

## Provider-/API-Inventar

| Registry-ID / Entscheidung | Anbieter | Status | Beleg oder offene Grenze | Nächster Schritt |
|---|---|---|---|---|
| `provider.supabase-postgres` | Supabase/Postgres | REAL | Registry `REAL_VERIFIED` | erhalten |
| `provider.supabase-auth` | Supabase/Auth | REAL | Registry `REAL_VERIFIED` | erhalten |
| `provider.supabase-storage` | Supabase/Storage | REAL | Registry `REAL_VERIFIED` | erhalten |
| `provider.calendar-m365-graph` | Microsoft 365/Graph | PENDING | D-ARCH-011; kein Konto/Consent/Port/E2E | delegierten benannten Büronutzer und Least-Privilege-Consent ownerseitig bereitstellen |
| `provider.gemini` | Gemini/Google GenAI | PENDING | Registry `REAL_PENDING_SECRET`; keine Kalenderentscheidung | eigener Capability-Vertrag und Secret-Gate |
| `provider.klippa` | Klippa/OCR | PENDING | Registry `REAL_PENDING_SECRET`; Scanpfad quarantiniert | eigener OCR-E2E |
| `provider.mail-smtp` | Mail/SMTP | PENDING | kein aktivierter Providervertrag | eigene Entscheidung/Connection |
| `provider.mollie` | Mollie/Payment | PENDING | Legacy-Adapter, nicht aktiviert | spätere eigene Owner-Entscheidung |
| `provider.banking` | Banking-Import | PENDING | kein Adapter belegt | spätere eigene Owner-Entscheidung |
| `provider.datev-lexware` | DATEV/Lexware Export | PENDING | Formatlogik ohne Provider-E2E | Steuerberaterformat und E2E ratifizieren |
| `provider.meta-marketing` | Meta Ads | QUARANTINE | Marketing entfällt laut Modulkarte | nicht reaktivieren |
| `provider.analytics-telemetry` | Analytics/Telemetry | QUARANTINE | kein externer Vertrag; KPI-/Analyseprodukt entfällt | nicht reaktivieren |
| `provider.kommunikation` | WhatsApp/SMS/Push | PENDING | F2, kein Adapter/API | eigenes F2-Paket |
| `provider.ocr-buchhaltung-abstract` | abstrakter OCR-Port | PENDING | Interface ohne Provider-E2E | nur mit ratifiziertem Provider binden |
| `provider.ocr-manual` | manuelle OCR-Eingabe | PENDING | ehrlicher manueller Port, kein Real-E2E | eigenes Acceptance-Paket |
| `provider.mock-ocr-buchhaltung` | Mock OCR | QUARANTINE | produktionsnaher Mock laut Registry | kontrolliert entfernen |
| `provider.mock-buchhaltung` | Mock Buchhaltung | QUARANTINE | produktionsnaher Mock laut Registry | kontrolliert entfernen |
| `provider.mock-marketing` | Mock Marketing | QUARANTINE | produktionsnaher Mock laut Registry | kontrolliert entfernen |

## Alle sichtbaren Seitenrouten aus dem Register

Die Spalte „Wahrheit/Provider“ nennt entweder das zuständige Modul oder `Legacy: keine akzeptierte Wahrheit`. Acceptance und nächster Schritt folgen verbindlich dem Statusvertrag oben.

| Registry-ID | Route | Wahrheit/Provider | Status |
|---|---|---|---|
| `page.root` | `/` | Werkstatt-Komposition / keiner | PENDING |
| `page.admin.analytics` | `/admin/analytics` | Legacy: keine akzeptierte Wahrheit / Analytics | QUARANTINE |
| `page.admin.devices` | `/admin/devices` | Fundament / keiner | PENDING |
| `page.admin.import` | `/admin/import` | Fundament / Import ungeklärt | PENDING |
| `page.admin.testanalyse.live` | `/admin/testanalyse/live` | Legacy-Testtool / keiner | QUARANTINE |
| `page.admin.testanalyse` | `/admin/testanalyse` | Legacy-Testtool / keiner | QUARANTINE |
| `page.analyse` | `/analyse` | Legacy: keine akzeptierte Wahrheit / Analytics | QUARANTINE |
| `page.archive` | `/archive` | Legacy: Verwertbarkeit offen / keiner | QUARANTINE |
| `page.baeder` | `/baeder` | Legacy: laut Modulkarte entfallen / keiner | QUARANTINE |
| `page.betrieb-kvp` | `/betrieb-kvp` | Legacy: laut Modulkarte entfallen / keiner | QUARANTINE |
| `page.betrieb` | `/betrieb` | Legacy: laut Modulkarte entfallen / keiner | QUARANTINE |
| `page.buchhaltung.ausgaben` | `/buchhaltung/ausgaben` | außerhalb Accounting-minimal / keiner | QUARANTINE |
| `page.buchhaltung.belege.id` | `/buchhaltung/belege/[id]` | außerhalb Accounting-minimal / OCR offen | QUARANTINE |
| `page.buchhaltung.belege.neu` | `/buchhaltung/belege/neu` | außerhalb Accounting-minimal / OCR offen | QUARANTINE |
| `page.buchhaltung.belege` | `/buchhaltung/belege` | außerhalb Accounting-minimal / OCR offen | QUARANTINE |
| `page.buchhaltung.bwa` | `/buchhaltung/bwa` | Legacy KPI / keiner | QUARANTINE |
| `page.buchhaltung.einstellungen` | `/buchhaltung/einstellungen` | außerhalb Accounting-minimal / keiner | QUARANTINE |
| `page.buchhaltung.export` | `/buchhaltung/export` | Accounting-minimal / DATEV-Lexware | PENDING |
| `page.buchhaltung.fristen` | `/buchhaltung/fristen` | außerhalb Accounting-minimal / Kalender | QUARANTINE |
| `page.buchhaltung.kosten.id` | `/buchhaltung/kosten/[id]` | außerhalb Accounting-minimal / keiner | QUARANTINE |
| `page.buchhaltung.kosten.neu` | `/buchhaltung/kosten/neu` | außerhalb Accounting-minimal / keiner | QUARANTINE |
| `page.buchhaltung.kosten` | `/buchhaltung/kosten` | außerhalb Accounting-minimal / keiner | QUARANTINE |
| `page.buchhaltung.kraftstoff` | `/buchhaltung/kraftstoff` | außerhalb Accounting-minimal / keiner | QUARANTINE |
| `page.buchhaltung` | `/buchhaltung` | Accounting-minimal Einstieg / keiner | PENDING |
| `page.buchhaltung.periodenabschluss` | `/buchhaltung/periodenabschluss` | außerhalb Accounting-minimal / keiner | QUARANTINE |
| `page.buchhaltung.rechnungen.id` | `/buchhaltung/rechnungen/[id]` | Accounting-minimal / keiner | PENDING |
| `page.buchhaltung.rechnungen.neu` | `/buchhaltung/rechnungen/neu` | Accounting-minimal / keiner | PENDING |
| `page.buchhaltung.rechnungen` | `/buchhaltung/rechnungen` | Accounting-minimal / keiner | PENDING |
| `page.buchhaltung.steuerprofil` | `/buchhaltung/steuerprofil` | außerhalb Accounting-minimal / keiner | QUARANTINE |
| `page.buchhaltung.zahlung` | `/buchhaltung/zahlung` | Legacy-Zahlung / Mollie | QUARANTINE |
| `page.cockpit.jahresplan` | `/cockpit/jahresplan` | Legacy KPI / keiner | QUARANTINE |
| `page.cockpit` | `/cockpit` | Legacy KPI / keiner | QUARANTINE |
| `page.customers.id` | `/customers/[id]` | Customers / keiner | PENDING |
| `page.customers` | `/customers` | Customers / keiner | PENDING |
| `page.feedback.token` | `/feedback/[token]` | Legacy: Verwertbarkeit offen / Mail | QUARANTINE |
| `page.finanzen` | `/finanzen` | Legacy: laut Modulkarte entfallen / keiner | QUARANTINE |
| `page.items` | `/items` | Orders/Accounting Preisquelle / keiner | PENDING |
| `page.kalender` | `/kalender` | Calendar-Projektion / Microsoft 365 Graph | PENDING |
| `page.kommunikation` | `/kommunikation` | F2 / Mail-Notification | QUARANTINE |
| `page.kontrolle` | `/kontrolle` | Legacy KPI / keiner | QUARANTINE |
| `page.kunden-auftraege` | `/kunden-auftraege` | Legacy-Dublette / keiner | QUARANTINE |
| `page.kvp` | `/kvp` | Legacy: laut Modulkarte entfallen / keiner | QUARANTINE |
| `page.lager` | `/lager` | Legacy: Owner-Entscheid löschen / keiner | QUARANTINE |
| `page.lieferanten.id` | `/lieferanten/[id]` | Legacy: Owner-Entscheid löschen / keiner | QUARANTINE |
| `page.lieferanten` | `/lieferanten` | Legacy: Owner-Entscheid löschen / keiner | QUARANTINE |
| `page.marketing.aktion.neu` | `/marketing/aktion/neu` | Legacy Marketing / Meta | QUARANTINE |
| `page.marketing.aktion` | `/marketing/aktion` | Legacy Marketing / Meta | QUARANTINE |
| `page.marketing.attribution` | `/marketing/attribution` | Legacy Marketing / Meta | QUARANTINE |
| `page.marketing.einwilligungen` | `/marketing/einwilligungen` | Legacy Marketing / Meta | QUARANTINE |
| `page.marketing.kanaele` | `/marketing/kanaele` | Legacy Marketing / Meta | QUARANTINE |
| `page.marketing` | `/marketing` | Legacy Marketing / Meta | QUARANTINE |
| `page.marketing.segmente.id` | `/marketing/segmente/[id]` | Legacy Marketing / Meta | QUARANTINE |
| `page.marketing.segmente.neu` | `/marketing/segmente/neu` | Legacy Marketing / Meta | QUARANTINE |
| `page.marketing.segmente` | `/marketing/segmente` | Legacy Marketing / Meta | QUARANTINE |
| `page.orders.id` | `/orders/[id]` | Orders / keiner | PENDING |
| `page.orders` | `/orders` | Orders / keiner | PENDING |
| `page.performance.baeder-material` | `/performance/baeder-material` | Legacy KPI / keiner | QUARANTINE |
| `page.performance.ki-empfehlungen` | `/performance/ki-empfehlungen` | Legacy KPI / Gemini | QUARANTINE |
| `page.performance.kunden-markt` | `/performance/kunden-markt` | Legacy KPI / keiner | QUARANTINE |
| `page.performance` | `/performance` | Legacy KPI / keiner | QUARANTINE |
| `page.performance.qualitaet-risiko` | `/performance/qualitaet-risiko` | Legacy KPI / keiner | QUARANTINE |
| `page.performance.umsatz-marge` | `/performance/umsatz-marge` | Legacy KPI / keiner | QUARANTINE |
| `page.performance.werkstatt-puls` | `/performance/werkstatt-puls` | Legacy KPI / keiner | QUARANTINE |
| `page.print-queue` | `/print-queue` | Legacy: laut Modulkarte entfallen / keiner | QUARANTINE |
| `page.quotes.new` | `/quotes/new` | F2 / Mail | QUARANTINE |
| `page.quotes` | `/quotes` | F2 / Mail | QUARANTINE |
| `page.scan` | `/scan` | Intake-Capture / OCR | QUARANTINE |
| `page.settings` | `/settings` | Fundament/App-Konfiguration / keiner | PENDING |
| `page.start` | `/start` | Legacy konkurrierendes Home / keiner | QUARANTINE |
| `page.station.slug` | `/station/[slug]` | Legacy Galvanik-Innenleben / keiner | QUARANTINE |
| `page.status` | `/status` | Fundament-Readback / keiner | REAL |
| `page.telefonnotiz` | `/telefonnotiz` | Customers/Intake / Mail später | PENDING |
| `page.today` | `/today` | Legacy konkurrierendes Home / keiner | QUARANTINE |
| `page.warendurchlauf.galvanik` | `/warendurchlauf/galvanik` | Orders / keiner | PENDING |
| `page.warendurchlauf.neu` | `/warendurchlauf/neu` | Intake / Storage | PENDING |
| `page.warendurchlauf` | `/warendurchlauf` | Werkstatt-Komposition / keiner | PENDING |
| `page.warendurchlauf.warenausgang` | `/warendurchlauf/warenausgang` | Orders/Accounting-minimal / keiner | PENDING |
| `page.warendurchlauf.wareneingang` | `/warendurchlauf/wareneingang` | Intake / Storage | REAL |

## Belegte Quarantänebefunde

- `src/app/kalender/page.tsx` enthält einen sichtbaren Text „Google Kalender … vorbereitet“. Das ist kein Vertrag und keine Providerentscheidung. Die Route bleibt unverändert; der Befund ist `QUARANTINE`, bis ein eigenes Kalenderpaket die M365-Projektion real liefert.
- `src/lib/buchhaltung/ocr/MockOcrProvider.ts`, `src/lib/buchhaltung/providers/MockBuchhaltungProvider.ts` und `src/lib/marketing/marketingMockProvider.ts` sind im Capability-Register als `LEGACY_REMOVE` belegt. Sie werden hier nicht aktiviert, umverdrahtet oder gelöscht.
- Weitere PENDING- oder QUARANTINE-Fähigkeiten werden nicht durch Dokumentation verfügbar. Ohne echten Vertrag, Provideraufruf, Receipt, Readback und sichtbaren Zustand bleiben sie geschlossen.
