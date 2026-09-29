<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 04 — Schnittstellen und Daten

## 1. Angebotene Ports

| Export | Sichtbarkeit | Vertrag | Stand |
|---|---|---|---|
| `CalendarProjectionPortV1` | `public.ts` | Nimmt idempotente Auftrags-Fälligkeitsprojektionen an und liefert durable Annahme + Readback der Annahme, nicht des Providererfolgs. | GEBAUT (off-repo) |
| `CalendarAppointmentProjectionPortV2` | `public.ts` | Nimmt allgemeine Einzel-/Serien-/Ausnahme-Projektionen mit Content-Policy und Domain-Belegen an. | GEBAUT (off-repo) |
| `CalendarSignalInPortV1` | `server-public.ts` | Liest schreibgeschützte externe Kalendersignale tenantgebunden. | GEBAUT (off-repo) |
| `ProviderKernelHealthReadPortV1` | `server-public.ts` | Liefert redigierten technischen Health-/Synchronisationszustand. | GEBAUT (off-repo) |

`public.ts` enthält absichtlich nur hostverträgliche Verträge. Providerprotokoll, Stores und Zustandsmaschinen bleiben serverseitig.

## 2. Benötigte Host-Ports

| Host-Port | Muss liefern | Kreile-Zuordnung | Stand |
|---|---|---|---|
| `OrderDueProjectionSourcePortV1` | kanonischen Auftrag, Revision, Fälligkeitsdatum, Lifecycle und Berechtigung mit Domain-Receipt/Readback | G04 Aufträge; vorhandene `orders.due_date`/`promised_due_date` sind noch nicht als Port gebunden | FEHLT → Q-M04-012 |
| `CalendarAppointmentProjectionStoreV2` | atomare Annahme, Intent und Operation-Read | neue connector-private technische Persistenz | FEHLT → Q-M04-006 |
| `CalendarContentPolicyRefV1` | versionierte, gehashte Kreile-Inhaltspolicy mit minimaler Outlook-Übersicht und vollständigem Termindetail | Kreile-HostAdapter nach OE-2609-19 | SPEZ; Candidate-Vertrag muss um Detailinhalt/App-Links erweitert werden |
| `CalendarSignalHostLinkPortV1` | bestätigte, tenantgebundene Verknüpfung mit Domain-Receipt/Readback | erzeugendes Fachmodul/G09 | FEHLT → Q-M04-013 |
| `DelegatedCalendarIdentityReadPortV1` | Status und Ablauf der delegierten Identitätsbindung für Überwachung, Erneuerung und Re-Consent-Warnung | G01/G10 serverseitig | FEHLT → Q-M04-001/004; A-M04-043 |
| `DelegatedCalendarTokenTransportPortV1` | tokenabgeschirmte Ausführung des Graph-Protokolls | serverseitiger Kreile-Provideradapter | FEHLT → Q-M04-004 |
| `DurableKernelStoreV1` | Operation, Intent, Mapping, Lease, Subscription, Delta, Reconcile und Retention atomar/durable | connector-private DB/RLS mit Job-/Outbox-Tabellen und Receipts | SPEZ → Q-M04-006 geklärt; noch nicht gebaut |
| `CalendarProjectionProviderAdapterV1` | Provider-Write und unabhängiger Readback | realer Microsoft-Graph-Adapter | FEHLT |
| `KernelClockPortV1`, `KernelHasherPortV1`, `KernelIdFactoryPortV1` | UTC-Zeit, SHA-256 und opake IDs | Host-Infrastruktur | FEHLT |
| `KernelTelemetryPortV1` | redigierte Telemetrie ohne Fachinhalt/Secrets | Host-Observability | FEHLT |
| `DurableSchedulerPortV1` | persistierte Fälligkeiten einschließlich Erneuerung/Überwachung von delegierter Anmeldung und Graph-Abonnements sowie genau-einmalige Lease-Übernahme | Supabase Cron (`pg_cron`) mit DB-/Edge-Funktionen | SPEZ nach PL-Entscheidung 2026-09-26; A-M04-043 |
| Webhook-Queue-Eingang (Host-Komponente; Portname nicht vorweggenommen) | validierte Microsoft-Benachrichtigung ausschließlich durable in die DB-Warteschlange schreiben | Next.js-Route auf Vercel → connector-private Job-/Outbox-Tabelle | SPEZ nach PL-Entscheidung 2026-09-26; konkrete Bindung im Bau |
| `ProviderIdentityBindingReadPortV1` | tenant- und providergebundene Identität | G01/G10 | FEHLT |
| `ProviderKernelHostPolicyV1` | Retry-, Rate-, Kosten-, Retention- und Zeitzonenpolicy | PL/Owner-freigegebene Kreile-Policy | SPEZ; Architektur Q-M04-006, Werte Q-M04-015, Kosten-Gate Q-M04-014, Retention Q-M04-016 |

## 3. Events und Zustandsübergänge

| Ereignis/Übergang | Erzeuger | Verbraucher | Wirkung |
|---|---|---|---|
| `CalendarAppointmentOperationEventV2` (`ACCEPT`, `DISPATCH`, `PROVIDER_ACCEPTED`, `PROVIDER_REJECTED`, `OUTCOME_UNKNOWN`, `READBACK_MATCHED`, `READBACK_DRIFTED`, Retry/Cancel) | Kernel/Provideradapter | atomarer V2-Store | deterministischer Operationszustand mit Revisionsschutz |
| `OperationEventV1` | Kernel/Worker | `DurableKernelStoreV1` | V1-Operation bis bestätigtem Readback oder Review |
| `SubscriptionEventV1` | Scheduler/Graph-Adapter | Subscription-Zustandsmaschine | Anlegen, Erneuern, Ablauf, Fehler, Re-Consent |
| `DeltaEventV1` | Graph-Adapter/Worker | Delta-Zustandsmaschine | Runde, Page, Commit, Lücke oder Neustart |
| `ReconciliationEventV1` | Readback/Worker/Admin | Reconcile-Zustandsmaschine | Konflikt öffnen, retryen, Review oder auflösen |
| `ExternalCalendarSignalV1` | Delta-/Notification-Adapter | `CalendarSignalInPortV1`/Host | schreibgeschütztes CREATED/UPDATED/DELETED-Signal |

Es gibt **kein** fachliches Event „Outlook hat App-Termin geändert“. Externe Änderungen bleiben Signale.

