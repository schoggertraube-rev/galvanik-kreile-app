<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 04 — Schnittstellen und Daten

## 1. Angebotene Ports

Alle neuen Querzugriffe laufen ausschließlich über `src/modules/accounting/public.ts` beziehungsweise die neu anzulegende `server-public.ts`. Die heute verteilten Implementierungen sind kein erlaubter Dauerzustand.

| Port / Export | Richtung | Vertrag | Ist-Stand | Ziel |
|---|---|---|---|---|
| `AccountingEntry` | UI öffentlich | einziger Shell-Einstieg nach `/buchhaltung/rechnungen` | in `public.ts` exportiert | bleibt, komponiert G07-Screen über Fassade |
| `InvoiceReadPort` | Server öffentlich | `listSummaries`, `readIssueReceipt`, `readCancellationReceipt`, tenantgebundene Result-Codes | intern in `invoiceRead.ts` | nach `server-public.ts`, keine Tiefimporte |
| `InvoiceCommandPort` | Server öffentlich | `issueInvoice`, `cancelInvoice`, erwartete Version, idempotente ID, Receipt | intern in `immutableInvoiceCommand.ts` | nach Accounting-Modul; DB-P0 für Storno ergänzen |
| `InvoiceDocumentPort` | API/Server öffentlich | Original-/Storno-PDF nach ID/Art mit Hash-Readback | API-Route + `invoiceRead.ts` | Route komponiert nur Modul-Fassade |
| `PaymentReadPort` | Server öffentlich | kanonischer Payment-/Goods-out-State | `paymentSummaryRead.ts`, `paymentContract.ts` | nach Accounting-Fassade |
| `PaymentCommandPort` | Server öffentlich | `setPaymentMode`, `confirmPayment` mit Receipt/Readback | verteilte Commands | nach Accounting-Fassade und Owner-Regeln umbauen |
| `GoodsOutCommandPort` | Server öffentlich | `recordGoodsOut` mit Gate, V1/V2-Receipt und Readback | `recordGoodsOutCommand.ts` | Accounting bietet Port; G04/Werkstatt komponiert ihn |
| `OutgoingInvoiceExportPort` | Server öffentlich | versionierter tenantgebundener Export ohne Mutation | fehlt | geschlossen, bis Q-G07-002 freigegeben |
| `EInvoicePort` | intern hinter Invoice-Command | ZUGFeRD-Generator/Validator/Hashvertrag | fehlt | geschlossen, bis Q-G07-001 freigegeben |

## 2. Benötigte Host-Ports

| Host-Port | Besitzer | Minimale Daten/Fähigkeit | Fail-closed-Regel |
|---|---|---|---|
| `IdentityAccessPort` | G01 Fundament/Rechte | `actorId`, `tenantId`, aktiv, persönliche Capabilities | kein Actor/Tenant/Capability → kein Read/Command |
| `OrderBillingSourcePort` | G04 Orders | Order-ID/-Nummer/-Version, Station/Lifecycle, Freeze-ID/-Status, Positionen, Leistungsdatum | nicht `fertig` oder ungültiger Freeze → keine Rechnung; Ausnahme nur D-F15-003 nach belegter Zielrechnungsfreigabe |
| `CustomerBillingProfilePort` | G05 Customers | Customer-ID, Rechnungsname/-anschrift, Kontakt, Land, Zielrechnungsfreigabe + Version/Audit | unvollständige Adresse oder unklare Freigabe → keine Rechnung/Zielrechnung |
| `CompanyInvoiceSettingsPort` | G10 Einstellungen | Firmenname, Anschrift, Land, Steuer-ID, Bankdaten, 19 Prozent, Nummernkreis-/Zahlungsparameter | unvollständig/abweichend → keine Rechnung |
| `CatalogPricingPort` | G04/G10 | eingefrorene Positionen, Gruppensemantik, Menge, Einheit, Einzel-/Gesamtpreis | fehlende/ungültige Position → keine Rechnung |
| `ConflictProjectionPort` | G09 | deduplizierter Konflikt mit Owner, Anzeigeort, Ursache, Auflösung | Port fehlt → keine stille lokale Konfliktablage; Startseitenanzeige bleibt GEPLANT |
| `RetentionPolicyPort` | G10/G01 | Dokumentart, Mindestfrist, Ablaufhemmung, Vorschlag, Admin-Freigabe, Audit/Readback | Port/Frist unklar oder Freigabe fehlt → keine Löschung/Anonymisierung und keine Änderung unveränderlicher Belegbytes |
| `PaymentAdapter` | M01 später | idempotente Terminalabsicht, Providerstatus/-receipt, Korrelation | nicht verbunden/unklar → kein `confirmPayment`; manueller Kassenweg bleibt |

