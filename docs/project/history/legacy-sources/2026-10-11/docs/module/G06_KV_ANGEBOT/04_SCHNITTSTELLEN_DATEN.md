<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G06 KV / Angebot — Schnittstellen und Daten

## 1. Angebotene Ports

| Port/Fassade | Operationen | Vertrag | Ist-Pfad | Stand |
|---|---|---|---|---|
| Client-Typfassade | `CreateQuoteInput`, `UpdateQuoteInput`, `ConvertQuoteInput`, Readbacks und Receipts | Providerfreie Typen für UI/Host | `src/modules/quotes/public.ts` | GEBAUT |
| Server-Fassade | Create, Update, Prepare Conversion, Read/List und Receipt-Reads | Einziger erlaubter Serverimport des Moduls | `src/modules/quotes/server-public.ts` | GEBAUT |
| `createQuoteCommand` | KV atomar anlegen | Tenant, Capability, UUID, 1–20 Positionen, Idempotenz | `src/modules/quotes/server/quoteCommands.ts` | GEBAUT |
| `updateQuoteCommand` | offenen KV versioniert ändern | `expectedVersion`, append-only Positionen, Receipt | `src/modules/quotes/server/quoteCommands.ts` | GEBAUT |
| `readQuoteCommand` | einen KV lesen | tenantgebundener fachlicher Readback | `src/modules/quotes/server/quoteReads.ts` | GEBAUT |
| `listOpenQuotesCommand` | offene KVs lesen | nur `draft`, maximal 100, aktueller Tenant | `src/modules/quotes/server/quoteReads.ts` | GEBAUT |
| `prepareQuoteConversionCommand` | Auftragseingabe aus KV vorbereiten | bestätigt Zuschlag, sperrt Quote-Absicht und Version | `src/modules/quotes/server/quoteCommands.ts` | GEBAUT |
| Receipt-Reads | Create-/Update-/Conversion-Ausgang klären | gleiche Tenant-/Actor-/Client-Event-Bindung | `src/modules/quotes/server/quoteCommands.ts` | GEBAUT |

Die Next.js-Actions in `src/app/actions/quotes.actions.ts` sind Kreile-Komposition, nicht Bestandteil des app-neutralen Kerns. `convertQuoteToOrderAction` orchestriert den bestehenden G04/F1.1-Port und bestätigt Erfolg erst nach Order- und Quote-Readback.

## 2. Benötigte Host-Ports

| Host-Port | Liefert | Besitzer | Fehlervertrag | Stand |
|---|---|---|---|---|
| `host.authorization-context` | `tenantId`, `userId`, `canCreateQuote`, `canReadQuote`, `canUpdateQuote`, `canConvertQuote` | G01/G10 | kein Kontext/Recht → fail-closed | GEBAUT, auf Personenrechte umzubauen |
| `host.customers.list/read/create` | tenantgebundene Kundenauswahl und sichere Kundenanlage | G05 | `DENIED`, `UNAVAILABLE`, Receipt+Readback | GEBAUT |
| `host.orders.create-intake` | genau einen F1.1-Auftrag aus bestätigtem KV | G04 | idempotentes `clientEventId`, Receipt+Readback | GEBAUT |
| `host.orders.open` | Navigation zur echten Auftragskarte | G04/G08 | fehlender Auftrag → fail-closed | GEBAUT |
| `host.customers.open` | Navigation zur echten Kundenkarte | G05/G08 | fehlender Kunde → fail-closed | GEBAUT |
| `host.quote-draft-memory` | ausschließlich zuletzt offenen `quoteId` im Browser merken | G03 Kreile-HostAdapter | nur ID, keine Fachdaten; Verlust ist unschädlich | GEBAUT (`sessionStorage`) |
| `host.orders.reusable-items` | reale frühere Positionen mit Herkunft für bewusste Übernahme | G04/G05 | Ausfall lässt manuelle Eingabe aktiv; kein Fake | GEPLANT |
| `host.order-award-details` | geklärter Vertrag für Zahlungsart, Eingangs-/Erfüllungsart und Express | G04/G07 | bis Q-G06-001 fail-closed/gesperrt | FEHLT |
| `host.quote-document` | unveränderlicher Dokumentstand, Hash und Readback | G06/G07 nach PL-Entscheid | bis Q-G06-002 kein aktiver Knopf | FEHLT |
| `host.quote-send` | menschlich bestätigter Versand und Versand-Receipt | M05 | bis M05-Owner-Gate kein Provider-Aufruf | FEHLT |
| `host.conflict-projection` | ungelöste KV-Konflikte mit Deep-Link zu Rolf | G09/G02 | Projektion darf KV nicht verändern | GEPLANT |

