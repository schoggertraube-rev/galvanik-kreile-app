<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Schnittstellen und Daten

## 1. Angebotene Ports

G02 ist App-Komposition und bietet **keinen fachlichen Public-Port** an. Es gibt kein neues `src/modules/g02`, keine G02-Tabelle und keinen G02-Eventstore.

Die UI bietet ausschließlich folgende lokale Adapteraktionen:

| Adapteraktion | Vertrag | Besitzer der Wirkung |
|---|---|---|
| `openOrder(orderId)` | autorisierter Deep-Link/Overlay zur kanonischen Auftragskarte | G04 Orders |
| `openCustomer(customerId)` | autorisierter Deep-Link zur kanonischen Kundenkarte | G05 Customers |
| `openInvoice(invoiceId)` | autorisierter Deep-Link zur kanonischen Rechnung | G07 Accounting-minimal |
| `requestGlobalCreate(kind?)` | öffnet den bestehenden globalen Anlegefluss | G03 Intake |
| `navigateAuthorized(href)` | navigiert nur zu serverseitig freigegebenem Ziel | G01 + jeweiliges Besitzermodul |

Diese Aktionen sind keine Domain-Commands. Ein schreibender Vorgang beginnt erst im Besitzer-Modul und muss dort Receipt und Readback liefern.

## 2. Benötigte Host-Ports

| Host-Port | Muss liefern | Fail-closed-Verhalten |
|---|---|---|
| `AuthorizationPort` | `userId`, Tenant, aktive Identität, Anzeigename, effektive Capabilities | Redirect `/start` nur bei fehlender/ungültiger Sitzung; sonst sicherer Halt ohne Daten. |
| `OrdersHomeReadPort` | autorisierte Auftragsprojektion, Priorität, Frist, Station, Kunde kurz, Quelle, Aktualität, Abdeckung | Teilansicht Fehler; keine Demo-/Legacy-Queue und kein stiller Fallback. |
| `WerkstattHomeReadPort` | Wareneingang, Galvanik-WIP, SQL-KPI-Snapshot, Bündelungsfakten | `empty`, `denied`, `conflict` oder `error`; niemals lokale Ersatz-KPI. |
| `ConflictFeedPort` | G09 `ConflictFeedV1` vollständig mit Zuständigkeit, Anzeigezustand, Aktion und Quellstatus | Fehlquelle als `partial/error`; keine Aussage „konfliktfrei“. |
| `CalendarPort.readProjectionV1` | Verbindung/Health, Synchronstand, Auftragstermine, Betriebstermine, Abwesenheiten, Personen-/Ressourcenbezug, App-Objektlink | „Kalenderabgleich — In Aufbau“ vor Transfergate; danach Teilfehlerstatus, kein Ersatzprovider. |
| `UrgentAnalysisReadPort` | nur dringende Warnungen/Entscheidungen mit Besitzerobjekt, Quelle und Aktualität | Keine Karte und keine Route vor M02-Transfergate; niemals KPI-Ersatz. |
| `ResumeCasesReadPort` | persistierte offene D-RES-Fälle mit Besitzerobjekt, Korrelation und Zuständigkeit | „Wiederaufnahme — In Aufbau“; keinen Ausgang raten. |
| `RoutingPort` | autorisierte Deep-Links zu Auftrag, Kunde, Rechnung und Einstellungen | Karte ohne Aktion, wenn ein sicherer Link fehlt. |
| `ClockPort` | `now` und `Europe/Berlin` | Keine lokale Frist-/Kalenderklassifikation bei ungültiger Zeitquelle. |

Der Kreile-HostAdapter verdrahtet diese Ports. App-neutrale Komponenten dürfen weder Kreile-Personennamen noch Fachrouten oder Provider kennen.

## 3. Events, Commands und Readback

| Vorgang | G02-Verhalten | Besitzervertrag |
|---|---|---|
| Startseite lesen | keine Mutation, kein Event | öffentliche serverseitige Read-Ports |
| Auftrag/Kunde/Rechnung öffnen | autorisierter Deep-Link | jeweiliges Fachmodul |
| Konflikt auflösen | G02 öffnet das Objekt; keine lokale `resolve`-Mutation | G09-Regel + Command/Receipt des Besitzermoduls |
| Termin ändern | G02 öffnet den Auftrag | G04 `rescheduleOrderCommand` nach G09-Vertrag; M04 projiziert erst nach Domain-Receipt |
| Unklaren Ausgang prüfen | G02 öffnet den persistierten Wiederaufnahmefall | Besitzer-Receipt und Readback gemäß D-RES-001 |
| Auftragstermin projizieren | keine direkte Aktion aus G02 | `CalendarPort.projectOrderAppointmentV1` mit stabiler Korrelation |