## 3. Events

| Event | Besitzer | Erzeuger | Konsumenten | Version/Receipt-Regel |
|---|---|---|---|---|
| `INVOICE_CREATED_V1` | Accounting | `issueInvoice` vor Warenausgang | G04 Timeline, G07 Read, G08 Suche, G09 | Schema 1; je Tenant/Client-ID/Invoice-Version eindeutig |
| `INVOICE_CREATED_V2` | Accounting | `issueInvoice` nach Zielrechnungs-Warenausgang | wie V1 | Schema 2; bindet ehrlichen V2-Ausgang, keine erfundene Zahlung |
| `INVOICE_CANCELLED_V1` | Accounting | `cancelInvoice` | G04, G07, G08, G09, Export | Schema 1; Originalhash bleibt unverändert |
| `PAYMENT_MODE_SET_V1` | Accounting | `setPaymentMode` | G04, G07, G09 | Schema 1; erwartete Modusversion + idempotente ID |
| `PAYMENT_CONFIRMED_V1` | Accounting | `confirmPayment` | G04, G07, G09, später M01 | Schema 1; Teil-/Vollzahlung und kumulierter Readback |
| `ORDER_PICKED_UP_V1` | Accounting/G04-Naht | `recordGoodsOut` bei vorhandener Rechnung | G04 Lifecycle, G07, G09 | Schema 1; Zahlungsstatus/-betrag belegt |
| `ORDER_PICKED_UP_V2` | Accounting/G04-Naht | `recordGoodsOut` bei freigeschalteter Zielrechnung vor Rechnung | G04, G07, G09 | Schema 2; `invoiceState=not_issued`, keine Zahlungswerte |
| Kunden-Zielrechnungsfreigabe | G05 | noch festzulegender G05-Command | G07/G09 | FEHLT → Q-G07-003; kein neues G07-Event erfinden |
| ZUGFeRD-Erzeugung/Validierung | Accounting | Invoice-Command | G07/Export | FEHLT → Q-G07-001; kein Erfolgsevent vor Vertrag |
| Aufbewahrungs-/Anonymisierungsvorschlag | G10/G01 | noch festzulegender Policy-/Freigabe-Command | G07/G09/Audit | FEHLT → Q-G07-009; niemals stiller Lösch- oder Mutationspfad |

## 4. Datenmodell-Feldliste

