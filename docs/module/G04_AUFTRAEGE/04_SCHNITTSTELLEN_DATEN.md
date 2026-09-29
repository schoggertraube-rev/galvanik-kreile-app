<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G04 · Schnittstellen und Daten

## 1. Angebotene Ports

Alle Verträge werden über `src/modules/orders/public.ts` für browser-/domain-sichere Typen und `src/modules/orders/server-public.ts` für serverseitige Reads/Commands exportiert. `src/modules/orders/public.ts` ist vorhanden und zu erweitern; `src/modules/orders/server-public.ts` ist FEHLT.

| Port / Export | Richtung | Vertrag | Stand |
|---|---|---|---|
| `OrdersList` / `OrderQueueRow` / `OrderCardView` | G04 → Host-UI | Darstellungsbausteine ohne Datenzugriff und ohne Kreile-Providerlogik | GEBAUT; Designsystem-Umbau offen |
| `OrderLifecycleStatus` / `getNextOrderLifecycleStatus` | G04 → Verbraucher | `angenommen`, `galvanik`, `fertig`, `abgeholt`; invaliden Übergang ablehnen | GEBAUT |
| `getOrders(query)` | G04 → G02/G05/G08/G09/Host | Tenantgebundene summaries mit ID, Nummer, Kunde, Status, aktuellem Termin, nächster Handlung und Version | GEBAUT außerhalb der Zielfassade; in `src/modules/orders/server-public.ts` (FEHLT) zu kapseln |
| `getOrderCard(orderId)` | G04 → Host/G05/G07 | Detailread mit Teilen, Terminwahrheit, Fremdport-Referenzen, Verlauf und Version | GEBAUT außerhalb der Zielfassade; in `src/modules/orders/server-public.ts` (FEHLT) zu kapseln |
| `getOrderSchedule(range, view)` | G04 → G02/G09/M04/Host | Read-only Woche/Monat aus `due_date` und `pickup_due_date`, stabiler Deep-Link, `Europe/Berlin` | SPEZ |
| `getOrderTimelinessFacts(range)` | G04 → M02 | Bestätigter Termin, Fertigzeit, Abholzeit, Storno-Klassifikation, Provenienz/Missing-Reason | SPEZ |
| `createOrderIntake(input)` | Host/G06 → G04 | Kunde, bestätigter Termin, Teile, Notiz, `clientEventId`; Tenant/Akteur aus Session | GEBAUT |
| `advanceOrderLifecycle(input)` | Host/G09 → G04 | `orderId`, `expectedVersion`, Ziel als exakt nächster Zustand, `clientEventId` | GEBAUT |
| `changeOrderSchedule(input)` | Host/G09 → G04 | `orderId`, `expectedVersion`, genau eine Änderung `{kind, value}`, Pflichtgrund, `clientEventId` | SPEZ |
| `changeOrderExtraWork(input)` | Host/G09 → G04 | Teil, Katalog/Freitext, historisierter Stundensatz, Version, Anfragekennung | GEBAUT |
| `freezeOrder(input)` / `correctOrderFreeze(input)` | Host/G09 → G04 | Fertigmeldung bzw. Korrektur mit Grund, Receipt und Readback | GEBAUT |
| `recordOrderPickup(input)` | Host/G07/G09 → G04 | Abholung nach geltendem G07-Gate, Version und Anfragekennung | GEBAUT als V2-Command außerhalb der Zielfassade |

### Einheitliche Command-Antwort