G02 emittiert und konsumiert keine Domain-Events. Es liest Projektionen nach Navigation/Rückkehr neu. Der alte Warning-Store mit `resolve`, `snooze` oder freier Delegation darf nicht importiert werden.

## 4. Datenmodell-Feldliste und Soll-Ist-Abgleich

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| Autorisierung | `userId` | UUID | ja | aktive Kreile-Person, Session und DB stimmen überein | G01 Fundament | `public.app_users.id`; `src/db/schema.ts` |
| Autorisierung | `tenantId` | text | ja | exakt `galvanik-kreile`, serverseitig gebunden | G01 Fundament | `public.app_users.tenant_id`; `src/db/schema.ts` |
| Autorisierung | `displayName` | text | ja | aus DB, kein UI-Fallback | G01 Fundament | `public.app_users.full_name`; `src/db/schema.ts` |
| Autorisierung | `role`, `permissions`, `active` | text/array/bool | ja | Rolle validiert; effektive Capabilities maßgeblich | G01 Fundament | Rolle/aktiv in `public.app_users`; Permissions derzeit Codevertrag `authorizationContract` |
| Startseitenprojektion | `source` | text | ja | Name des Besitzer-Read-Ports | jeweiliger Besitzer | Runtime DTO vorhanden bei Orders/Werkstatt; keine Tabelle |
| Startseitenprojektion | `loadedAt` | ISO-8601 | ja | tatsächlicher Read-Zeitpunkt | jeweiliger Besitzer | Runtime DTO vorhanden bei Orders/Werkstatt; keine Tabelle |
| Startseitenprojektion | `completeness` / `failedSources` | enum/array | ja bei Komposition | `complete` oder `partial`; Fehler nicht verschweigen | G09/HostAdapter | G09-SPEZ; im IST-Code für Gesamtstartseite **fehlt** |
| Auftrag | `id`, `tenant_id`, `version` | text/text/int | ja | Tenantbindung; Version > 0 | G04 Orders | `public.orders`; `src/db/schema.ts` |
| Auftrag | `order_number`, `customer_id` | text/text | ja | Auftragsnummer eindeutig; Kunde tenantkonsistent | G04/G05 | `public.orders`; private operative View |
| Auftrag | `title`, `task` | text | ja/nein | nur aus kanonischem Auftrag | G04 Orders | `public.orders`; `src/db/schema.ts` |
| Auftrag | `station`, `current_station`, `current_station_id`, `status` | text | ja | kanonischer Lifecycle, keine UI-Ableitung | G04 Orders | `public.orders`; private `v_operational_station_queue_v1` |
| Auftrag | `risk`, `due_date`, `created_at` | text/time/time | nein/ja | keine Frist schätzen; Priorität aus Besitzerprojektion | G04 Orders | operative View `v_operational_station_queue_v1` |
| Auftrag | `customer_name` | text | nein | nur Kurzlabel, tenantkonsistenter Join | G05 Customers | private `v_operational_station_queue_v1` |
| Teil | `name`, `quantity`, `surface_requested`, `material` | text/int/text/text | je Vorgang | nur integritätsgeprüfte Kinder desselben Tenants/Auftrags | G03/G04 | `public.items`; operative View |
| Werkstatt-KPI | `wip_count`, `due_this_week_count` | integer | ja | aus SQL-View, nicht in TypeScript neu zählen | Werkstatt/G04 | `public.v_werkstatt_kpis_v1` |
| Konfliktfeed | `generatedAt`, `completeness`, `failedSources` | ISO-8601/enum/array | ja | G09 V1, flüchtige Projektion | G09/Fundament | keine Tabelle; G09-Vertrag `ConflictFeedV1` |
| Konfliktkarte | `key`, `kind`, `severity`, `displayState`, `sourceModule` | text/enum | ja | nach stabilem `key` dedupliziert | G09 + Besitzer | keine Tabelle; G09-Vertrag `ConflictItemV1` |
| Konfliktkarte | `entityType`, `entityId`, `orderNumber`, `customerShortName` | text | ja/optional | auf kanonisches Besitzerobjekt bezogen | G09 + Besitzer | teilweise in Orders/Customers; Gesamt-DTO **fehlt** |
| Konfliktkarte | `title`, `reason`, `effect`, `dueAt` | text/time | ja/optional | vom Besitzer/HostAdapter, keine G02-Neuberechnung | G09 + Besitzer | Runtime DTO **fehlt** |
| Konfliktkarte | `responsibility`, `sourceUpdatedAt`, `expectedVersion`, `correlationId`, `action` | object/time/int/UUID/object | ja/optional | Zuständigkeit und sichere Aktion vollständig | G09 + Besitzer | Runtime DTO **fehlt** |
| Kalenderprojektion | `connectionState`, `lastSync`, `completeness` | enum/time/enum | ja | Providerstatus getrennt von Fachkonflikt | M04 Calendar | **fehlt**; kein Zielvertrag im Schema |
| Kalendereintrag | `providerEventId`, `kind`, `startsAt`, `endsAt`, `timezone` | text/enum/time | ja | Outlook-Projektion, `Europe/Berlin`, keine Schätzung | M04 Calendar | **fehlt**; `src/db/schema.ts::calendar_events` ist Legacy, nicht verwenden |
| Kalendereintrag | `orderId`, `orderNumber`, `customerShortName`, `personOrResource`, `appHref` | text | nach Art | Klick führt zum App-Objekt, nicht zum Kalender | M04 + G04/G05 | **fehlt** im M04-Vertrag |
| Abwesenheit | `personRef`, `kind`, `startsAt`, `endsAt` | text/enum/time | ja | read-only aus Kreile-Büropostfach | M04 Calendar | **fehlt** |
| Analysehinweis | `id`, `kind`, `urgent`, `title`, `reason`, `entityRef`, `sourceUpdatedAt` | text/bool/time | ja | nur `urgent = true` auf Startseite | M02 Analyse | **fehlt**; erst nach M02-Abnahme |
| Wiederaufnahmefall | `caseId`, `ownerModule`, `entityRef`, `correlationId`, `state`, `updatedAt` | text/UUID/enum/time | ja | persistiert beim Besitzer; nie in G02 | jeweiliger Besitzer/G09 | Teilfakten in Events/Receipts; gemeinsamer Read-Port **fehlt** |