Abkürzungen in `Ist im Schema`: `BASE` = `supabase/migrations/20260805180624_production_schema_baseline.sql`; `F14` = `20260821152949_f1_4_immutable_invoice_contract.sql`; `F15A` = `20260905100000_f1_5_payment_goods_out_contract.sql`; `F15B` = `20260905201850_f1_5_payment_mode_intake_contract.sql`; `F15V2` = `20260909170000_f1_5_payment_goods_out_v2_contract.sql`; `F15UI` = `20260909180000_f1_5_goods_out_ui_read_contract.sql`.

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| `public.invoices` | `id` | uuid | ja | PK; PDF-Referenzen binden ID | Accounting | `BASE`; `F14` |
| `public.invoices` | `tenant_id` | text | ja | serverseitig, alle FK/Unique tenantgebunden | G01/Accounting | `BASE`; `F14` |
| `public.invoices` | `customer_id` | text | ja | Tenant-FK zu Customer | G05, lesend Accounting | `BASE`; `F14` |
| `public.invoices` | `order_id` | text | ja | Tenant-FK; eine aktive F1.4-Rechnung je Auftrag | G04, lesend Accounting | `BASE`; `F14` |
| `public.invoices` | `invoice_number` | text | ja ab Ausgabe | `^R-[0-9]{4}-[0-9]{4,}$`, Tenant-unique, Jahr Berlin | Accounting | `BASE`; `F14` |
| `public.invoices` | `amount_total` | numeric | ja ab Ausgabe | entspricht `gross_amount_cents / 100` | Accounting | `BASE`; `F14` |
| `public.invoices` | `status` | text | ja | für Contract 1 nur `issued`/`cancelled` | Accounting | `BASE`; `F14` |
| `public.invoices` | `due_date` | date | ja ab Ausgabe | heute `issued_at` Berlin + `payment_term_days`; Zielvertrag siehe Q-G07-006 | Accounting | `BASE`; `F14` |
| `public.invoices` | `created_at` | timestamptz | ja | DB-Zeit | Accounting | `BASE` |
| `public.invoices` | `contract_version` | integer | ja für F1.4 | exakt 1 | Accounting | `F14` |
| `public.invoices` | `freeze_id` | uuid | ja | Tenant-FK; eine aktive Rechnung je Freeze | G04, Snapshot in Accounting | `F14` |
| `public.invoices` | `snapshot` | jsonb | ja | Version, Seller, Customer, Order, Lines, Totals, Leistungstag, Ausgabezeit, Zahlungsziel; shape-check | Accounting | `F14` |
| `snapshot.seller` | `companyName, street, zipCode, city, country, taxId, iban, bic, bankName` | JSON string fields | ja | nicht leer, aus G10 eingefroren | G10 → Accounting-Snapshot | `F14` |
| `snapshot.customer` | `name, companyName, contactPerson, street, zipCode, city, country` | JSON string/null | ja nach Shape | Rechnungsadresse aus G05 eingefroren | G05 → Accounting-Snapshot | `F14` |
| `snapshot.order` | `orderId, orderVersion, orderNumber, title, freezeId` | JSON | ja | identisch zur Quelle | G04 → Accounting-Snapshot | `F14` |
| `snapshot.lines[]` | Position, Beschreibung, Menge, Einheit, Netto | JSON array | ja, mindestens 1 | Preise/Positionen aus Freeze; Summen konsistent | G04/G10 → Accounting-Snapshot | `F14` |
| `snapshot.totals` | `netAmountCents, vatRateBasisPoints, vatAmountCents, grossAmountCents` | JSON integer fields | ja | Cent-integer, Summe konsistent | Accounting | `F14` |
| `public.invoices` | `net_amount_cents` | integer | ja | ≥0 | Accounting | `F14` |
| `public.invoices` | `vat_rate_basis_points` | integer | ja | Ist: 700/1900; Soll Kreile: nur 1900 | G10/Accounting | `F14` — UMBau A-G07-006 |
| `public.invoices` | `vat_amount_cents` | integer | ja | ≥0, Rundung aus Netto/Satz | Accounting | `F14` |
| `public.invoices` | `gross_amount_cents` | integer | ja | Netto + USt | Accounting | `F14` |
| `public.invoices` | `service_date` | date | ja | eingefroren, darf nicht Ausgabezeit ersetzen | G04 → Accounting | `F14` |
| `public.invoices` | `order_version` | integer | ja | >0, identisch zum Freeze | G04 → Accounting | `F14` |
| `public.invoices` | `payment_term_days` | integer | ja im Ist | Ist 1–365; Soll 14 nur Zielrechnung, andere Texte offen | Accounting/G10 | `F14` — UMBau Q-G07-006 |
| `public.invoices` | `aggregate_version` | integer | ja | 1 Ausgabe, 2 Storno | Accounting | `F14` |
| `public.invoices` | `client_event_id` | uuid | ja | tenant-unique für Ausgabe | Accounting | `F14` |
| `public.invoices` | `correlation_id` | uuid | ja | eindeutig im Lifecycle-Event | Accounting | `F14` |
| `public.invoices` | `issue_event_id` | text | ja | unique, bindet Event | Accounting | `F14` |
| `public.invoices` | `issued_at` | timestamptz | ja | DB-/Commandzeit; Nummernjahr Berlin | Accounting | `F14` |
| `public.invoices` | `issued_by` | uuid | ja | FK Actor, serverseitig | G01 → Accounting | `F14` |
| `public.invoices` | `pdf_ref` | text | ja | `invoice://<id>/original` | Accounting | `F14` |
| `public.invoices` | `pdf_sha256` | text | ja | 64 lowercase hex, passt zu Bytes | Accounting | `F14` |
| `public.invoices` | `pdf_content` | bytea | ja | 1–20 MiB, echtes PDF | Accounting | `F14` |
| `public.invoices` | `cancel_client_event_id` | uuid | bei Storno | tenant-unique | Accounting | `F14` |
| `public.invoices` | `cancel_correlation_id` | uuid | bei Storno | bindet Stornoevent | Accounting | `F14` |
| `public.invoices` | `cancelled_by` | uuid | bei Storno | FK Actor | G01 → Accounting | `F14` |
| `public.invoices` | `cancel_reason` | text | bei Storno | 5–500 Zeichen im Command | Accounting | `F14` |
| `public.invoices` | `cancelled_at` | timestamptz | bei Storno | gesetzt bei Status `cancelled` | Accounting | `F14` |
| `public.invoices` | `cancel_event_id` | text | bei Storno | unique | Accounting | `F14` |
| `public.invoices` | `cancellation_pdf_ref` | text | bei Storno | `invoice://<id>/cancellation` | Accounting | `F14` |
| `public.invoices` | `cancellation_pdf_sha256` | text | bei Storno | 64 lowercase hex | Accounting | `F14` |
| `public.invoices` | `cancellation_pdf_content` | bytea | bei Storno | echtes PDF, hashgleich | Accounting | `F14` |
| `public.invoices` | `payment_contract_version` | integer | für F1.5 | exakt 1 | Accounting | `F15A` |
| `public.invoices` | `payment_mode` | text | für F1.5 | `vorkasse`, `abholung`, `rechnung`; Soll-Eligibility zusätzlich prüfen | Accounting | `F15A` |
| `public.invoices` | `payment_status` | text | für F1.5 | `offen`, `teilbezahlt`, `bezahlt` | Accounting | `F15A` |
| `public.invoices` | `payment_open_amount_cents` | integer | für F1.5 | ≥0; bezahlt + offen = brutto | Accounting | `F15A` |
| `public.invoices` | `payment_paid_amount_cents` | integer | für F1.5 | ≥0; bezahlt + offen = brutto | Accounting | `F15A` |
| `public.invoices` | `payment_currency` | text | für F1.5 | exakt `EUR` | Accounting | `F15A` |
| `public.invoices` | `payment_method` | text/null | nach Zahlung | `bar`, `ueberweisung`, `karte` | Accounting | `F15A` |
| `public.invoices` | `payment_paid_at` | timestamptz/null | nach Zahlung | zusammen mit Receipt/Event gesetzt | Accounting | `F15A` |
| `public.invoices` | `payment_receipt_id` | text/null | nach Zahlung | kanonischer Receipt-Bezug | Accounting | `F15A` |
| `public.invoices` | `payment_event_id` | text/null | nach Zahlung | bindet `PAYMENT_CONFIRMED_V1` | Accounting | `F15A` |
| `public.invoices` | `payment_correlation_id` | uuid/null | nach Zahlung | Korrelation | Accounting | `F15A` |
| `public.invoices` | `payment_version` | integer | ja | ab 0 monoton | Accounting | `F15A` |
| `public.orders` | `payment_mode` | text | ja | Ist-Default `vorkasse`; Soll-Regel OE-2609-07/11 | G04, fachlicher Vertrag Accounting | `F15B` |
| `public.orders` | `payment_mode_version` | integer | ja | ab 0 monoton; nach Ausgang unveränderlich | G04/Accounting | `F15B` |
| `public.company_settings` | `invoice_vat_rate_basis_points` | integer | ja | Ist 700/1900, Default 1900; Kreile-Soll nur 1900 | G10 | `F14` — UMBau A-G07-006 |
| `public.company_settings` | `invoice_payment_term_days` | integer/null | im Ist optional | Ist 1–365; Kreile-Soll 14 nur bei Zielrechnung | G10 | `F14` — UMBau Q-G07-006 |
| `private.invoice_number_sequences` | `tenant_id` | text | ja | PK-Teil, serverseitig | Accounting | `F14` |
| `private.invoice_number_sequences` | `invoice_year` | integer | ja | PK-Teil, Jahr Europe/Berlin | Accounting | `F14` |
| `private.invoice_number_sequences` | `last_number` | integer | ja | monoton, transaktional | Accounting | `F14` |
| `private.invoice_number_sequences` | `updated_at` | timestamptz | ja | DB-Zeit | Accounting | `F14` |
| `public.events` | `event_type, client_event_id, event_schema_version, correlation_id, aggregate_version` | text/uuid/int | bei G07-Event | Event-spezifische Checks und Unique-Indizes | G01 Event-Infrastruktur; Accounting Payload | `F14`, `F15A`, `F15B`, `F15V2` |
| `public.events` | `tenant_id, order_id, user_id, occurred_at/created_at, payload` | gemischt | bei G07-Event | Tenant-/Actor-/Order-Bindung und Shape-Checks | G01/G04/Accounting | `F14`, `F15A`, `F15B`, `F15V2` |
| `CustomerBillingProfile` (Port-Soll) | `targetInvoiceAllowed` | boolean | ja für Zielrechnung | nur Admin/Rolf änderbar; default false | G05 | fehlt → Q-G07-003 |
| `CustomerBillingProfile` (Port-Soll) | `version, changedBy, changedAt, receiptId` | int/uuid/time/text | bei Änderung | Version/Audit/Readback | G05/G01 | fehlt → Q-G07-003 |
| `ZUGFeRD-Vertrag` (Soll) | Profil/Version, XML-Bytes/-Hash, Validator-Receipt | festzulegen | vor Live | unveränderlich, snapshotgleich, extern validiert | Accounting | fehlt → Q-G07-001/Q-G07-007 |
| `RetentionPolicyPort` (Soll) | `documentType, legalFloorYears, suspensionState, reviewAt` | versionierter Porttyp | vor Prüfung | Rechnung/Buchungsbeleg mindestens 8 Jahre plus Ablaufhemmung | G10 | fehlt → Q-G07-009 |
| `RetentionApproval` (Soll) | `proposalId, actorId, reason, scope, approvedBy, approvedAt, receiptId` | versionierter Command-/Receipt-Typ | bei Vorschlag/Freigabe | keine stille Wirkung; Personenbezug weg, Geschäftszahlen und Audit-Receipt bleiben; Originalbehandlung offen | G01/G10 | fehlt → Q-G07-009 |