## 3. Events

| Event | Richtung | Version | Auslöser/Nutzlast | Besitzer | Stand |
|---|---|---|---|---|---|
| `QUOTE_CREATED_V1` | emittiert | 1 | KV angelegt; `quoteId`, `customerId`, `intentSha256` | G06 | GEBAUT |
| `QUOTE_UPDATED_V1` | emittiert | 1 | KV geändert; `quoteId`, `intentSha256`, Aggregate-Version | G06 | GEBAUT |
| `QUOTE_AWARDED_V1` | emittiert | 1 | Conversion finalisiert; `quoteId`, `orderId`, `intentSha256` | G06 | GEBAUT |
| `ORDER_INTAKE_CREATED_V1` | konsumiert | 1 | erfolgreicher bestehender F1.1-Auftrag finalisiert KV und Receipt im selben Transaktionskontext | G04 | GEBAUT |
| Dokument erzeugt | geplant | offen | unveränderliche KV-Version + Hash | Q-G06-002 | FEHLT |
| KV versendet | geplant | offen | Dokument-ID, Empfänger, Provider-Receipt, Zeitpunkt | M05/Q-G06-003 | FEHLT |

Es wird kein neues Event erfunden, bevor sein Besitzer und Schema in Q-G06-002/-003 geklärt sind.