`public.calendar_events` in `src/db/schema.ts` ist Legacy-Inventar und keine zulässige Kalender-Zielwahrheit. G02 greift darauf nicht direkt zu.

## 5. Manifest und Handshake

| Artefakt | Pfad | SHA-256 (12) | Bewertung |
|---|---|---|---|
| Werkstatt-Manifest | `src/modules/werkstatt/werkstatt.manifest.json` | `8ddfaacdb0fe` | vorhanden; öffentliche Werkstatt-Typen/Ansicht, keine eigenen Tabellen oder Events |
| Orders-Manifest | `src/modules/orders/orders.manifest.json` | `ed89e729f100` | vorhanden; Home-Projektion öffentlich, keine G09-/M04-Ports deklariert |
| G02-Manifest | — | — | absichtlich keines: G02 ist App-Komposition, kein Datenbesitzermodul |
| `capability.manifest.json` für G02 | — | — | nicht anlegen; effektive Capabilities kommen aus G01 |
| `INTEGRATION_HANDSHAKE.json` M04 | — | — | fehlt; M04-Anbindung bleibt „In Aufbau“ bis Provider-E2E und Transfergate |
| `INTEGRATION_HANDSHAKE.json` M02 | — | — | fehlt; M02-Menü und Feed bleiben vollständig absent |

Inkompatible DTO-Änderungen erhalten eine neue Version; keine stille Feldumdeutung.

## 6. APIs/Provider

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Supabase/Postgres/Auth | nur bestehende serverseitige tenant- und capabilitygebundene Read-/Command-Pfade; kein Browser-Direktzugriff | keine neuen G02-Secrets; bestehende Infrastruktur-Namen verbleiben bei G01 | REAL im Bestand; Remote-Aktualität nicht in diesem Auftrag verifiziert | Keine Remote-Migration, RLS-Änderung oder Echtdatenänderung ohne ausdrückliche Freigabe. |
| Microsoft 365 Graph | durch M04 festzulegendes Least Privilege zum Lesen des benannten Kreile-Bürokalenders und Schreiben von Auftragsterminen | keine G02-Secrets; kanonische Namen fehlen → M04-Handshake | PENDING / `M365_NOT_CONNECTED` | Konto, Consent, Tokenablage, Rechte, Datenschutz und Provider-E2E nur im M04-Auftrag mit Owner-Freigabe. |
| M02 Analyseadapter | öffentlicher dringender Read-Port, kein direkter Providerzugriff | keine G02-Secrets | PENDING | Route/Feed erst nach M02-Abnahme und Transfergate; vorher vollständig absent. |
| Vercel | Hosting ohne Fach- oder Kalenderrechte | keine G02-Secrets | REAL_HOSTING_ONLY | Kein Preview oder Deployment aus diesem Dossierauftrag. |

## 7. Übertragbarkeit

- Der Kern verwendet generische Identität, Capability, Navigation, `ConflictItemV1`, Quellstatus und Geräteschwellen.
- Kreile-Personen (`rolf`, `phillip`, `gregor`), Kreile-Menü, Texte, Routen, Tenantbindung und Portverdrahtung liegen im Kreile-HostAdapter.
- Der Kern importiert weder Kreile-Fachbegriffe noch Supabase-, Graph- oder Analyse-Clients.
- Anpassungen anderer Zielapps gehören ausschließlich in deren eigenen HostAdapter und sind nicht Teil dieses Dossiers.