### Soll-Ist-Befund

- `public.invoices` ist die aktive Wahrheit; die F1.4/F1.5-Felder, Views und Commands sind vorhanden.
- Ist-Abweichung P0: `private.guard_f1_4_invoice_update` vergleicht beim Storno die Zahlungsfelder nur als „nicht verändert“, prüft aber nicht, ob `OLD`/`NEW` vollständig unbezahlt sind. A-G07-018 verlangt die zweite DB-Schicht.
- Ist-Abweichung: DB und Command erlauben 7/19 Prozent und 1–365 Tage; Kreile-Soll ist 19 Prozent sowie 14 Tage nur für freigeschaltete Zielrechnung.
- Ist-Abweichung: `rechnung` ist ein frei setzbarer Modus und `goods_out_allowed` leitet daraus direkt Freigabe ab; der Kundenfreigabe-Port fehlt.
- Ist-Abweichung: Für OE-2609-20 ist kein versionierter Retention-/Ablaufhemmungs-/Freigabe-Port belegt; unveränderliche Rechnungen dürfen bis Q-G07-009 weder gelöscht noch umgeschrieben werden.
- `src/db/schema.ts` (`payments`) und `src/db/schema_buchhaltung.ts` (`ausgangsrechnung`, `zahlung`, `erechnung_xml`) sind keine G07-Wahrheit und dürfen weder als Migration noch als Fallback verwendet werden.
- Eingangsbeleg-Exports in `src/app/buchhaltung/actions.ts` lesen nicht `public.invoices` und erfüllen A-G07-024 nicht.