## 4. Datenmodell-Feldliste

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| `private.quote_number_counters` | `tenant_id` | text | ja | getrimmt, 1–50; PK mit Jahr | G06 | `20260914110000_path1_quote_persistence_contract.sql` |
| `private.quote_number_counters` | `number_year` | integer | ja | 2000–9999; PK mit Tenant | G06 | dito |
| `private.quote_number_counters` | `last_value` | bigint | ja | ≥0; atomisches Upsert/Inkrement | G06 | dito |
| `private.quotes` | `id` | uuid | ja | PK, generiert; Unique mit Tenant | G06 | dito |
| `private.quotes` | `tenant_id` | text | ja | Tenantbindung; Bestandteil aller Fach-FKs | G06 | dito |
| `private.quotes` | `quote_number` | text | ja | `^KV-[0-9]{4}-[0-9]{4,}$`; je Tenant unique | G06 | dito |
| `private.quotes` | `customer_id` | text | ja | FK `(tenant_id,id)` auf `public.customers`, RESTRICT | G06 | dito |
| `private.quotes` | `status` | text | ja | `draft` oder `converted` | G06 | beide Quotes-Migrationen |
| `private.quotes` | `version` | integer | ja | `draft` ≥1; `converted` ≥2 | G06 | `20260916090000_path1_quote_product_lifecycle.sql` |
| `private.quotes` | `currency` | text | ja | exakt `EUR` | G06 | `20260914110000…` |
| `private.quotes` | `due_date` | date | ja | Kunden-Wunschtermin; ISO-Datum | G06 | dito |
| `private.quotes` | `note` | text/null | nein | maximal 2000 Zeichen im Command | G06 | dito; Command-Validierung |
| `private.quotes` | `total_net_cents` | bigint | ja | ≥0; Summe gespeicherter Zeilen | G06 | dito |
| `private.quotes` | `linked_order_id` | text/null | nein | Tenant-FK auf `public.orders`; nur bei `converted` | G06 | dito |
| `private.quotes` | `created_by` | uuid | ja | FK auf `public.app_users`, RESTRICT | G06 | dito |
| `private.quotes` | `created_at` | timestamptz | ja | DB-Zeit | G06 | dito |
| `private.quotes` | `updated_by` | uuid | ja | FK auf `public.app_users`; bei Create vorbelegt | G06 | `20260916090000…` |
| `private.quotes` | `updated_at` | timestamptz | ja | DB-Zeit, bei Create vorbelegt | G06 | dito |
| `private.quotes` | `converted_at` | timestamptz/null | nein | nur bei `converted` und Link gesetzt | G06 | `20260914110000…` |
| `private.quote_positions` | `id` | uuid | ja | PK, generiert | G06 | `20260914110000…` |
| `private.quote_positions` | `tenant_id` | text | ja | FK-Bestandteil | G06 | dito |
| `private.quote_positions` | `quote_id` | uuid | ja | Tenant-FK auf `private.quotes`, RESTRICT | G06 | dito |
| `private.quote_positions` | `revision` | integer | ja | ≥1; Teil des Unique-Schlüssels | G06 | `20260916090000…` |
| `private.quote_positions` | `position` | integer | ja | 1–20; unique je Quote/Revision | G06 | beide Quotes-Migrationen |
| `private.quote_positions` | `name` | text | ja | getrimmt, 2–160 | G06 | `20260914110000…` |
| `private.quote_positions` | `quantity` | integer | ja | 1–1.000.000 | G06 | dito |
| `private.quote_positions` | `material` | text/null | nein | getrimmt, 1–120 wenn gesetzt | G06 | dito |
| `private.quote_positions` | `surface_requested` | text | ja | getrimmt, 2–160 | G06 | dito |
| `private.quote_positions` | `unit_price_cents` | bigint | ja | 0–999.999.999 | G06 | dito |
| `private.quote_positions` | `line_total_cents` | bigint generated | ja | `quantity * unit_price_cents` | G06 | dito |
| `private.quote_create_receipts` | `id` | uuid | ja | PK/Receipt-ID | G06 | `20260914110000…` |
| `private.quote_create_receipts` | `event_id` | text | ja | unique, FK `public.events` | G06 | dito |
| `private.quote_create_receipts` | `tenant_id` | text | ja | Teil aller Bindungen | G06 | dito |
| `private.quote_create_receipts` | `quote_id` | uuid | ja | Tenant-FK Quote | G06 | dito |
| `private.quote_create_receipts` | `customer_id` | text | ja | Tenant-FK Customer | G06 | dito |
| `private.quote_create_receipts` | `actor_id` | uuid | ja | FK App-User | G06 | dito |
| `private.quote_create_receipts` | `client_event_id` | uuid | ja | unique je Tenant/Actor | G06 | dito |
| `private.quote_create_receipts` | `correlation_id` | uuid | ja | Korrelation zum Event | G06 | dito |
| `private.quote_create_receipts` | `intent_sha256` | text | ja | 64 Kleinhex-Zeichen | G06 | dito |
| `private.quote_create_receipts` | `created_at` | timestamptz | ja | DB-Zeit | G06 | dito |
| `private.quote_update_receipts` | `id` | uuid | ja | PK/Receipt-ID | G06 | `20260916090000…` |
| `private.quote_update_receipts` | `event_id` | text | ja | unique, FK `public.events` | G06 | dito |
| `private.quote_update_receipts` | `tenant_id` | text | ja | Tenantbindung | G06 | dito |
| `private.quote_update_receipts` | `quote_id` | uuid | ja | Tenant-FK Quote | G06 | dito |
| `private.quote_update_receipts` | `actor_id` | uuid | ja | FK App-User | G06 | dito |
| `private.quote_update_receipts` | `client_event_id` | uuid | ja | unique je Tenant/Actor | G06 | dito |
| `private.quote_update_receipts` | `correlation_id` | uuid | ja | Korrelation zum Event | G06 | dito |
| `private.quote_update_receipts` | `intent_sha256` | text | ja | 64 Kleinhex-Zeichen | G06 | dito |
| `private.quote_update_receipts` | `expected_version` | integer | ja | ≥1 | G06 | dito |
| `private.quote_update_receipts` | `aggregate_version` | integer | ja | `expected_version + 1` | G06 | dito |
| `private.quote_update_receipts` | `created_at` | timestamptz | ja | DB-Zeit | G06 | dito |
| `private.quote_conversion_requests` | `id` | uuid | ja | PK | G06 | `20260914110000…` |
| `private.quote_conversion_requests` | `tenant_id` | text | ja | Tenantbindung | G06 | dito |
| `private.quote_conversion_requests` | `quote_id` | uuid | ja | je Tenant/Quote unique | G06 | beide Quotes-Migrationen |
| `private.quote_conversion_requests` | `actor_id` | uuid | ja | FK App-User | G06 | `20260914110000…` |
| `private.quote_conversion_requests` | `client_event_id` | uuid | ja | unique je Tenant/Actor | G06 | dito |
| `private.quote_conversion_requests` | `intent_sha256` | text | ja | Hash der Conversion-Absicht | G06 | dito |
| `private.quote_conversion_requests` | `order_intent_sha256` | text | ja | Hash der F1.1-Auftragseingabe | G06 | dito |
| `private.quote_conversion_requests` | `expected_version` | integer | ja | ≥1 | G06 | `20260916090000…` |
| `private.quote_conversion_requests` | `event_id` | text | ja | für Award-Event reserviert, unique | G06 | `20260914110000…` |
| `private.quote_conversion_requests` | `award_client_event_id` | uuid | ja | separate idempotente Award-Kennung, unique | G06 | dito |
| `private.quote_conversion_requests` | `receipt_id` | uuid | ja | reservierte Conversion-Receipt, unique | G06 | dito |
| `private.quote_conversion_requests` | `correlation_id` | uuid | ja | je Tenant unique | G06 | dito |
| `private.quote_conversion_requests` | `created_at` | timestamptz | ja | DB-Zeit | G06 | dito |
| `private.quote_conversion_receipts` | `id` | uuid | ja | PK; aus Conversion-Request | G06 | `20260914110000…` |
| `private.quote_conversion_receipts` | `event_id` | text | ja | Award-Event, unique | G06 | dito |
| `private.quote_conversion_receipts` | `tenant_id` | text | ja | Tenantbindung | G06 | dito |
| `private.quote_conversion_receipts` | `quote_id` | uuid | ja | je Tenant/Quote unique | G06 | dito |
| `private.quote_conversion_receipts` | `customer_id` | text | ja | Tenant-FK Customer | G06 | dito |
| `private.quote_conversion_receipts` | `order_id` | text | ja | je Tenant/Order unique; FK Order | G06 | dito |
| `private.quote_conversion_receipts` | `order_intake_event_id` | text | ja | FK auf F1.1-Event | G06 | dito |
| `private.quote_conversion_receipts` | `order_intent_sha256` | text | ja | entspricht vorbereitetem Order-Hash | G06 | dito |
| `private.quote_conversion_receipts` | `actor_id` | uuid | ja | FK App-User | G06 | dito |
| `private.quote_conversion_receipts` | `client_event_id` | uuid | ja | ursprüngliche Conversion-Kennung | G06 | dito |
| `private.quote_conversion_receipts` | `award_client_event_id` | uuid | ja | F1.1/Award-Kennung | G06 | dito |
| `private.quote_conversion_receipts` | `correlation_id` | uuid | ja | Ende-zu-Ende-Korrelation | G06 | dito |
| `private.quote_conversion_receipts` | `intent_sha256` | text | ja | Hash der Conversion-Absicht | G06 | dito |
| `private.quote_conversion_receipts` | `quote_version` | integer | ja | ≥2 nach Zuschlag | G06 | `20260916090000…` |
| `private.quote_conversion_receipts` | `created_at` | timestamptz | ja | DB-Zeit | G06 | `20260914110000…` |
| `public.customers` | `(tenant_id,id)` | text + text | ja | nur referenziert; keine G06-Schreibwahrheit | G05 | Customer-Migrationen, Fremdbesitz |
| `public.orders` | `(tenant_id,id)` | text + text | ja nach Conversion | nur über F1.1-Command; keine direkte G06-Anlage | G04 | Order-Migrationen, Fremdbesitz |
| `public.events` | Quote-/Order-Events | Event-Vertrag | ja | append-only; Schema-Version 1; Tenant/Korrelation | G01/G04/G06 je Event | Quotes-Migrationen erweitern Check-Constraint |
| `public.app_users` | `id` | uuid | ja | Actor-FK; keine Rollenlogik im G06-Kern | G01 | Fremdbesitz |
| Soll: Auftragsdetails | Zahlungsart/Erfüllungsart/Express | offen | erst nach Gate | keine Schattenfelder in `private.quotes` | G04/G07 | FEHLT → Q-G06-001 |
| Soll: KV-Dokument | Snapshot/Version/Hash | offen | erst nach Gate | unveränderlich und readbackfähig | noch festzulegen | FEHLT → Q-G06-002 |
| Soll: Versandnachweis | Empfänger/Provider-Receipt/Zeit | offen | erst nach Gate | idempotent, tenantgebunden, kein Fallback | M05 | FEHLT → Q-G06-003 |