## 4. Datenmodell-Feldliste und Soll-Ist

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| `TechnicalScopeV1` | `tenantId` | `OpaqueIdV1` | ja | nicht leer; jede Operation tenantgebunden | G01/M04 technisch | nein; Sollpfad Q-M04-006 |
| `TechnicalScopeV1` | `environmentId` | `OpaqueIdV1` | ja | trennt Nichtprod/Production | M04 technisch | nein; Sollpfad Q-M04-006 |
| `TechnicalScopeV1` | `capabilityId` | `OpaqueIdV1` | ja | konkrete Kalenderfähigkeit | M04 technisch | nein; Sollpfad Q-M04-006 |
| `TechnicalScopeV1` | `connectionId` | `OpaqueIdV1` | ja | tenantgebundene Verbindung | M04/G10 | nein; Sollpfad Q-M04-004/006 |
| `OrderDueProjectionV1` | `tenantId` | `OpaqueIdV1` | ja | muss Scope entsprechen | G04 | indirekt `orders.tenant_id` in `src/db/schema.ts` |
| `OrderDueProjectionV1` | `orderId` | `OpaqueIdV1` | ja | kanonische Auftrags-ID | G04 | ja `orders.id` in `src/db/schema.ts` |
| `OrderDueProjectionV1` | `orderNumber` | `string` | ja | aus kanonischem Auftrag | G04 | ja `orders.order_number` |
| `OrderDueProjectionV1` | `orderVersion` | `number` | ja | monoton/projektionstauglich; Bindung offen | G04 | nein als explizite Version → Q-M04-012 |
| `OrderDueProjectionV1` | `dueDate` | `LocalDateV1` | ja | lokales Datum; Port wird nur mit vorhandenem Fälligkeitsdatum erfüllt | G04 | ja `orders.due_date`; zusätzlich `promised_due_date` vorhanden, Auswahl offen |
| `OrderDueProjectionV1` | `lifecycleStatus` | `string` | ja | kanonischer Lifecycle | G04 | ja `orders.status`/Lifecyclecode |
| `OrderDueProjectionV1` | `eligible` | `boolean` | ja | Host entscheidet Projektion/Löschung | G04 | nein als Feld; im Source-Port abzuleiten |
| `CalendarDueEventV1` | `kind` | Literal `ORDER_DUE_ALL_DAY` | ja | nur V1-Fälligkeitsereignis | M04 Vertrag | nein; abgeleitet |
| `CalendarDueEventV1` | `startDate` | `LocalDateV1` | ja | gleich dueDate | M04 Vertrag | nein; abgeleitet |
| `CalendarDueEventV1` | `endDateExclusive` | `LocalDateV1` | ja | dueDate + 1 Tag | M04 Vertrag | nein; abgeleitet |
| `CalendarDueEventV1` | `timeZone` | IANA string | ja | Hostpolicy, für Kreile `Europe/Berlin` | M04/Produkt | nein; Policy fehlt |
| `CalendarDueEventV1` | `title.template` | Literal `ORDER_DUE` | ja | keine freie Vorlage | M04/Produkt | nein; gerendert |
| `CalendarDueEventV1` | `title.orderNumber` | string | ja | aus kanonischem Auftrag | G04 | ja `orders.order_number` |
| `CalendarDueEventV1` | `showAs` | Literal `FREE` | ja | nie Belegungswahrheit | M04 Vertrag | nein; Payloadkonstante |
| `CalendarDueEventV1` | `reminder` | Literal `false` | ja | keine Providererinnerung | M04 Vertrag | nein; Payloadkonstante |
| `CalendarDueEventV1` | `attendees` | leeres Array | ja | keine Teilnehmer in V1 | M04 Vertrag | nein; Payloadkonstante |
| `CalendarDueEventV1` | `recurrence` | `null` | ja | V1 ist Einzelereignis | M04 Vertrag | nein; Payloadkonstante |
| `CalendarProjectionPayloadV1` | `hostPolicyRef` | `ProviderKernelHostPolicyRefV1` | ja | explizite Policyversion | M04/Produkt | nein; Architektur Q-M04-006, Werte Q-M04-015/016 |
| `CalendarProjectionPayloadV1.source` | `kind` | Literal `ORDER_DUE` | ja | V1-Quelle | G04 | nein; Vertragskonstante |
| `CalendarProjectionPayloadV1.source` | `tenantId` | `OpaqueIdV1` | ja | Scopegleichheit | G01/G04 | `orders.tenant_id` |
| `CalendarProjectionPayloadV1.source` | `id` | `OpaqueIdV1` | ja | kanonische Auftrags-ID | G04 | `orders.id` |
| `CalendarProjectionPayloadV1.source` | `version` | integer | ja | Quellrevision | G04 | expliziter Port fehlt Q-M04-012 |
| `CalendarProjectionPayloadV1.source` | `domainReceiptRef` | `OpaqueIdV1` | ja | Domain-Command-Beleg | G04/G01 | Port fehlt |
| `CalendarProjectionPayloadV1.source` | `domainReadbackRef` | `OpaqueIdV1` | ja | unabhängiger Domain-Readback | G04/G01 | Port fehlt |
| `CalendarProjectionPayloadV1.source` | `domainReadbackAsOf` | ISO timestamp | ja | UTC | G04/G01 | Port fehlt |
| `CalendarProjectionPayloadV1.source` | `domainReadbackHash` | `Sha256V1` | ja | SHA-256 | G04/G01 | Port fehlt |
| `CalendarProjectionPayloadV1.source` | `lifecycleStatus` | string | ja | kanonischer Status | G04 | `orders.status`/Lifecyclecode |
| `CalendarProjectionPayloadV1.source` | `eligible` | boolean | ja | Hostentscheidung | G04 | abgeleitet, kein Feld |
| `CalendarProjectionPayloadV1` | `action` | `UPSERT\|DELETE` | ja | aus Eligibility/Quellzustand | M04 Vertrag | nein; abgeleitet |
| `CalendarProjectionPayloadV1` | `event` | `CalendarDueEventV1\|null` | ja | bei UPSERT Event, bei DELETE null | M04 Vertrag | nein; Intentablage Q-M04-006 |
| `CalendarContentPolicyRefV1` | `policyId` | `OpaqueIdV1` | ja | Kreile-spezifisch | M04/Produkt | nein → Q-M04-008 |
| `CalendarContentPolicyRefV1` | `policyVersion` | `string` | ja | 1–64, opaker Token | M04/Produkt | nein → Q-M04-008 |
| `CalendarContentPolicyRefV1` | `renderedContentHash` | `Sha256V1` | ja | SHA-256 über gerenderten Inhalt | M04 | nein → Q-M04-006 |
| Kreile-Content-Policy-Eingabe (logisch; kein neuer Kandidatenvertrag behauptet) | `Terminart` | kanonischer Fachwert | ja | Outlook-Übersicht; nur aus Kreile-Quellmodul | G04/Kreile-HostAdapter | kein M04-Feld; Hostport im Bau zu binden |
| Kreile-Content-Policy-Eingabe (logisch; kein neuer Kandidatenvertrag behauptet) | `Auftragsnummer` | kanonischer Fachwert | ja | Übersicht und Detail; keine freie Eingabe in M04 | G04 | `orders.order_number`; aktueller Repo-Abgleich Q-M04-011 |
| Kreile-Content-Policy-Eingabe (logisch; kein neuer Kandidatenvertrag behauptet) | `Kundenkurzname` | kanonischer Fachwert | ja | nur Übersichtskurzform | G05 | kein M04-Feld; Hostport im Bau zu binden |
| Kreile-Content-Policy-Eingabe (logisch; kein neuer Kandidatenvertrag behauptet) | `Kunde` | kanonischer Fachwert | ja | vollständiges Termindetail | G05 | kein M04-Feld; Hostport im Bau zu binden |
| Kreile-Content-Policy-Eingabe (logisch; kein neuer Kandidatenvertrag behauptet) | `Auftrag` | kanonischer Fachwert | ja | vollständiges Termindetail | G04 | kein M04-Feld; Hostport im Bau zu binden |
| Kreile-Content-Policy-Eingabe (logisch; kein neuer Kandidatenvertrag behauptet) | `Teile/Verfahren` | kanonische Liste | ja | vollständiges Termindetail | G04 | kein M04-Feld; Hostport im Bau zu binden |
| Kreile-Content-Policy-Eingabe (logisch; kein neuer Kandidatenvertrag behauptet) | `Menge` | kanonischer Fachwert | ja | vollständiges Termindetail | G04 | kein M04-Feld; Hostport im Bau zu binden |
| Kreile-Content-Policy-Eingabe (logisch; kein neuer Kandidatenvertrag behauptet) | `Notizen` | freigegebener kanonischer Fachwert | ja | nur nach Kreile-Content-/Datenschutzpolicy | G04 | kein M04-Feld; Hostport im Bau zu binden |
| Kreile-Content-Policy-Eingabe (logisch; kein neuer Kandidatenvertrag behauptet) | `Preise` | kanonische Preiswerte | ja | vollständiges Termindetail; keine Berechnung in M04 | G04/G07 | kein M04-Feld; Hostport im Bau zu binden |
| Kreile-Content-Policy-Eingabe (logisch; kein neuer Kandidatenvertrag behauptet) | `App-Links` | tenantgebundene Referenzen | ja | Links zu allen freigegebenen Kreile-Informationen | Kreile-HostAdapter | Candidate.3 besitzt dafür noch kein Kreile-Detailfeld → `11_IST_CODE_UMBAU.md` |
| `CalendarAppointmentProjectionPayloadV2.source` | `kind` | Literal | ja | `CANONICAL_CALENDAR_APPOINTMENT` | Hostmodul | nein; Vertrag off-repo |
| `CalendarAppointmentProjectionPayloadV2.source` | `tenantId` | `OpaqueIdV1` | ja | Scopegleichheit | G01/Hostmodul | vorhandene Fachtabellen tenantgebunden; Adapter fehlt |
| `CalendarAppointmentProjectionPayloadV2.source` | `objectRef` | `OpaqueIdV1` | ja | kanonische Hostreferenz | Hostmodul | je Hostobjekt vorhanden; Mapping fehlt |
| `CalendarAppointmentProjectionPayloadV2.source` | `revision` | `number` | ja | ganzzahlig, monoton | Hostmodul | expliziter Vertrag fehlt → Q-M04-012 |
| `CalendarAppointmentProjectionPayloadV2.source` | `domainReceiptRef` | `OpaqueIdV1` | ja | bestätigte Domain-Command-Referenz | Hostmodul | G01-Grundstamm noch nicht gebunden |
| `CalendarAppointmentProjectionPayloadV2.source` | `domainReadbackRef` | `OpaqueIdV1` | ja | unabhängiger Domain-Readback | Hostmodul | G01-Grundstamm noch nicht gebunden |
| `CalendarAppointmentProjectionPayloadV2.source` | `domainReadbackAsOf` | ISO timestamp | ja | valide UTC-Zeit | Hostmodul | Portvertrag, keine M04-Tabelle |
| `CalendarAppointmentProjectionPayloadV2.source` | `domainReadbackHash` | `Sha256V1` | ja | SHA-256 | Hostmodul | Portvertrag, keine M04-Tabelle |
| `CalendarAppointmentProjectionPayloadV2` | `action` | `UPSERT\|CANCEL` | ja | aus bestätigter Hostabsicht | Hostmodul/M04 | nein; Intentablage Q-M04-006 |
| `CalendarAppointmentProjectionPayloadV2` | `event` | `CalendarAppointmentEventV2\|null` | ja | bei UPSERT Event, bei CANCEL null | Hostmodul/M04 | nein; Intentablage Q-M04-006 |
| `CalendarAppointmentTargetV2` | `kind` | Enum | ja | Kreile nutzt den Einzeltermin; weitere Kandidatenwerte sind kein Kreile-Abnahmeumfang | Hostmodul/M04 Vertrag | Einzeltermin im Kreile-HostAdapter binden |
| `CalendarAppointmentTargetV2` | `seriesRef` | `OpaqueIdV1\|null` | nein | Kandidaten-Zusatzfähigkeit; darf kein Kreile-Pflichtfeld erzeugen | Hostmodul | für Kreile nicht gefordert |
| `CalendarAppointmentTargetV2` | `originalOccurrenceStartAt` | ISO timestamp/null | nein | Kandidaten-Zusatzfähigkeit; darf kein Kreile-Pflichtfeld erzeugen | Hostmodul | für Kreile nicht gefordert |
| `CalendarAppointmentEventV2` | `kind` | Enum | ja | `TIMED\|ALL_DAY` | Hostmodul | nein als kanonischer Terminvertrag |
| `CalendarAppointmentEventV2` | `timeZone` | IANA string | ja | für Kreile `Europe/Berlin` | Hostmodul/M04 | nein; Vertrag/Policy |
| `CalendarAppointmentEventV2` | `title` | `string` | ja | ausschließlich Content-Policy | M04/Produkt | nein; wird nicht fachlich persistiert |
| `CalendarAppointmentEventV2` | `category` | `string\|null` | ja | für Kreile nur aus kanonischer Terminart; Outlook-Wert ist nie Fachwahrheit | Kreile-HostAdapter | Hostport im Bau zu binden |
| `CalendarAppointmentEventV2` | `location` | `string\|null` | nein | Kandidaten-Zusatzfähigkeit; kein Kreile-Pflichtfeld und kein erfundener Wert | Hostmodul | für Kreile nicht gefordert |
| `CalendarAppointmentEventV2` | `startsAt` | ISO timestamp/null | ja | genau bei `TIMED` gesetzt | Hostmodul | nein als allgemeiner Terminvertrag |
| `CalendarAppointmentEventV2` | `endsAt` | ISO timestamp/null | ja | nach `startsAt` | Hostmodul | nein als allgemeiner Terminvertrag |
| `CalendarAppointmentEventV2` | `allDayStartDate` | LocalDate/null | ja | genau bei `ALL_DAY` gesetzt | Hostmodul | für V1 aus `orders.due_date` ableitbar |
| `CalendarAppointmentEventV2` | `allDayEndDateExclusive` | LocalDate/null | ja | nach Start, exklusiv | Hostmodul | nicht gespeichert; deterministisch ableitbar |
| `CalendarAppointmentEventV2` | `recurrence` | `CalendarRecurrenceV1\|null` | ja | optionale Kandidatenfähigkeit; keine Kreile-Pflicht | Hostmodul | für Kreile nicht gefordert; darf keine Pflichtfelder erzeugen |
| `CalendarRecurrenceV1` | `kind` | Literal | nein | Kandidaten-Zusatzfähigkeit; außerhalb Kreile-Abnahmeumfang | Hostmodul | für Kreile nicht gefordert |
| `CalendarRecurrenceV1` | `frequency` | Enum | nein | Kandidaten-Zusatzfähigkeit; außerhalb Kreile-Abnahmeumfang | Hostmodul | für Kreile nicht gefordert |
| `CalendarRecurrenceV1` | `interval` | integer | nein | Kandidaten-Zusatzfähigkeit; außerhalb Kreile-Abnahmeumfang | Hostmodul | für Kreile nicht gefordert |
| `CalendarRecurrenceV1` | `weekDays` | enum array | nein | Kandidaten-Zusatzfähigkeit; außerhalb Kreile-Abnahmeumfang | Hostmodul | für Kreile nicht gefordert |
| `CalendarRecurrenceV1` | `end` | tagged object | nein | Kandidaten-Zusatzfähigkeit; außerhalb Kreile-Abnahmeumfang | Hostmodul | für Kreile nicht gefordert |
| `CommandEnvelopeV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 Vertrag | nein; Intentablage Q-M04-006 |
| `CommandEnvelopeV1` | `commandId` | `OpaqueIdV1` | ja | eindeutig | Hostmodul | Domain-Commandbindung fehlt |
| `CommandEnvelopeV1` | `correlationId` | `OpaqueIdV1` | ja | Ende-zu-Ende-Korrelation | Hostmodul/M04 | nein; Q-M04-006 |
| `CommandEnvelopeV1` | `scope` | `TechnicalScopeV1` | ja | vollständig tenantgebunden | M04 technisch | nein; Q-M04-006 |
| `CommandEnvelopeV1` | `issuedAt` | ISO timestamp | ja | UTC | Hostmodul | Domain-Port fehlt |
| `CommandEnvelopeV1` | `idempotency.key` | string | ja | kanonisch/eindeutig | M04 Vertrag | nein; Q-M04-006 |
| `CommandEnvelopeV1` | `idempotency.intentHash` | `Sha256V1` | ja | Hash über kanonischen Intent | M04 Vertrag | nein; Q-M04-006 |
| `CommandEnvelopeV1` | `confirmation.requirement` | Enum | ja | `NOT_REQUIRED\|REQUIRED` | Hostmodul | Domain-Port fehlt |
| `CommandEnvelopeV1` | `confirmation.status` | Enum | ja | `NOT_REQUIRED\|CONFIRMED` | Hostmodul | Domain-Port fehlt |
| `CommandEnvelopeV1` | `confirmation.confirmedAt` | ISO timestamp/null | ja | nur bei Bestätigung | Hostmodul | Domain-Port fehlt |
| `CommandEnvelopeV1` | `confirmation.confirmedBy` | `OpaqueIdV1\|null` | ja | nur bei Bestätigung | Hostmodul | Domain-Port fehlt |
| `CommandEnvelopeV1` | `confirmation.evidenceRef` | `OpaqueIdV1\|null` | ja | nur Referenz, keine Secretwerte | Hostmodul | Domain-Port fehlt |
| `CommandEnvelopeV1` | `payload` | generischer Payload | ja | V1 oder V2 exakt validiert | Hostmodul/M04 | Intentablage Q-M04-006 |
| `ReadEnvelopeV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | Portvertrag | keine eigene Spalte nötig |
| `ReadEnvelopeV1` | `source.kind` | Enum | ja | App, Provider oder Kernel technisch | Portvertrag | keine eigene Spalte nötig |
| `ReadEnvelopeV1` | `source.ref` | `OpaqueIdV1\|null` | ja | Autoritätsreferenz | Portvertrag | keine eigene Spalte nötig |
| `ReadEnvelopeV1` | `asOf` | ISO timestamp | ja | Belegzeitpunkt | Portvertrag | keine eigene Spalte nötig |
| `ReadEnvelopeV1` | `coverage.status` | Enum | ja | `COMPLETE\|PARTIAL\|NONE` | Portvertrag | keine eigene Spalte nötig |
| `ReadEnvelopeV1` | `coverage.includedScopes` | string array | ja | tatsächlich enthalten | Portvertrag | keine eigene Spalte nötig |
| `ReadEnvelopeV1` | `coverage.missingScopes` | string array | ja | fehlende Teile explizit | Portvertrag | keine eigene Spalte nötig |
| `ReadEnvelopeV1` | `stale` | boolean | ja | Alterung explizit | Portvertrag | keine eigene Spalte nötig |
| `ReadEnvelopeV1` | `partial` | boolean | ja | Teilantwort explizit | Portvertrag | keine eigene Spalte nötig |
| `ReadEnvelopeV1` | `denied` | object/null | ja | not authorized/not connected/reauth/denied plus Korrelation | Portvertrag | keine eigene Spalte nötig |
| `ReadEnvelopeV1` | `correlationId` | `OpaqueIdV1` | ja | Ende-zu-Ende-Korrelation | Portvertrag | keine eigene Spalte nötig |
| `ReadEnvelopeV1` | `data` | generischer Typ/null | ja | kein Datenwert bei denied/none | Portvertrag | fachlicher/technischer Store |
| `DurableAcceptanceReceiptV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 technisch | nein; Q-M04-006 |
| `DurableAcceptanceReceiptV1` | `receiptId` | `OpaqueIdV1` | ja | eindeutig | M04 technisch | nein; Q-M04-006 |
| `DurableAcceptanceReceiptV1` | `operationId` | `OpaqueIdV1` | ja | Operationbezug | M04 technisch | nein; Q-M04-006 |
| `DurableAcceptanceReceiptV1` | `commandId` | `OpaqueIdV1` | ja | Commandbezug | M04 technisch | nein; Q-M04-006 |
| `DurableAcceptanceReceiptV1` | `correlationId` | `OpaqueIdV1` | ja | Korrelation | M04 technisch | nein; Q-M04-006 |
| `DurableAcceptanceReceiptV1` | `acceptedAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `DurableAcceptanceReceiptV1` | `durableRevision` | integer | ja | persistierte Revision | M04 technisch | nein; Q-M04-006 |
| `DurableAcceptanceReceiptV1` | `outcome` | Enum | ja | `DURABLY_ACCEPTED\|IDEMPOTENT_REPLAY` | M04 technisch | nein; Q-M04-006 |
| `DurableAcceptanceReceiptV1` | `providerOutcome` | Literal `NOT_ATTEMPTED` | ja | Annahme behauptet keinen Providererfolg | M04 technisch | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 technisch | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `receiptId` | `OpaqueIdV1` | ja | eindeutig | M04 technisch | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `operationId` | `OpaqueIdV1` | ja | Operationbezug | M04 technisch | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `recordedAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `providerAcceptedAt` | ISO timestamp/null | ja | nur bei bekanntem Providerzeitpunkt | Provider/M04 | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `providerRequestId` | `OpaqueIdV1\|null` | ja | redigierte Providerreferenz | Provider/M04 | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `externalRef` | `OpaqueIdV1\|null` | ja | Providerobjektreferenz | Provider/M04 | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `externalVersion` | `string\|null` | ja | Provideretag/-version | Provider/M04 | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `httpStatus` | integer/null | ja | HTTP-Status, kein Erfolg allein | Provider/M04 | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `outcome` | Enum | ja | `ACCEPTED\|REJECTED\|UNKNOWN` | M04 technisch | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `errorCode` | `KernelErrorCodeV1\|null` | ja | klassifiziert/redigiert | M04 technisch | nein; Q-M04-006 |
| `ExternalOperationReceiptV1` | `responseFingerprint` | `Sha256V1\|null` | ja | keine Rohantwort nötig | M04 technisch | nein; Q-M04-006 |
| `AuthoritativeReadbackV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 technisch | nein; Q-M04-006 |
| `AuthoritativeReadbackV1` | `readbackId` | `OpaqueIdV1` | ja | eindeutig | M04 technisch | nein; Q-M04-006 |
| `AuthoritativeReadbackV1` | `operationId` | `OpaqueIdV1` | ja | Operationbezug | M04 technisch | nein; Q-M04-006 |
| `AuthoritativeReadbackV1` | `observedAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `AuthoritativeReadbackV1` | `method` | Enum | ja | Provider GET oder Delta | M04 technisch | nein; Q-M04-006 |
| `AuthoritativeReadbackV1` | `externalRef` | `OpaqueIdV1\|null` | ja | Providerobjektreferenz | M04 technisch | nein; Q-M04-006 |
| `AuthoritativeReadbackV1` | `externalVersion` | `string\|null` | ja | Provideretag/-version | M04 technisch | nein; Q-M04-006 |
| `AuthoritativeReadbackV1` | `observedOwnedFieldHash` | `Sha256V1\|null` | ja | Hash der M04-eigenen Felder | M04 technisch | nein; Q-M04-006 |
| `AuthoritativeReadbackV1` | `result` | Enum | ja | `MATCH\|MISSING\|DRIFT\|UNREADABLE` | M04 technisch | nein; Q-M04-006 |
| `AuthoritativeReadbackV1` | `evidenceFingerprint` | `Sha256V1` | ja | redigierter Beleg | M04 technisch | nein; Q-M04-006 |
| `AuthoritativeReadbackV1` | `errorCode` | `KernelErrorCodeV1\|null` | ja | klassifiziert/redigiert | M04 technisch | nein; Q-M04-006 |
| `ProviderKernelHostPolicyV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04/PL | nein; Policy Q-M04-015/016 |
| `ProviderKernelHostPolicyV1` | `policyId` | string | ja | explizite Policy-ID | M04/PL | nein; Policy fehlt |
| `ProviderKernelHostPolicyV1` | `policyVersion` | semver string | ja | explizite semantische Version | M04/PL | nein; Policy fehlt |
| `ProviderKernelHostPolicyV1.calendarDueProjection` | `lifecycleStatuses` | string array | ja | 1–64 eindeutige Tokens | G04/PL | nein; Policy fehlt |
| `ProviderKernelHostPolicyV1.calendarDueProjection` | `terminalLifecycleStatuses` | string array | ja | Teilmenge/terminal | G04/PL | nein; Policy fehlt |
| `ProviderKernelHostPolicyV1.calendarDueProjection` | `timeZone` | IANA string | ja | Kreile `Europe/Berlin` | M04/PL | nein; Policy fehlt |
| `ProviderIdentityBindingV1` | `bindingId` | string | ja | opake Bindungs-ID | G01/G10 | nein; Q-M04-004 |
| `ProviderIdentityBindingV1` | `scope` | `TechnicalScopeV1` | ja | tenant-/connectiongebunden | G01/G10 | nein; Q-M04-004 |
| `ProviderIdentityBindingV1` | `appActorId` | string | ja | delegierter Hostakteur | G01/G10 | nein; Q-M04-004 |
| `ProviderIdentityBindingV1` | `providerTenantRef` | string | ja | keine Secretangabe | G10 | nein; Q-M04-001/004 |
| `ProviderIdentityBindingV1` | `providerPrincipalRef` | string | ja | benannter delegierter Benutzer als Referenz | G10 | nein; Q-M04-004 |
| `ProviderIdentityBindingV1` | `purpose` | Literal `CALENDAR_DUE_PROJECTION` | ja | keine Zweckvermischung | M04 | nein; Q-M04-004 |
| `ProviderIdentityBindingV1` | `status` | Enum | ja | verified/reauth/denied/disabled | G10/M04 | nein; Q-M04-004 |
| `ProviderIdentityBindingV1` | `verifiedAt` | ISO timestamp | ja | UTC | G10/M04 | nein; Q-M04-004 |
| `CalendarAppointmentOperationV2` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 technisch | nein; neue Persistenz Q-M04-006 |
| `CalendarAppointmentOperationV2` | `operationId` | `OpaqueIdV1` | ja | eindeutig/tenantgebunden | M04 technisch | nein; neue Persistenz Q-M04-006 |
| `CalendarAppointmentOperationV2` | `commandId` | `OpaqueIdV1` | ja | Command-Bezug | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `correlationId` | `OpaqueIdV1` | ja | Ende-zu-Ende-Korrelation | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `scope` | `TechnicalScopeV1` | ja | tenant/providergebunden | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `source` | object | ja | Objekt/Revision unveränderlich | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `target` | object | ja | Einzel/Serie/Ausnahme | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `action` | Enum | ja | `UPSERT\|CANCEL` | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `idempotencyKey` | string | ja | kanonisch abgeleitet/eindeutig | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `intentHash` | `Sha256V1` | ja | SHA-256 | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `intentRef` | `OpaqueIdV1` | ja | durable Payloadreferenz | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `state` | Enum | ja | nur definierte Zustandsmaschine | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `revision` | integer | ja | optimistic concurrency | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `createdAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `updatedAt` | ISO timestamp | ja | UTC, nicht vor createdAt | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `providerReceiptRef` | `OpaqueIdV1\|null` | ja | nur nach Providerantwort | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `independentReadbackRef` | `OpaqueIdV1\|null` | ja | nur nach unabhängigem Readback | M04 technisch | nein; Q-M04-006 |
| `CalendarAppointmentOperationV2` | `lastErrorCode` | `string\|null` | ja | klassifiziert, redigiert | M04 technisch | nein; Q-M04-006 |
| `ExternalCalendarSignalV1` | `signalId` | `OpaqueIdV1` | ja | eindeutig/tenantgebunden | M04 technisch | nein; Q-M04-006 |
| `ExternalCalendarSignalV1` | `calendarBindingRef` | `OpaqueIdV1` | ja | kein Klartext-Secret | M04/G10 | nein; Q-M04-004/006 |
| `ExternalCalendarSignalV1` | `externalEventRef` | `OpaqueIdV1` | ja | stabile Providerreferenz | M04 technisch | nein; Q-M04-006 |
| `ExternalCalendarSignalV1` | `externalVersion` | `string\|null` | ja | Provider-Etag/Version | M04 technisch | nein; Q-M04-006 |
| `ExternalCalendarSignalV1` | `change` | Enum | ja | `CREATED\|UPDATED\|DELETED` | M04 technisch | nein; Q-M04-006 |
| `ExternalCalendarSignalV1` | `observedAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `ExternalCalendarSignalV1.event` | `kind` | Enum | ja | `TIMED\|ALL_DAY\|DELETED` | externer Provider, nur Signal | nein; Q-M04-006 |
| `ExternalCalendarSignalV1.event` | `timeZone` | IANA string/null | ja | normalisiert | externer Provider, nur Signal | nein; Q-M04-006 |
| `ExternalCalendarSignalV1.event` | `startsAt` | ISO timestamp/null | ja | konsistent mit kind | externer Provider, nur Signal | nein; Q-M04-006 |
| `ExternalCalendarSignalV1.event` | `endsAt` | ISO timestamp/null | ja | konsistent mit kind | externer Provider, nur Signal | nein; Q-M04-006 |
| `ExternalCalendarSignalV1.event` | `allDayStartDate` | LocalDate/null | ja | konsistent mit kind | externer Provider, nur Signal | nein; Q-M04-006 |
| `ExternalCalendarSignalV1.event` | `allDayEndDateExclusive` | LocalDate/null | ja | konsistent mit kind | externer Provider, nur Signal | nein; Q-M04-006 |
| `ExternalCalendarSignalV1.event` | `subject` | `string\|null` | ja | nur gemäß Kreile-Policy/Retention | externer Provider, nur Signal | nein; Content Q-M04-008 geklärt, Retention Q-M04-016 |
| `ExternalCalendarSignalV1.event` | `location` | `string\|null` | ja | nur gemäß Kreile-Policy/Retention | externer Provider, nur Signal | nein; Content Q-M04-008 geklärt, Retention Q-M04-016 |
| `ExternalCalendarSignalV1.event` | `contentFingerprint` | `Sha256V1\|null` | ja | Inhalt deduplizieren/redigieren | M04 technisch | nein; Q-M04-006/016 |
| `ProviderOperationRecordV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `operationId` | `OpaqueIdV1` | ja | eindeutig | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `commandId` | `OpaqueIdV1` | ja | Commandbezug | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `correlationId` | `OpaqueIdV1` | ja | Ende-zu-Ende-Korrelation | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `scope` | `TechnicalScopeV1` | ja | vollständige Scopegleichheit | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `source` | `{kind:ORDER_DUE,id,version}` | ja | kanonische G04-Quelle | G04/M04 technisch | nein; Source-Port fehlt |
| `ProviderOperationRecordV1` | `action` | `UPSERT\|DELETE` | ja | V1-Aktion | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `idempotency` | `IdempotencyV1` | ja | Key + Intent-Hash | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `intentRef` | `OpaqueIdV1` | ja | durable Payloadreferenz | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `state` | `OperationStateV1` | ja | nur Zustandsmaschine | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `revision` | integer | ja | optimistic concurrency | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `attempt` | integer | ja | nicht negativ | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `createdAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `updatedAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `nextAttemptAt` | ISO timestamp/null | ja | nur bei geplantem Retry | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `providerIntentHash` | `Sha256V1\|null` | ja | gehashter Providerintent | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `expectedOwnedFieldHash` | `Sha256V1\|null` | ja | Readback-Vergleich | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `targetExternalRef` | `OpaqueIdV1\|null` | ja | stabile Providerreferenz | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `lease` | `OperationLeaseRefV1\|null` | ja | Lease + Fencing | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `lastFencingToken` | integer | ja | monoton | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `providerReceiptCount` | integer | ja | nicht negativ | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `lastProviderReceiptId` | `OpaqueIdV1\|null` | ja | letztes Receipt | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `lastProviderReceiptAt` | ISO timestamp/null | ja | zum Receipt passend | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `readbackCount` | integer | ja | nicht negativ | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `lastReadbackId` | `OpaqueIdV1\|null` | ja | letzter Readback | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `lastReadbackAt` | ISO timestamp/null | ja | zum Readback passend | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `lastErrorCode` | `KernelErrorCodeV1\|null` | ja | klassifiziert/redigiert | M04 technisch | nein; Q-M04-006 |
| `ProviderOperationRecordV1` | `reconciliationCaseId` | `OpaqueIdV1\|null` | ja | offene Klärung referenzieren | M04 technisch | nein; Q-M04-006 |
| `LeaseRecordV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 technisch | nein; Q-M04-006 |
| `LeaseRecordV1` | `resourceKey` | string | ja | eindeutiger Ressourcenschlüssel | M04 technisch | nein; Q-M04-006 |
| `LeaseRecordV1` | `leaseId` | `OpaqueIdV1` | ja | eindeutig | M04 technisch | nein; Q-M04-006 |
| `LeaseRecordV1` | `ownerId` | `OpaqueIdV1` | ja | Workerowner | M04 technisch | nein; Q-M04-006 |
| `LeaseRecordV1` | `fencingToken` | integer | ja | monoton | M04 technisch | nein; Q-M04-006 |
| `LeaseRecordV1` | `acquiredAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `LeaseRecordV1` | `expiresAt` | ISO timestamp | ja | nach acquiredAt | M04 technisch | nein; Q-M04-006 |
| `LeaseRecordV1` | `releasedAt` | ISO timestamp/null | ja | nicht vor acquiredAt | M04 technisch | nein; Q-M04-006 |
| `LeaseRecordV1` | `revision` | integer | ja | optimistic concurrency | M04 technisch | nein; Q-M04-006 |
| `ProjectionMappingV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 technisch | nein; Q-M04-006 |
| `ProjectionMappingV1` | `mappingId` | `OpaqueIdV1` | ja | eindeutig | M04 technisch | nein; Q-M04-006 |
| `ProjectionMappingV1` | `scope` | `TechnicalScopeV1` | ja | tenant-/connectiongebunden | M04 technisch | nein; Q-M04-006 |
| `ProjectionMappingV1` | `source` | `{kind:ORDER_DUE,id,version}` | ja | kanonische Quellrevision | G04/M04 technisch | nein; Q-M04-006/012 |
| `ProjectionMappingV1` | `externalRef` | `OpaqueIdV1` | ja | stabile Provider-ID | M04 technisch | nein; Q-M04-006 |
| `ProjectionMappingV1` | `externalContainerRef` | `OpaqueIdV1` | ja | gebundener Kalender | M04 technisch | nein; Q-M04-003/006 |
| `ProjectionMappingV1` | `externalVersion` | `string\|null` | ja | Provideretag/-version | M04 technisch | nein; Q-M04-006 |
| `ProjectionMappingV1` | `ownedFieldHash` | `Sha256V1` | ja | nur M04-eigene Felder | M04 technisch | nein; Q-M04-006 |
| `ProjectionMappingV1` | `state` | Enum | ja | `ACTIVE\|DRIFTED\|RECOVERY_REQUIRED\|TOMBSTONED` | M04 technisch | nein; Q-M04-006 |
| `ProjectionMappingV1` | `createdAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `ProjectionMappingV1` | `updatedAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `ProjectionMappingV1` | `tombstonedAt` | ISO timestamp/null | ja | nur Tombstone | M04 technisch | nein; Q-M04-006 |
| `ProjectionMappingV1` | `revision` | integer | ja | optimistic concurrency | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `subscriptionKey` | `OpaqueIdV1` | ja | interne eindeutige Bindung | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `scope` | `TechnicalScopeV1` | ja | tenant-/connectiongebunden | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `resourceScopeHash` | `Sha256V1` | ja | abonnierte Ressource gehasht | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `externalSubscriptionRef` | `OpaqueIdV1\|null` | ja | Providerreferenz | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `verificationSecretRef` | `OpaqueIdV1` | ja | nur Secretreferenz, nie Wert | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `state` | `SubscriptionStateV1` | ja | nur Zustandsmaschine | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `expiresAt` | ISO timestamp/null | ja | Providerablauf | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `renewAfter` | ISO timestamp/null | ja | vor Ablauf | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `lastDeliveryAt` | ISO timestamp/null | ja | letzte Notification | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `revision` | integer | ja | optimistic concurrency | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `updatedAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `SubscriptionRecordV1` | `lastErrorCode` | `KernelErrorCodeV1\|null` | ja | klassifiziert/redigiert | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `checkpointKey` | `OpaqueIdV1` | ja | je Scope/Fenster eindeutig | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `scope` | `TechnicalScopeV1` | ja | tenant-/connectiongebunden | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `state` | `DeltaStateV1` | ja | nur Zustandsmaschine | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `committedCursorRef` | `OpaqueIdV1\|null` | ja | nur Referenz, durable | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `candidateCursorRef` | `OpaqueIdV1\|null` | ja | erst nach kompletter Runde committen | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `roundId` | `OpaqueIdV1\|null` | ja | Deltarunde | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `nextPageNumber` | integer | ja | nicht negativ | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `pageFingerprints` | `Sha256V1[]` | ja | Deduplizierung/Beleg | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `roundStartedAt` | ISO timestamp/null | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `lastCommittedAt` | ISO timestamp/null | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `nextAttemptAt` | ISO timestamp/null | ja | bei Retry/Rate | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `revision` | integer | ja | optimistic concurrency | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `updatedAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `DeltaCheckpointV1` | `lastErrorCode` | `KernelErrorCodeV1\|null` | ja | klassifiziert/redigiert | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `caseId` | `OpaqueIdV1` | ja | eindeutig | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `operationId` | `OpaqueIdV1\|null` | ja | optionaler Operationsbezug | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `scope` | `TechnicalScopeV1` | ja | tenant-/connectiongebunden | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `reason` | `ReconciliationReasonV1` | ja | nur definierte Gründe | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `state` | `ReconciliationStateV1` | ja | nur Zustandsmaschine | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `resolution` | Enum/null | ja | Match/Missing/Manual oder offen | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `attempt` | integer | ja | nicht negativ | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `maxAttempts` | integer | ja | positiv/policygebunden | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `openedAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `updatedAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `nextAttemptAt` | ISO timestamp/null | ja | Retryzeitpunkt | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `revision` | integer | ja | optimistic concurrency | M04 technisch | nein; Q-M04-006 |
| `ReconciliationCaseV1` | `lastEvidenceFingerprint` | `Sha256V1\|null` | ja | redigierter Beleg | M04 technisch | nein; Q-M04-006 |
| `RetryPolicyV1` | `baseDelayMs` | integer | ja | positiv | M04/PL Policy | nein; Q-M04-015 |
| `RetryPolicyV1` | `maxDelayMs` | integer | ja | ≥ baseDelay | M04/PL Policy | nein; Q-M04-015 |
| `RetryPolicyV1` | `maxRetryAfterMs` | integer | ja | Providerwert begrenzen | M04/PL Policy | nein; Q-M04-015 |
| `RetryPolicyV1` | `jitterRatio` | number | ja | begrenzter Anteil | M04/PL Policy | nein; Q-M04-015 |
| `RetryPolicyV1` | `maxAttempts` | integer | ja | positiver Endwert | M04/PL Policy | nein; Q-M04-015 |
| `RetryPolicyV1` | `maxElapsedMs` | integer | ja | positiver Retryhorizont | M04/PL Policy | nein; Q-M04-015 |
| `CostPolicyV1` | `maxOperationCostUnits` | number | ja | freigegebenes Limit | Owner/PL | nein; Q-M04-014/015 |
| `CostPolicyV1` | `maxWindowCostUnits` | number | ja | freigegebenes Fensterlimit | Owner/PL | nein; Q-M04-014/015 |
| `CostPolicyV1` | `windowStartedAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `CostPolicyV1` | `windowDurationMs` | integer | ja | positiv | Owner/PL | nein; Q-M04-014/015 |
| `CostPolicyV1` | `usedWindowCostUnits` | number | ja | nicht negativ | M04 technisch | nein; Q-M04-006 |
| `RatePolicyV1` | `maxConcurrent` | integer | ja | positiv | Owner/PL | nein; Q-M04-015 |
| `RatePolicyV1` | `currentConcurrent` | integer | ja | 0..max | M04 technisch | nein; Q-M04-006 |
| `RatePolicyV1` | `maxWindowRequests` | integer | ja | positiv | Owner/PL | nein; Q-M04-015 |
| `RatePolicyV1` | `usedWindowRequests` | integer | ja | nicht negativ | M04 technisch | nein; Q-M04-006 |
| `RatePolicyV1` | `windowResetsAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `RetentionRecordV1` | `category` | Enum | ja | Operation/Receipt/Readback/Tombstone/Delta/Recovery | M04 technisch | nein; Q-M04-006/016 |
| `RetentionRecordV1` | `createdAt` | ISO timestamp | ja | UTC | M04 technisch | nein; Q-M04-006 |
| `RetentionRecordV1` | `retainUntil` | ISO timestamp | ja | Datenart-/Policyentscheidung; nie stille Löschung | Owner/PL | nein; Q-M04-016 |
| `RetentionRecordV1` | `legalHold` | boolean | ja | Löschung aussetzen | Owner/PL | nein; Q-M04-016 |
| `CalendarSignalQueryV1` | `scope` | `TechnicalScopeV1` | ja | tenant-/connectiongebunden | Host/M04 | keine eigene Persistenz |
| `CalendarSignalQueryV1` | `calendarBindingRef` | `OpaqueIdV1` | ja | gebundener Kalender | G10/M04 | nein; Q-M04-003/004 |
| `CalendarSignalQueryV1` | `since` | ISO timestamp/null | ja | untere Abfragegrenze | Host/M04 | keine eigene Persistenz |
| `CalendarSignalQueryV1` | `limit` | integer | ja | begrenzt/validiert | Host/M04 | keine eigene Persistenz |
| `CalendarSignalQueryV1` | `correlationId` | `OpaqueIdV1` | ja | Ende-zu-Ende-Korrelation | Host/M04 | keine eigene Persistenz |
| `CalendarSignalHostLink` | `scope` | `TechnicalScopeV1` | ja | tenantgebunden | Hostmodul | Hostpersistenz fehlt Q-M04-013 |
| `CalendarSignalHostLink` | `signalId` | `OpaqueIdV1` | ja | vorhandenes Signal | M04 technisch | nein; Q-M04-006 |
| `CalendarSignalHostLink` | `hostObjectRef` | `OpaqueIdV1` | ja | kanonisches Hostobjekt | Hostmodul | nein; Q-M04-013 |
| `CalendarSignalHostLink` | `hostDecisionReceiptRef` | `OpaqueIdV1` | ja | bestätigte Hostentscheidung | Hostmodul | nein; Q-M04-013 |
| `CalendarSignalHostLink` | `hostReadbackRef` | `OpaqueIdV1` | ja | unabhängiger Hostreadback | Hostmodul | nein; Q-M04-013 |
| `CalendarSignalHostLink` | `correlationId` | `OpaqueIdV1` | ja | Ende-zu-Ende-Korrelation | Hostmodul/M04 | nein; Q-M04-006 |
| `MicrosoftGraphCalendarRequestV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 Providergrenze | nicht persistiert; Protokollvertrag |
| `MicrosoftGraphCalendarRequestV1` | `requestId` | `OpaqueIdV1` | ja | eindeutig | M04 Providergrenze | Receiptpersistenz Q-M04-006 |
| `MicrosoftGraphCalendarRequestV1` | `correlationId` | `OpaqueIdV1` | ja | Ende-zu-Ende-Korrelation | M04 Providergrenze | Receiptpersistenz Q-M04-006 |
| `MicrosoftGraphCalendarRequestV1` | `scope` | `TechnicalScopeV1` | ja | tenant-/connectiongebunden | M04 Providergrenze | nicht persistiert; Protokollvertrag |
| `MicrosoftGraphCalendarRequestV1` | `action` | `GraphCalendarActionV1` | ja | Event/Subscription/Delta-Aktion | M04 Providergrenze | nicht persistiert; Protokollvertrag |
| `MicrosoftGraphCalendarRequestV1` | `delegatedIdentityBindingRef` | `OpaqueIdV1` | ja | keine Tokenweitergabe | G10/M04 | nein; Q-M04-004 |
| `MicrosoftGraphCalendarRequestV1` | `calendarBindingRef` | `OpaqueIdV1` | ja | eindeutiger Zielkalender | G10/M04 | nein; Q-M04-003/004 |
| `MicrosoftGraphCalendarRequestV1` | `operationRef` | `OpaqueIdV1\|null` | ja | nur bei Operationsbezug | M04 technisch | Q-M04-006 |
| `MicrosoftGraphCalendarRequestV1` | `externalEventRef` | `OpaqueIdV1\|null` | ja | Pflicht für Update/Delete/Readback | M04 technisch | Q-M04-006 |
| `MicrosoftGraphCalendarRequestV1` | `ifMatchVersion` | `string\|null` | ja | optimistische Providerkonkurrenz | M04 Providergrenze | Q-M04-006 |
| `MicrosoftGraphCalendarRequestV1` | `idempotencyKey` | `string\|null` | ja | hostseitig kanonisch | M04 technisch | Q-M04-006 |
| `MicrosoftGraphCalendarRequestV1` | `deltaCursorRef` | `OpaqueIdV1\|null` | ja | nur Referenz, keine URL im Vertrag | M04 technisch | Q-M04-006 |
| `MicrosoftGraphCalendarRequestV1` | `payloadFingerprint` | `Sha256V1\|null` | ja | redigierter Payloadbeleg | M04 technisch | Q-M04-006 |
| `MicrosoftGraphCalendarResponseV1` | `schemaVersion` | Literal `1.0` | ja | exakt 1.0 | M04 Providergrenze | Receiptpersistenz Q-M04-006 |
| `MicrosoftGraphCalendarResponseV1` | `requestId` | `OpaqueIdV1` | ja | korrespondiert zur Anfrage | M04 Providergrenze | Receiptpersistenz Q-M04-006 |
| `MicrosoftGraphCalendarResponseV1` | `receivedAt` | ISO timestamp | ja | UTC | M04 Providergrenze | Receiptpersistenz Q-M04-006 |
| `MicrosoftGraphCalendarResponseV1` | `status` | integer/null | ja | HTTP-Status oder unbekannt | M04 Providergrenze | Receiptpersistenz Q-M04-006 |
| `MicrosoftGraphCalendarResponseV1` | `providerRequestRef` | `OpaqueIdV1\|null` | ja | redigierte Providerreferenz | M04 Providergrenze | Receiptpersistenz Q-M04-006 |
| `MicrosoftGraphCalendarResponseV1` | `externalEventRef` | `OpaqueIdV1\|null` | ja | Providerobjekt | M04 Providergrenze | Mapping Q-M04-006 |
| `MicrosoftGraphCalendarResponseV1` | `externalVersion` | `string\|null` | ja | Provideretag/-version | M04 Providergrenze | Mapping Q-M04-006 |
| `MicrosoftGraphCalendarResponseV1` | `retryAfterMilliseconds` | integer/null | ja | begrenzt durch Policy | M04 Providergrenze | Receiptpersistenz Q-M04-006 |
| `MicrosoftGraphCalendarResponseV1` | `responseFingerprint` | `Sha256V1\|null` | ja | keine Rohantwort nötig | M04 Providergrenze | Receiptpersistenz Q-M04-006 |
| `MicrosoftGraphCalendarResponseV1` | `outcome` | Enum | ja | `ACCEPTED\|REJECTED\|UNKNOWN\|RETRY` | M04 Providergrenze | Receiptpersistenz Q-M04-006 |
| `GraphCalendarSubscriptionIntentV1` | `subscriptionRef` | `OpaqueIdV1` | ja | interne Referenz | M04 technisch | Q-M04-006 |
| `GraphCalendarSubscriptionIntentV1` | `calendarBindingRef` | `OpaqueIdV1` | ja | Zielkalender | G10/M04 | Q-M04-003/006 |
| `GraphCalendarSubscriptionIntentV1` | `changeTypes` | enum array | ja | CREATED/UPDATED/DELETED | M04 technisch | Q-M04-006 |
| `GraphCalendarSubscriptionIntentV1` | `notificationEndpointRef` | `OpaqueIdV1` | ja | nur Endpointreferenz | M04 technisch | Q-M04-006 |
| `GraphCalendarSubscriptionIntentV1` | `desiredExpirationAt` | ISO timestamp | ja | innerhalb Providergrenze | M04 technisch | Q-M04-006 |
| `GraphCalendarDeltaIntentV1` | `calendarBindingRef` | `OpaqueIdV1` | ja | Zielkalender | G10/M04 | Q-M04-003/006 |
| `GraphCalendarDeltaIntentV1` | `startAt` | ISO timestamp | ja | Fensterbeginn | M04 Policy | Q-M04-003/008 |
| `GraphCalendarDeltaIntentV1` | `endAt` | ISO timestamp | ja | Fensterende nach Start | M04 Policy | Q-M04-003/008 |
| `GraphCalendarDeltaIntentV1` | `committedCursorRef` | `OpaqueIdV1\|null` | ja | durable letzte Position | M04 technisch | Q-M04-006 |
| `GraphCalendarDeltaIntentV1` | `roundRef` | `OpaqueIdV1` | ja | Deltarunde | M04 technisch | Q-M04-006 |
| M04-Job/Outbox (logisch; physischer Tabellenname im Bau) | `tenantId` | `OpaqueIdV1` | ja | jeder Eintrag Kreile-tenantgebunden | M04 technisch | nein; connector-private Tabelle nach Q-M04-006 |
| M04-Job/Outbox (logisch; physischer Tabellenname im Bau) | `jobId` | `OpaqueIdV1` | ja | eindeutig/idempotent | M04 technisch | nein; connector-private Tabelle nach Q-M04-006 |
| M04-Job/Outbox (logisch; physischer Tabellenname im Bau) | `operationRef` | `OpaqueIdV1\|null` | ja | Verweis auf Operation/Notification, kein duplizierter Fachinhalt | M04 technisch | nein; connector-private Tabelle nach Q-M04-006 |
| M04-Job/Outbox (logisch; physischer Tabellenname im Bau) | `state` | Zustand | ja | persistierter Lebenszyklus ohne stillen Verlust; konkrete Enumwerte im Bau an Candidate-Zustände binden | M04 technisch | nein; connector-private Tabelle nach Q-M04-006 |
| M04-Job/Outbox (logisch; physischer Tabellenname im Bau) | `availableAt` | ISO timestamp | ja | persistierter Fälligkeits-/Retryzeitpunkt | M04 technisch | nein; connector-private Tabelle nach Q-M04-006 |
| M04-Job/Outbox (logisch; physischer Tabellenname im Bau) | `lease` | `OperationLeaseRefV1\|null` | ja | Fencing gegen parallele Worker | M04 technisch | nein; connector-private Tabelle nach Q-M04-006 |
| M04-Job/Outbox (logisch; physischer Tabellenname im Bau) | `receiptRef` | `OpaqueIdV1\|null` | ja | Abschluss erst mit durablem Receipt | M04 technisch | nein; connector-private Tabelle nach Q-M04-006 |
| M04-Job/Outbox (logisch; physischer Tabellenname im Bau) | `notificationFingerprint` | `Sha256V1\|null` | ja | eingehende Benachrichtigungen deduplizieren, kein Secret | M04 technisch | nein; connector-private Tabelle nach Q-M04-006 |
| Legacy `calendar_events` | `id` | UUID | ja | Legacy-PK | Legacy, nicht M04 | ja `src/db/schema.ts`, Baseline-Migration |
| Legacy `calendar_events` | `tenant_id` | UUID | ja | RLS/tenantgebunden | Legacy, nicht M04 | ja; RLS in `20260807090000_f0_05_rls_contract_hardening.sql` |
| Legacy `calendar_events` | `order_id` | UUID/null | nein | Legacy-FK | Legacy, nicht M04 | ja; **nicht wiederverwenden** |
| Legacy `calendar_events` | `customer_id` | UUID/null | nein | Legacy-FK | Legacy, nicht M04 | ja; **nicht wiederverwenden** |
| Legacy `calendar_events` | `title` | text | ja | alte freie Inhaltswahrheit | Legacy, nicht M04 | ja; widerspricht neuer Content-Policy |
| Legacy `calendar_events` | `event_type` | text | nein | Legacy | Legacy, nicht M04 | ja |
| Legacy `calendar_events` | `starts_at` | timestamp | ja | Legacy | Legacy, nicht M04 | ja |
| Legacy `calendar_events` | `ends_at` | timestamp/null | nein | Legacy | Legacy, nicht M04 | ja |
| Legacy `calendar_events` | `time_slot` | text/null | nein | Legacy | Legacy, nicht M04 | ja |
| Legacy `calendar_events` | `status` | text | ja | Legacy | Legacy, nicht M04 | ja |
| Legacy `calendar_events` | `source` | text/null | nein | Legacy | Legacy, nicht M04 | ja |
| Legacy `calendar_events` | `source_ref` | text/null | nein | Legacy | Legacy, nicht M04 | ja |
| Legacy `calendar_events` | `created_at` | timestamp | ja | Legacy | Legacy, nicht M04 | ja |

Die Feldliste bildet die im Kandidaten festgelegten Domänen-, Operations-, Signal- und Graph-Protokollobjekte sowie die durch die PL-Entscheidung erforderliche logische Job-/Outbox-Ablage ab. Q-M04-006 klärt die dauerhafte Struktur (connector-private Tabellen/RLS, Supabase Cron, DB-/Edge-Funktionen, Receipts); physische Tabellen-/Spaltennamen sind gewöhnliche Implementierungsdetails der genehmigten Baumission und hier bewusst nicht als vorhandenes Schema behauptet.

## 5. Manifest und Handshake

| Artefakt | Pfad | SHA-256/12 | Aussage |
|---|---|---|---|
| Artefakt-Set | `work/provider-operation-kernel-v1-candidate.3/artifacts/ARTIFACT_HASHES.sha256` | `87015E9ED2CB` | 78/78 gelistete Artefakte lokal hashgleich geprüft. |
| Capability Manifest | `work/provider-operation-kernel-v1-candidate.3/capability.manifest.json` | `2B2FAF86C4A` | Kandidat off-provider; keine Runtimeabhängigkeit und kein realer Adapter. |
| Integration Handshake | `work/provider-operation-kernel-v1-candidate.3/INTEGRATION_HANDSHAKE.json` | `6402AC6CA813` | Fachneutrale Hostpflichten, getrennte Ressourcen und atomare Adoption; Kreile-Abnahmeumfang bestimmt dieses Dossier. |

## 6. APIs und Provider

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Microsoft Graph Kalender, delegiert | Hauptkalender des lizenzierten Kreile-Büropostfachs; Ziel für M04 mindestens `Calendars.ReadWrite`, Least-Privilege-Bestätigung Q-M04-005 | `M365_CALENDAR_TOKEN_CREDENTIAL` (Platzhaltername, kein Wert) | Produktcallback, Tokenablage, Adapter und Consent nicht nachgewiesen; disconnected | Kreile-Ressource, Lizenz, Consent, Benutzer und Scope nur Owner/Admin; Q-M04-014 |
| Microsoft Entra App-Registrierung | delegierte Kalenderberechtigung im Kreile-Tenant; fachfremde Rechte sind keine M04-Voraussetzung | `M365_CLIENT_ID`, `M365_TENANT_ID` (nur Namen) | Kreile-Produktmetadaten am Gate inventarisieren → Q-M04-001/005/014 | Produktivressource/Azure-Abo gehören Kreile; Anlage oder Consent nur Owner |
| Vercel-Webhook-Route | öffentliches HTTPS, Validation, Lifecycle Notifications; schreibt ausschließlich in DB-Queue | `M365_WEBHOOK_CLIENT_STATE` (nur Name) | SPEZ; Route/Queue FEHLT | Providerressource und Vercel Pro erst nach Kosten-/Owner-Gate Q-M04-014 |
| Supabase Cron (`pg_cron`) + DB-/Edge-Funktionen | Job-/Outbox-Verarbeitung, Lease, Retry, Delta, Subscription, Überwachung/Erneuerung der delegierten Anmeldung und Receipts | `DATABASE_URL` (nur Name) | SPEZ; connector-private Tabellen/RLS und Jobs FEHLT | Remote-Migration und Supabase Pro nur ausdrücklich genehmigt; Q-M04-014 |
| Host-Datenbank | keine OAuth-Rechte; RLS und service-seitige Tenantbindung | `DATABASE_URL` (nur Name) | technische M04-Struktur SPEZ, noch nicht gebaut | Remote-Migration/RLS nur ausdrücklich genehmigt |

Aktuelle Microsoft-Dokumentation ist in `09_QUELLEN_AKTUALITAET.md` verzeichnet. Der Builder muss insbesondere `transactionId` zur Provider-Deduplizierung, Immutable IDs, Subscription-Erneuerung, Lifecycle Notifications und kalender-/zeitraumgebundenes Delta berücksichtigen; sie ersetzen nicht die hostseitige Idempotenz und Beweiskette.

## 7. Übertragbarkeit

**Kern app-neutral: ja.** Grund: öffentliche Verträge, technische Zustandsmaschinen, Idempotenz-/Intent-Hash-Regeln, Receipt-/Readback-Prinzip, Retry/Lease/Delta/Subscription-Mechanik, Graph-Protokoll und Fehlerklassifikation enthalten keine Kreile-Fachbegriffe.

**Kreile-spezifisch:** Terminarten, Outlook-Inhalt, Quellfelder, App-Links, Identitäts-/Hauptkalenderbindung, Ressourcen, Retention und Anzeigeorte werden ausschließlich im Kreile-HostAdapter festgelegt. Anpassungen außerhalb Kreile sind nicht Bestandteil dieses Dossiers.