`OK` enthält `receiptId`, `eventId`, `orderId`, `orderVersion`, `clientEventId`, `correlationId`, `occurredAt` und die fachlich geänderten Werte. Weitere Ergebnisse: `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `BLOCKED`, `UNAVAILABLE`, `AUSGANG_UNGEKLÄRT`. Nur `OK` nach Receipt+Readback darf einen Erfolgstoast auslösen.

## 2. Benötigte Host-Ports

| Host-Port | Besitzer | Minimaler Vertrag | Verhalten bei Fehlen |
|---|---|---|---|
| `identity.capabilities.read/v1` | G01 | Tenant, Person, erlaubte G04-Fähigkeiten; keine fest codierte Rollenmatrix | fail-closed `gesperrt` |
| `customers.summary.read/v1` | G05 | Kunden-ID, Kurzname, Ort, Deep-Link | Auftrag bleibt lesbar; Kundenblock zeigt Fehler, keine Kopie |
| `quotes.accepted-context.read/v1` | G06 | KV-ID, Wunschtermin, bestätigter Auftragstermin, Positionen | kein KV-Ursprung; direkter Eingang bleibt möglich |
| `documents.references.read/v1` | Evidenz-Fundament (G01) | Auftrag-/Teil-Referenzen mit Typ, Name, Hash/ID, Zeitpunkt | Abschnitt zeigt echten Leer-/Fehlerzustand |
| `accounting.goods-out-gate.read/v2` | G07 | Zahlungsmodus und erlaubte Warenausgangshandlung | Warenausgang fail-closed; Lebenszyklus bis `fertig` bleibt nutzbar |
| `catalog.order-work.read/v1` | G10 | Oberflächen/Katalogwerte und historisierbarer Stundensatz | kein erfundener Preis; Mehrarbeit blockiert |
| `today.conflicts.publish/v1` | G02/G09 | Konfliktfakt, Zuständigkeit, Dringlichkeit, Deep-Link | G04 speichert Fakten weiter; Startanzeige ist extern gestört |
| `calendar.projection.write/v1` | M04 | idempotente Projektion nach bestätigtem G04-Receipt; G04 liefert Terminart, Auftrag-/Positions-IDs, Nummer, Version und Deep-Link; M04/Host ergänzt autorisiert Kundenkurzname sowie Detaildaten/Preise aus deren Besitzerports | asynchron ausstehend; G04 bleibt erfolgreich und führend |
| `calendar.business-time.read/v1` | M04 | read-only Abwesenheiten/Betriebstermine mit Quellenmarker | in G04-Ansichten als externe Daten nicht verfügbar markiert |

## 3. Events

| Event | Auslöser | Mindest-Payload | Besitzer | Stand |
|---|---|---|---|---|
| `ORDER_INTAKE_CREATED_V1` | Auftrag angenommen | order/customer IDs, Nummer, bestätigter Termin, item IDs, Version, actor/client/correlation IDs | G04 | GEBAUT |
| `ORDER_STATION_MOVED_V1` | `angenommen → galvanik` | from/to, expected/new version, actor/client/correlation IDs | G04 | GEBAUT |
| `ORDER_ITEM_EXTRA_WORK_CHANGED_V1` | Mehrarbeit geändert | item, Art, historischer Satz/Wert, Grund, Version | G04 | GEBAUT |
| `ORDER_FROZEN_V1` | `galvanik → fertig` | Freeze-Snapshot, `completedAt`, Version, IDs | G04 | GEBAUT |
| `ORDER_FREEZE_CORRECTED_V1` | Freeze korrigiert | Referenz auf Freeze, Pflichtgrund, Akteur, neue Version | G04 | GEBAUT |
| `ORDER_SCHEDULE_CHANGED_V1` | bestätigter oder Abholtermin geändert | kind, old/new date, Pflichtgrund, old/new version, IDs | G04 | SPEZ |
| `ORDER_PICKED_UP_V2` | Ware abgeholt | Zahlungs-/Gate-Referenz, `occurredAt`, Version, IDs | G04 mit G07-Gate | GEBAUT |
| `ORDER_CANCELLED_V1` | Auftrag storniert | FEHLT → Q-G04-002 | G04 | FEHLT; nicht implementieren |

Alle Ereignisse tragen Tenant, Aggregate-ID, Schema-Version, `clientEventId`, `correlationId`, Aggregate-Version und UTC-Zeitpunkt. Sie sind append-only; Korrekturen erzeugen Gegenereignisse statt Updates der Historie.

## 4. Datenmodell-Feldliste

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| Auftrag | `id` | UUID | ja | Primärschlüssel | G04 | ja: `src/db/schema.ts` `orders.id` |
| Auftrag | `tenant_id` | Text/UUID gemäß Host | ja | aus Session; jeder Read/Write tenantgebunden | G01/G04 | ja: `orders.tenantId`; Legacy-Default nicht als Vertrauen verwenden |
| Auftrag | `order_number` | Text | ja | `A-JJJJ-NNNN+`, unique; Vergabe unter DB-Advisory-Lock | G04 | ja: `orders.orderNumber`; `src/lib/server/commands/orderIntakeCommand.ts` |
| Auftrag | `customer_id` | UUID | ja | Referenz auf G05; kein Kunden-Snapshot als Wahrheit | G05, Referenz G04 | ja: `orders.customerId` |
| Auftrag | `version` | Integer | ja | monoton, optimistic concurrency | G04 | ja: `orders.version` |
| Auftrag | `status` | Enum/Text | ja | nur vier G04-Lebenszykluswerte | G04 | ja: `orders.status`; Migration F1.2 |
| Auftrag | `current_station` | Text | ja | kompatible Projektion des Lebenszyklus, keine zweite Wahrheit | G04 | ja: `orders.currentStation`; Migration F1.2 |
| Auftrag | `title` | Text | ja | aus realem Kunden-/Teilekontext; keine Demo-Texte | G04 | ja: `orders.title` |
| Auftrag | `intake_date` | Timestamp | ja | serverseitig, UTC | G04 | ja: `orders.intakeDate` |
| KV | `dueDate` | Datum | nach KV-Ablauf | Kunden-Wunschtermin, bleibt beim KV | G06 | ja im Vertrag: `src/modules/quotes/server/types.ts` |
| Auftrag | `due_date` | Datum | ja für aktive Aufträge | einzige schreibbare Wahrheit für bestätigten Auftragstermin | G04 | ja: `orders.dueDate`; Intake/Quote-Konvertierung schreibt es |
| Auftrag | `promised_due_date` | Timestamptz | nein | Legacy read-only; nicht dual schreiben; Abgleich vor Stilllegung | Altbestand, künftig G04 nur Migration | ja: `orders.promisedDueDate`; kein aktueller G04-Command nutzt es |
| Auftrag | `pickup_due_date` | Datum | nein | separater Abholtermin; versioniert über Aggregate/Event | G04 | nein → additive Migration erforderlich, nicht ausgeführt |
| Auftrag | `completed_date` | Timestamptz | ab `fertig` | genau beim Freeze gesetzt; Korrektur nur per Command | G04 | ja: `orders.completedDate`; Freeze-Migration |
| Auftrag | `cancelled_at` | Timestamptz | bei Storno | keine Umsetzung vor Q-G04-002 | G04 | nein |
| Auftrag | `cancellation_reason` | Text | bei Storno | Pflicht, nicht leer; keine Umsetzung vor Q-G04-002 | G04 | nein |
| Position | `id` | UUID | ja | Primärschlüssel | G04 | ja: `items.id` |
| Position | `order_id` | UUID | ja | gleiche Tenant-Zugehörigkeit wie Auftrag | G04 | ja: `items.orderId` |
| Position | `name` | Text | ja | reale Bezeichnung | G04 | ja: `items.name` |
| Position | `quantity` | Integer | ja | > 0 | G04 | ja: `items.quantity` |
| Position | `material` | Text | ja | Katalog oder zulässiger Freitext | G04/G10 | ja: `items.material` |
| Position | `surface_requested` | Text | ja | Zieloberfläche; Grundlage für Bündelvorschlag | G04/G10 | ja: `items.surfaceRequested` |
| Position | `photo_ids` | Array/Referenzen | nein | nur Evidenz-IDs; Foto nicht generell Pflicht | Evidenz-Fundament, Referenz G04 | ja als Legacy-Feld: `items.photoIds`; Ziel: Port-Referenzen |
| Position | `internal_notes` | Text | nein | Auftrag-/Teil-Scope eindeutig | G04 | ja: `items.internalNotes` |
| Ereignis | `event_type` | Text | ja | versionierter bekannter Typ | G04 | ja: `events.eventType` |
| Ereignis | `payload` | JSONB | ja | Schema-Version validiert; keine Secret-Werte | G04 | ja: `events.payload` |
| Ereignis | `client_event_id` | UUID/Text | bei Commands ja | idempotent je Tenant/Akteur/Command | G04 | ja: `events.clientEventId` |
| Ereignis | `correlation_id` | UUID | ja | durch Receipt/Readback und Logs geführt | G04 | ja: `events.correlationId` |
| Ereignis | `aggregate_version` | Integer | ja | entspricht neuer Auftragsversion | G04 | ja: `events.aggregateVersion` |
| Ereignis | `created_at` | Timestamptz | ja | serverseitiger UTC-Zeitpunkt; Quelle für Abholung | G04 | ja: `events.createdAt` |
| Mehrarbeit | historischer Satz/Betrag | Integer/Decimal gemäß F1.3 | bei abrechenbarer Mehrarbeit | Snapshot beim Erfassen, Freeze bei `fertig` | G04/G10 | ja: F1.3-Migrationen/Receipts |
| Dokumentreferenz | `document_id`, Scope | UUID + Enum | nein | Besitzer Evidenz-Fundament; Auftrag oder Teil eindeutig | Evidenz-Fundament | G04-Zielmodell nein; nur bestehende Attachment-/Photo-Felder |
| KPI-Fakt | `promisedDate`, `finishedAt`, `pickedUpAt`, `cancellationClass` | Read-DTO | ja/nullable mit Missing-Reason | abgeleitet, nicht als zweite Tabelle | G04 → M02 | teilweise; Storno-Klassifikation fehlt |
| Aufbewahrung | `document_type`, Frist, Freigabestatus | Port-DTO | je Dokument | Einstellung je Art; keine stille Löschung | G10/Evidenz-Fundament, G04 klassifiziert | nein im G04-Schema; Q-G04-007 |

### Soll-Ist-Festlegung

1. `orders.due_date` ist für neue G04-Arbeit der bestätigte Auftragstermin. `promised_due_date` wird nicht parallel beschrieben. Vor einer späteren Bereinigung muss ein read-only Abgleich `gleich / nur due_date / nur promised / widersprüchlich` liefern; widersprüchliche Zeilen werden nicht automatisch migriert.
2. `pickup_due_date` ist eine additive Spalte auf `public.orders`; Historie liegt in `events`. Keine neue Tabelle und keine Remote-Migration in diesem Auftrag.
3. Fertig-Zeitpunkt ist `completed_date` aus dem Freeze; Abholzeitpunkt kommt aus genau einem validen `ORDER_PICKED_UP_V2`-Ereignis. Kein „updated_at“ als Ersatz.
4. Storno-Felder/Event bleiben bis Q-G04-002 ungebaut und UI-seitig `In Klärung`.
5. Dokumente, Zahlung und Kundenstamm werden nicht gespiegelt; G04 hält nur stabile Referenzen und fachlich nötige Snapshots.

### Aufbewahrungsklassifikation für G04

| Dokumentart | Vorgabe aus OE-2609-20 | G04-Verhalten bis OP-13 |
|---|---|---|
| Auftrags-/Angebotsschriftverkehr einschließlich zugehöriger Mails | mindestens 6 Jahre und darüber hinaus, solange steuerliche Prüfung noch möglich ist | als `business_correspondence` klassifizieren; nur Fristvorschlag, keine Löschung/Anonymisierung |
| Rechnungen/Buchungsbelege im Auftragskontext | mindestens 8 Jahre und darüber hinaus bei fortdauernder Prüfbarkeit | nur G07-Referenz; G04 setzt keine eigene Fristwahrheit |
| sonstige Mail/Telefonnotiz | Vorbelegung 3 Jahre nach Jahresende | als konfigurierbare Vorbelegung anzeigen; keine Ausführung ohne Admin-Freigabe |
| anonymisierte/aggregierte Analysedaten | unbefristet | nur anonymisierte Fakten an M02; kein Personenbezug als Analyse-Schattenbestand |
| personenbezogene Auftragsdaten nach Fristablauf | nur solange nötig/gesetzlich vorgeschrieben | Personenbezug erst nach Vorschlag, Prüfung und Admin-Freigabe entfernen; Geschäftszahlen erhalten |

Das Microsoft-Postfach ist von dieser G04-Mechanik nicht betroffen. Fristwerte und Fristbeginn werden vor Livegang durch Steuerberater/Datenschutz bestätigt; Einstellungen sind je Dokumentart und nie hardcodierte stille Jobs.

### M04-Projektionsdatensparsamkeit

Die Kalenderübersicht erhält nur `Terminart`, `Auftragsnummer` und `Kundenkurzname`. Erst der geöffnete, autorisierte Outlook-Termin enthält Kunde, Auftrag, Teile/Verfahren, Menge, Notizen, Preise und Links in die App. G04 besitzt dafür nur Auftrag, Teile und stabile Referenzen; Kundenstamm und Preise kommen beim M04/Host-Adapter aus G05 beziehungsweise G07. Es gibt keine Kopie dieser Fremdwahrheiten in `orders`.

## 5. Manifeste und Handshake

| Datei | Pfad + SHA | Befund | Soll |
|---|---|---|---|
| Modulmanifest | `src/modules/orders/orders.manifest.json`, SHA-256 `ED89E729F100…` | vorhanden, aber `ownsTables`, Events, Views/Migrations und Abhängigkeiten leer und damit nicht deckungsgleich zum Ist | nach PL-Klärung Q-G04-008 an reale Ports/Besitzverhältnisse angleichen |
| Capability-Manifest | `src/modules/orders/capability.manifest.json` | FEHLT | Fähigkeiten `read`, `create`, `lifecycle.write`, `schedule.read/write`, `extraWork.write`, `freeze`, `pickup` deklarieren |
| Integration-Handshake | `src/modules/orders/INTEGRATION_HANDSHAKE.json` | FEHLT | angebotene/benötigte Ports, Eventversionen, Fail-closed-Verhalten und Transfergates deklarieren |
| Server-Fassade | `src/modules/orders/server-public.ts` | FEHLT | einzige öffentliche Server-Schnittstelle; keine Deep-Imports |

## 6. APIs/Provider

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Host-Datenbank/Supabase | ausschließlich serverseitige Tenant-Transaktionen, bestehende RLS/privilegierte Hostfunktion | keiner im G04-Modul; Host-Umgebung besitzt Konfiguration | GEBAUT für Ist-Commands; neue Migration nur geplant | Keine Remote-Migration, RLS-Änderung oder Echtdatenänderung ohne ausdrückliche Freigabe. |
| Microsoft Graph über M04 | G04 fordert keine Graph-Scopes direkt an | keiner im G04-Modul | HINTEN_ANGESTELLT | Konto, Scopes, Secrets, Azure-/Kostenfreigabe und E2E gehören M04/Owner; kein G04-Fallback. |
| M365-Kreile-Büropostfach | Projektion von Auftragsterminen; read-only Betriebs-/Abwesenheitszeiten über M04 | keiner im G04-Modul | GEPLANT | Nur Kreile-Ressourcen; Microsoft-Postfach selbst ist nicht von G04-Aufbewahrung/Löschung betroffen. |

## 7. Übertragbarkeit

Der G04-Kern verwendet neutrale Konzepte (`Order`, `OrderItem`, `Lifecycle`, `Schedule`, `Receipt`, `ConflictFact`) und kennt weder Kreile-Personennamen noch Microsoft-Konten oder Oberflächenbezeichnungen. Der Kreile-HostAdapter übersetzt Lebenszyklustexte, Oberflächenkatalog, Zahlungs-/Warenausgangsregeln, Zuständigkeit Rolf/Phillip/Gregor und M04-Projektion. Daten, Secrets, Konten und Ressourcen von Kreile dürfen nicht außerhalb dieses Hosts verwendet werden; Anpassungen anderer Zielapps gehören in deren eigenen HostAdapter und nicht in dieses Dossier.