### Soll-Ist-Fazit

Der persistente KV-, Versions- und Conversion-Kern ist im Schema vollständig vorhanden. Nicht vorhanden und deshalb nicht zu erfinden sind Auftrags-Zusatzdetails aus dem V5-Mock, ein unveränderlicher KV-Dokumentstand und ein Versandnachweis. Für schnelle Wiederverwendung ist kein neues G06-Schema nötig; sie liest echte Fremddaten über einen Host-Port und speichert bestätigte Werte anschließend als normale KV-Revision.

## 5. Manifest und Integrationshandshake

| Artefakt | Pfad | SHA-256 (12) | Einordnung |
|---|---|---|---|
| Modulmanifest | `src/modules/quotes/quotes.manifest.json` | `83B48043CD95` | GÜLTIG; nennt Exporte, Capabilities, Migrationen, Tabellen, Events und Abhängigkeiten |
| `capability.manifest.json` | nicht vorhanden | — | Für den adoptierten Grundstamm kein zweites Manifest anlegen; `quotes.manifest.json` ist die bestehende Wahrheit. |
| `INTEGRATION_HANDSHAKE.json` | nicht vorhanden | — | Die Adoption ist bereits durch öffentliche Fassaden, Manifest und `GlobalCreateAppAdapter` typisiert; kein off-repo Transferhandshake erforderlich. |

