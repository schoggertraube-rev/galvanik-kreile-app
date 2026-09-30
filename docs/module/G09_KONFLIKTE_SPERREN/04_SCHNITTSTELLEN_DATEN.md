<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 04 — Schnittstellen und Daten

## Architekturentscheidung innerhalb der bestehenden Struktur

G09 ist ein **Querschnittsvertrag ohne eigene Datenwahrheit**. Fachmodule behalten Sperren, Fakten und Commands. `module.fundament` stellt nur browser-sichere neutrale Typen und reine Sortier-/Deduplogik bereit. Serverseitige Read-Ports der Besitzer liefern vollständige Fakten; der Kreile-AppAdapter ordnet Rollen, Texte und Routen zu. Das vermeidet ein Schattenmodell gemäß D-RES-001.

## Neutraler öffentlicher Vertrag

Geplanter Export aus `src/modules/fundament/public.ts`; Implementierung als reine Logik innerhalb des bestehenden Moduls, keine neue Runtime-Abhängigkeit:

```ts
type ConflictSeverity = "hinweis" | "wichtig" | "dringend" | "blockierend";
type ConflictDisplayState = "data" | "clarification" | "building";
type ResponsibilityRefV1 = {
  kind: "person" | "role";
  key: string;
  label: string;
};

type ConflictItemV1 = {
  key: string;                 // tenant|sourceModule|kind|entityType|entityId
  kind: string;                // versioniert und vom Besitzer-Modul definiert
  severity: ConflictSeverity;
  displayState: ConflictDisplayState;
  sourceModule: string;
  entityType: "order" | "customer" | "invoice" | "calendar" | "system";
  entityId: string;
  orderNumber: string | null;
  customerShortName: string | null;
  title: string;
  reason: string;
  effect: string;
  dueAt: string | null;        // ISO 8601; null wird nie geschätzt
  responsibility: ResponsibilityRefV1;
  sourceUpdatedAt: string;     // ISO 8601
  expectedVersion: number | null;
  correlationId: string | null;
  action: { key: string; label: string; href: string } | null;
};

type ConflictFeedV1 = {
  generatedAt: string;
  completeness: "complete" | "partial";
  failedSources: readonly string[];
  items: readonly ConflictItemV1[];
};
```

`key` ist eine Darstellungsidentität, kein DB-Schlüssel. Freitext, Fälligkeit, Severity oder Assignee gehören bewusst nicht hinein, damit dieselbe Ursache nach Aktualisierung nicht dupliziert wird.
`ResponsibilityRefV1` ist absichtlich generisch; erst der Kreile-HostAdapter setzt Werte wie `rolf` oder `phillip`. Der Fundament-Code enthält diese Namen nicht.

## Angebotene Public-/Server-Ports

| Besitzer | Port/Export | Richtung | Vertrag |
|---|---|---|---|
| `module.fundament` | `ConflictItemV1`, `ConflictFeedV1`, `buildConflictFeedV1` über `public.ts` | browser-sicher | Validiert Pflichtfelder, dedupliziert nach `key`, sortiert deterministisch; keine IO und keine Kreile-Namen. |
| `module.orders` | `readOrderConflictFactsV1` über neu zu ergänzendes `server-public.ts` | server-only, read | Liefert je Auftrag ID/Nummer, Kunde kurz, Lifecycle/Station, `due_date`, Version, Zuweisung, reale Evidenz-/Fotozustände, Oberfläche und Datenstand aus autorisiertem Read-Modell. |
| `module.accounting-minimal` | `readPaymentConflictFactsV1` über server-only Public-Fassade | server-only, read | Liefert nur kanonische Payment Summary, Rechnung, Freeze, Integrität und `goodsOutAllowed`; keine zweite Berechnung im Host. |
| `module.customers` | vorhandene `server-public.ts` erweitert um `readCustomerConflictFactsV1` | server-only, read | Liefert belegte Dubletten-/Kontaktdatenfakten; keine automatische Zusammenführung. |
| `module.calendar` | `CalendarPort.readProjectionV1` und `projectOrderAppointmentV1` | Provider-Adapter | Liest Abwesenheit/Betriebstermin; projiziert Auftragstermin mit stabiler Korrelation und Readback. Bis Provider-E2E geschlossen. |
| Kreile-AppAdapter | `buildKreileConflictFeedV1` | server composition | Führt Besitzer-Ports zusammen und setzt ausschließlich Kreile-Verantwortlichkeit, Texte, Routen und Bereichsfilter. |

Kein Domain-Modul importiert einen AppAdapter. Der AppAdapter importiert ausschließlich die öffentlichen Fassaden, nie private Views oder DB-Clients anderer Module.

## Benötigte Host-Ports