## 5. Manifest und Handshake

| Artefakt | Pfad | SHA-256 (12) | Stand | Entscheidung |
|---|---|---|---|---|
| Modulmanifest (tatsächlicher Path-1-Vertrag) | `src/modules/accounting/accounting.manifest.json` | `7EE97CA50867` | vorhanden, aber nur `AccountingEntry`; Capabilities/Events/Migrationen/Views leer | bleibt und wird im G07-Bau auf reale öffentliche Exporte, Views, Events und Migrationen aktualisiert |
| öffentliche UI-Fassade | `src/modules/accounting/public.ts` | `C13A20BD1EA4` | vorhanden | bleibt; keine Server-Commands in Client-Fassade ziehen |
| öffentliche Server-Fassade | `src/modules/accounting/server-public.ts` | — | fehlt | im bestehenden Accounting-Modul ergänzen; kein neues Modul |
| `capability.manifest.json` | kein Pfad im Repository | — | fehlt; Architektur verlangt stattdessen `<fach>.manifest.json` | keine zweite Manifest-Wahrheit anlegen; Capability im vorhandenen Manifest deklarieren |
| `INTEGRATION_HANDSHAKE.json` | kein Pfad im Repository | — | fehlt | keine neue Datei erfinden; Port-/Receipt-/Readback-Handshake in Fassade, Manifest und Tests belegen |