Bei einer späteren Herauslösung darf ein Transferformat nur aus dem bestehenden Manifest generiert beziehungsweise als dessen Nachfolger ratifiziert werden; kein paralleles Schattenmanifest.

## 6. APIs und Provider

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Supabase/PostgreSQL | tenantgebundene private Funktionen/Views; serverseitig privilegierte Transaktion | — (G06 besitzt kein Provider-Secret) | GEBAUT, lokal belegt; keine Remote-Migration in diesem Auftrag | Remote-Migration/RLS nur nach ausdrücklicher Freigabe |
| Microsoft Graph über M05 | offen; minimaler Versand-Scope wird im M05-Vertrag festgelegt | — (Secret-Namen und Consent gehören ausschließlich M05) | FEHLT / nicht verbunden | Consent, Konto, Kosten und Secret-Anlage nur Owner am M365-Gate |
| OCR/KI | keine | — | nicht Teil von G06; kein Fallback | Kreile-Ressourcen nur für Kreile; separate Modul-Gates |

## 7. Übertragbarkeit

- Der Kern kennt Quote, Position, Version, Receipt und einen abstrakten `create-order`-Port; er kennt keine Kreile-Personen, Navigation, Zahlungsregeln oder Provider.
- Der Kreile-HostAdapter übersetzt G01-Rechte, G03-Dialog, G04-Auftrag, G05-Kunde, G07-Zahlungsstandard und G09-Konfliktprojektion.
- Kreile-Daten, Konten, Secrets und Ressourcen bleiben ausschließlich Kreile zugeordnet.
- Anpassungen anderer Zielapps werden in deren eigenem HostAdapter definiert und sind ausdrücklich nicht Teil dieses Dossiers.