| Host-Port | Muss liefern | Fail-closed-Verhalten |
|---|---|---|
| `AuthorizationPort` | Tenant, Actor, Rollen, Capabilities, aktive Person | Kein Feed und keine Aktion bei fehlender/fremder Bindung. |
| `ClockPort` | `now` plus Zeitzone `Europe/Berlin` | Keine Fristklassifikation bei ungültiger Zeitquelle. |
| `OrdersConflictFactsPort` | Kanonische Auftrags-/Termin-/Stations-/Versions-/Assignment-Fakten | Quelle als fehlgeschlagen markieren; keine Teilwahrheit als komplett ausgeben. |
| `AccountingConflictFactsPort` | Kanonische Payment Summary und Integrität | Finanzstatus `UNAVAILABLE`; niemals „bezahlt/freigegeben“ raten. |
| `CustomersConflictFactsPort` | Belegte Kundenzuordnung und Dublettenfakten | Keine automatische Fusion und keine Warnung aus bloßer Namensähnlichkeit. |
| `CalendarPort` | Connection/Health, letzte Synchronisation, Abwesenheiten, Betriebstermine, Auftragstermine, Personen-/Ressourcenbezug, Provider-Korrelation | `building/error`, keine Aussage „konfliktfrei“, kein Ersatzprovider. |
| `RoutingPort` | Erlaubte Deep-Links zu Auftrag, Kunde, Rechnung, Terminweg | Karte ohne sichere Aktion statt totem/privatem Link. |

## Commands und Ereignisse

| Fall | Besitzer | Command/Ereignis | G09-Verhalten |
|---|---|---|---|
| Stationswechsel | Orders | vorhandener `orderStationCommand`, unveränderliches Stationsereignis | Nur aufrufen/verlinken; `expectedVersion`, `clientEventId`, Receipt und Readback erhalten. |
| Task zuweisen/zurückgeben | Orders | vorhandener `orderTaskAssignmentCommand`; `ORDER_TASK_ASSIGNED_V1`, `ORDER_TASK_HANDED_BACK_V1` | Nur für auftragsbezogene Delegation verwenden. |
| Zahlungsmodus/Zahlung/Warenausgang | Accounting/Orders | vorhandene Payment-/Goods-out-Commands | Sperrgrund aus Besitzerresultat anzeigen, nie lokal nachbilden. |
| Termin ändern | Orders | **zu ergänzen:** `rescheduleOrderCommand`; Ereignis `ORDER_DUE_DATE_CHANGED_V1` mit alter/neuer Frist und Pflichtgrund | Technische Entscheidung innerhalb des bestehenden Orders-Aggregats; atomare Version/Idempotenz, keine neue Tabelle. |
| Auftragstermin projizieren | Calendar | `CalendarPort.projectOrderAppointmentV1` mit Domain-Korrelation | Erst nach erfolgreichem Domain-Receipt; Provider-Readback/Reconciliation, aber keine neue Fachwahrheit. |

## Datenvertrag

| Objekt | Feld | Typ | Pflicht | Constraint | Besitzer-Modul | Ist im Schema (Pfad) |
|---|---|---|---|---|---|---|
| Auftrag | `tenant_id` | text | ja | serverkanonisch `galvanik-kreile`; Cross-Tenant deny | Fundament/Orders | `public.orders`; Baseline + RLS-Härtung |
| Auftrag | `id` | text | ja | mit Tenant eindeutig | Orders | `public.orders`; `src/db/schema.ts` |
| Auftrag | `order_number` | text | ja | eindeutig; Parallelkollision ohne Teilwrite | Orders | `public.orders`; `src/db/schema.ts` |
| Auftrag | `customer_id` | text | ja | Tenant-/Graphkonsistenz | Orders/Customers | `public.orders`; `src/db/schema.ts` |
| Auftrag | `status`, `station`, `current_station` | text | ja | Lifecycle-Vertrag, keine Zeit-/Zahlungswahrheit | Orders | `public.orders`; private operative Views |
| Auftrag | `version` | integer | ja | `> 0`, atomar inkrementiert | Orders | `public.orders`; `src/db/schema.ts` |
| Auftrag | `due_date` | date/timestamp | nein | objektive Frist; keine Schätzung | Orders | `public.orders`; Intake-/operative Views |
| Auftrag | `promised_due_date` | timestamptz | nein | Legacy-/Analysefeld; nicht parallel als G09-Wahrheit verwenden | Orders | `public.orders`; `src/db/schema.ts` |
| Auftrag | `completed_date` | timestamptz | nein | nur vorhandene Abschlusswahrheit | Orders | `public.orders`; `src/db/schema.ts` |
| Teil | `surface_requested` | text | nein | Freitext; nur identische Anzeigegruppen, keine Kompatibilitätsbehauptung | Orders/Intake | `public.items`; `src/db/schema.ts` |
| Teil | Foto-/Evidenzstatus | View-Felder | je Schritt | nur integritätsgeprüfter Evidence-Read-Port | Orders/Intake | private Evidence-/Queue-Views aus W4/F1.3 |
| Kunde | `id`, `name` | text | ja | Tenant-/Graphkonsistenz; Name nur Kurzlabel | Customers | `public.customers`; `src/db/schema.ts` |
| Zahlung | `payment_mode`, `payment_status`, `goods_out_allowed`, `integrity_ok` | View-Felder | ja für Warenausgang | einzig Payment Summary entscheidet | Accounting-minimal | `private.v_payment_summary_v1` und Nachfolger |
| Zuweisung | `assigned_to`, `assigned_by`, `active`, `order_version` | uuid/bool/int | nein | Tenant-FK; ein Zustand je Tenant/Auftrag; delete/truncate guarded | Orders | `private.order_task_assignment_state`, `private.v_order_task_assignment_v1` |
| Ereignis/Receipt | `client_event_id`, `correlation_id`, `aggregate_version`, `event_type` | uuid/int/text | ja bei Write | idempotent, immutable, intentgebunden | Besitzer-Modul/Fundament | `public.events` + private Receipt-Views |
| Kalenderprojektion | `provider_event_id`, `correlation_id`, `starts_at`, `ends_at`, `timezone`, `person_or_resource`, `last_sync` | Provider-Daten | ja für Konfliktprüfung | über `CalendarPort`; kein G09-/DB-Eventstore | Calendar/M365 | **nicht im Zielschema**; Provider PENDING |
| Konfliktkarte | Felder aus `ConflictItemV1` | Runtime DTO | ja | vollständig validiert, flüchtige Projektion | Fundament + HostAdapter | **keine Tabelle**; geplanter Public Contract |
| Kapazität | verfügbare Stunden, Bedarf, Grenzwert | unbekannt | — | darf ohne ratifizierte Quelle nicht existieren | noch ungeklärt | **fehlt → Q-G09-001** |
| Separater Abholtermin | Datum/Zeit | unbekannt | — | nicht aus `due_date` ableiten | Orders/Calendar | **fehlt → Q-G09-003** |