## 6. APIs/Provider

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Supabase/Postgres | serverseitiger tenantgebundener Transaktionszugriff; keine Data-API-Rechte für Client | `SUPABASE_SERVICE_ROLE_KEY` (Name, kein Wert) | vorhandene G07-Datenbasis; keine Remote-Prüfung in diesem Auftrag | Migration/RLS/Production-Write nur mit ausdrücklicher Freigabe |
| Interner PDF-Generator | kein externer Scope | keiner | echtes PDF für Rechnung/Storno gebaut | §14-/Steuerberater- und Live-Abnahme bleibt Gate |
| ZUGFeRD-Generator/Validator | festzulegen; Validator muss Profil-/Business-Regeln nachweisen | keiner festgelegt | FEHLT → Q-G07-001 | Profil, Tool/Provider, Kosten und neue Secrets vor Aktivierung freigeben |
| Ausgangs-CSV/DATEV-Datei | kein Provider; lokaler serverseitiger Formatierer | keiner | FEHLT → Q-G07-002 | Steuerberater muss Format/Golden File freigeben |
| Kartenterminal über M01 `PaymentAdapter` | serverseitige Terminal-/Payment-Rechte, idempotenter Statusreadback | in G07 keiner; nach Anbieterwahl in M01 festzulegen | `mollieAdapter.ts` ist Stub; Terminal fehlt | Vertrag, Kosten, Anbieter, Secrets und Provider-E2E benötigen Owner-Gate |

## 7. Übertragbarkeit

- Der Accounting-Kern kennt nur app-neutrale IDs, Geldbeträge in Cent, ISO-Zeit, Rechnungs-/Zahlungszustände, Commands, Events, Receipts und Ports.
- Kreile-spezifisch sind Tenant-Slug, Rollen-/Personenabbildung, deutsche UI-Texte, `R-`-Format, 19-Prozent-Regel, Zahlungsstandard, Firmen-/Bankdaten und Startseitenzuordnung; alles liegt im Kreile-HostAdapter oder in versionierter Kreile-Konfiguration.
- Provider-SDKs, URLs, Tokens und Payloads sind im Kern verboten. M01 implementiert später den `PaymentAdapter`; G07 übernimmt nur verifizierte app-neutrale Ergebnisse.
- Daten, Secrets, Konten, Sessions und Ressourcen anderer Zielapps sind weder Testquelle noch Fallback. Deren Anpassungen gehören ausschließlich in deren eigene HostAdapter.
- Aufbewahrungslogik bleibt app-neutral über Dokumentart, Frist, Ablaufhemmung, Vorschlag und Freigabe; die Kreile-Fristwerte und Zuständigkeiten liefert ausschließlich der Kreile-HostAdapter/G10.