`src/db/schema.ts::calendar_events` ist Legacy-Inventar und **nicht** die Zielwahrheit. G09 liest oder schreibt diese Tabelle nicht; D-ARCH-011 verlangt die M365-Projektion ohne eigenen Event-Speicher.

## Manifest und Handshake

- G09 erhält **kein eigenes** `capability.manifest.json`, weil es kein eigenständiges Fachmodul und keine Capability-/Datenbesitzerin ist.
- Abhängigkeiten werden in den bereits bestehenden Modul- und Architekturverträgen der Besitzer geführt; der `CalendarPort` gehört zu `module.calendar`.
- Der AppAdapter prüft beim Start die serverseitig gelieferten Capability-/Health-Zustände der benötigten Ports. `unavailable` erzeugt `partial/error/building`, nie einen lokalen Fallback.
- Aktueller Stand: Die bestehenden Module exportieren `public.ts`; Orders/Accounting benötigen für G09 klar begrenzte server-only Fassaden. Der M365-Handshake fehlt vollständig.
- Hash-/Versionsregel: Public DTO `V1`; inkompatible Änderung erhält `V2`, keine stille Feldumdeutung.

## Provider

| Dienst | Rechte/Scopes | Secret-Name | Stand | Owner-Grenze |
|---|---|---|---|---|
| Supabase/Postgres/Auth | Nur bestehende serverseitige tenant- und capabilitygebundene Read-/Command-Pfade; kein direkter Browser-DB-Zugriff | Keine neuen G09-Secrets; vorhandene Infrastruktur-Names bleiben beim Fundament | REAL für Fundament-Verträge | Keine Remote-Migration, RLS-Änderung oder Echtdatenänderung ohne ausdrückliche Freigabe. |
| Microsoft 365 Graph | Delegierter benannter Kreile-Büronutzer; Kalender lesen sowie Auftragstermine schreiben, Least Privilege im M04-Vertrag exakt festlegen | Keine G09-Secrets; kanonische Secret-Namen fehlen und werden ausschließlich im M04-Providerpaket festgelegt | PENDING / `M365_NOT_CONNECTED` | Reales Konto, Consent, Tokenablage, Quota/Kosten, Provider-E2E und Tenantbindung benötigen Owner-/externe Bereitstellung; kein app-only Zugriff ohne neue Owner-Freigabe. |
| Vercel | Hosting, keine Fach- oder Kalenderrechte | Keine G09-Secrets | REAL_HOSTING_ONLY | Kein Deployment/Preview aus diesem Dossierauftrag. |

## Outlook-Inhalt nach OE-2609-19

- **Übersicht:** Terminart, Auftragsnummer, Kundenkurzname.
- **Termindetail:** Kunde, Auftrag, Teile/Verfahren, Menge, Notizen, Preise und App-Links zu den vollständigen Informationen.
- Diese Daten dürfen nur in das lizenzierte Kreile-Büropostfach projiziert werden. Der Provideradapter muss Least Privilege, serverseitige Tokenablage, Tenantbindung und nachvollziehbare Korrelation belegen; G09 besitzt keine Tokens.
