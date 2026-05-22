# Kreile WerkstattCockpit — Datenmodell, Architektur und Backend-Entscheidung

## Ziel

Diese Datei definiert die technische Zielarchitektur. Sie erweitert das bestehende Datenmodell um Datenbankfähigkeit, Warenwirtschaft, Badregelkarte, Kamera/OCR, Verbrauchsbuchung und Kundenzeitstrahl.

## Grundentscheidung

Für diese App ist ein relationales Backend sinnvoll.

Begründung:

- Aufträge, Kunden, Teile, Lager, Verbrauch, Bäder und Events haben klare Beziehungen.
- Lagerbewegungen und Verbrauchsbuchungen brauchen Transaktionssicherheit.
- Auswertungen brauchen saubere Abfragen über Zeit, Station, Kunde, Auftragstyp und Material.
- Performance, Nachkalkulation und Engpassanalyse lassen sich mit SQL besser auswerten.

## Empfehlung

### MVP

Noch keine harte Backend-Festlegung im UI-Code.

Stattdessen:

```text
Mockdaten behalten
Data Provider Layer einbauen
Datenmodell finalisieren
UI auf echte Datenstruktur ausrichten
```

### Zielbackend

Postgres als primäre Datenbank.

Mögliche Varianten:

| Option | Bewertung für Kreile |
|---|---|
| Neon Postgres | gut für schlankes Postgres, Branching, schnelle Entwicklung, wenig Admin |
| Supabase | sehr gut, wenn Auth, Storage, Realtime und Postgres aus einer Hand gewünscht sind |
| Firestore | gut für schnelle Realtime-Demos, weniger ideal für relationale Warenwirtschaft und SQL-Analytik |
| eigener Server / On-Prem Postgres | maximale Kontrolle, aber mehr Wartung und Backup-Aufwand |

## Konkrete Empfehlung

Für dieses Projekt:

1. **UI und Datenmodell zuerst mit Mock Provider bauen.**
2. **Postgres-kompatibel modellieren.**
3. **Für produktionsnahe Umsetzung Supabase oder Neon prüfen.**
4. **Wenn möglichst wenig Backend-Baustellen: Supabase.**
5. **Wenn bewusst schlanker Postgres-Kern plus eigene Bausteine: Neon.**

### Neon-Vorteile

- echtes Postgres,
- gut für relationale Daten,
- Branching für Entwicklung/Test,
- wenig Infrastrukturverwaltung,
- gut mit Prisma/Drizzle kombinierbar.

Neon braucht zusätzlich:

- Auth-Lösung,
- Dateispeicher für Fotos/Dokumente,
- API-Layer,
- Rollenmodell.

### Supabase-Vorteile

- Postgres,
- Auth,
- Storage,
- Row Level Security,
- Realtime,
- API-Schnittstellen,
- schneller Full-Stack-Start.

Supabase ist daher für dieses Projekt oft pragmatischer, wenn schnell ein realer Betrieb getestet werden soll.

## Architektur

```text
Frontend PWA / React
├── UI Components
├── Routing
├── State / Query Layer
├── Data Provider Interface
│   ├── MockProvider
│   └── ApiProvider
└── Camera/OCR Client

Backend später
├── API Layer
├── Auth / Rollen
├── Postgres
├── Object Storage
├── OCR Processing
└── Export / Integrationen
```

## Data Provider Pattern

Antigravity soll keine Datenlogik direkt in Komponenten verstreuen.

```ts
interface WorkshopDataProvider {
  getTodaySummary(): Promise<TodaySummary>;
  getStations(): Promise<Station[]>;
  getOrders(filter?: OrderFilter): Promise<Order[]>;
  getOrderById(id: string): Promise<OrderDetail>;
  getCustomerById(id: string): Promise<CustomerDetail>;
  createOrderFromIntake(input: CreateOrderFromIntakeInput): Promise<Order>;
  addStatusEvent(input: CreateStatusEventInput): Promise<StatusEvent>;
  addStockMovement(input: CreateStockMovementInput): Promise<StockMovement>;
  addConsumableUse(input: CreateConsumableUseInput): Promise<ConsumableUse>;
  addWorkTimeLog(input: CreateWorkTimeLogInput): Promise<WorkTimeLog>;
  addBathMeasurement(input: CreateBathMeasurementInput): Promise<BathMeasurement>;
}
```

Dateien:

```text
src/data/WorkshopDataProvider.ts
src/data/mock/mockProvider.ts
src/data/api/apiProvider.ts
src/data/mock/mockData.ts
```

## Kernentitäten

### Customer

```ts
type Customer = {
  id: string;
  customerNumber: string;
  name: string;
  type: "private" | "business" | "institution";
  status?: "normal" | "regular" | "vip" | "sensitive" | "blocked";
  address?: string;
  city?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  communicationPreference?: "phone" | "email" | "whatsapp" | "post" | "unknown";
  priceAgreements?: PriceAgreement[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
```

### Order

```ts
type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  title: string;
  description?: string;
  createdAt: string;
  receivedAt: string;
  dueDate?: string;
  promisedDate?: string;
  currentStationId?: string;
  status:
    | "new"
    | "waiting_approval"
    | "waiting_material"
    | "released"
    | "in_progress"
    | "quality_check"
    | "rework"
    | "ready_shipping"
    | "shipped"
    | "picked_up"
    | "closed";
  priorityManual?: "low" | "normal" | "high" | "express";
  priorityComputed: "in_plan" | "watch" | "light_critical" | "at_risk" | "critical";
  blockerReason?: BlockerReason;
  nextAction?: NextAction;
  itemIds: string[];
  photoIds: string[];
  documentIds: string[];
  internalNotes?: string;
  customerNotes?: string;
  updatedAt: string;
};
```

### Item

```ts
type Item = {
  id: string;
  itemNumber: string;
  orderId: string;
  customerId: string;
  name: string;
  quantity: number;
  material?: string;
  surfaceRequested?: string;
  conditionIn?: string;
  conditionOut?: string;
  currentStationId?: string;
  status:
    | "received"
    | "documented"
    | "waiting"
    | "in_station"
    | "station_done"
    | "quality_ok"
    | "quality_failed"
    | "rework"
    | "packed"
    | "shipped"
    | "closed";
  photoIds: string[];
  isMissing?: boolean;
  isDamaged?: boolean;
  needsRework?: boolean;
  createdAt: string;
  updatedAt: string;
};
```

## Neue Entitäten

### Document / Photo / Attachment

```ts
type Attachment = {
  id: string;
  customerId?: string;
  orderId?: string;
  itemId?: string;
  scanId?: string;
  type:
    | "intake_document"
    | "condition_before"
    | "damage_detail"
    | "condition_after"
    | "packaging"
    | "invoice"
    | "offer"
    | "other";
  storagePath: string;
  mimeType: string;
  fileName?: string;
  capturedAt: string;
  capturedBy?: string;
  ocrText?: string;
};
```

### StatusEvent

```ts
type StatusEvent = {
  id: string;
  orderId?: string;
  itemId?: string;
  customerId?: string;
  stationId?: string;
  eventType: string;
  timestamp: string;
  userId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
};
```

### InventoryItem

```ts
type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  category:
    | "chemical"
    | "consumable"
    | "tooling"
    | "packaging"
    | "spare_part"
    | "other";
  unit: "pcs" | "kg" | "g" | "l" | "ml" | "m" | "min" | "hour";
  currentStock: number;
  minStock?: number;
  reorderPoint?: number;
  storageLocationId?: string;
  supplierId?: string;
  isConsumable: boolean;
  isHazardous?: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### StockMovement

```ts
type StockMovement = {
  id: string;
  inventoryItemId: string;
  movementType:
    | "stock_in"
    | "stock_out"
    | "consumption"
    | "correction"
    | "transfer"
    | "waste";
  quantity: number;
  unit: string;
  orderId?: string;
  itemId?: string;
  stationId?: string;
  reason?: string;
  createdAt: string;
  createdBy: string;
};
```

### ConsumableUse

```ts
type ConsumableUse = {
  id: string;
  orderId: string;
  itemId?: string;
  stationId?: string;
  inventoryItemId: string;
  quantity: number;
  unit: string;
  bookingMethod: "slider" | "manual" | "scan" | "preset";
  createdAt: string;
  createdBy: string;
};
```

### WorkTimeLog

```ts
type WorkTimeLog = {
  id: string;
  orderId: string;
  itemId?: string;
  stationId: string;
  userId?: string;
  activityType:
    | "setup"
    | "sanding"
    | "polishing"
    | "bath_time"
    | "soldering"
    | "quality_check"
    | "packing"
    | "other";
  minutes: number;
  bookingMethod: "slider" | "timer" | "manual";
  createdAt: string;
};
```

### Bath

```ts
type Bath = {
  id: string;
  bathNumber: string;
  name: string;
  processType:
    | "nickel"
    | "chrome"
    | "gold"
    | "silver"
    | "degreasing"
    | "stripping"
    | "other";
  status: "stable" | "watch" | "critical" | "blocked" | "maintenance";
  stationId: string;
  targetValues: BathTargetValues;
  lastMeasurementAt?: string;
  nextMeasurementDueAt?: string;
  notes?: string;
};

type BathTargetValues = {
  temperatureMin?: number;
  temperatureMax?: number;
  phMin?: number;
  phMax?: number;
  concentrationMin?: number;
  concentrationMax?: number;
};
```

### BathMeasurement

```ts
type BathMeasurement = {
  id: string;
  bathId: string;
  measuredAt: string;
  measuredBy?: string;
  temperature?: number;
  ph?: number;
  concentration?: number;
  conductivity?: number;
  visualState?: "clear" | "cloudy" | "contaminated" | "unknown";
  statusAfterMeasurement: "stable" | "watch" | "critical" | "blocked";
  note?: string;
};
```

### BathAddition

```ts
type BathAddition = {
  id: string;
  bathId: string;
  inventoryItemId: string;
  quantity: number;
  unit: string;
  reason: "correction" | "maintenance" | "scheduled" | "manual";
  createdAt: string;
  createdBy: string;
};
```

## Tabellenstruktur für Postgres

Antigravity soll das Modell so strukturieren, dass es später leicht nach SQL migriert werden kann:

```text
customers
orders
items
stations
status_events
attachments
ocr_scans
ocr_extracted_fields
inventory_items
storage_locations
stock_movements
consumable_uses
work_time_logs
baths
bath_measurements
bath_additions
users
roles
actions
communications
complaints
shipments
```

## Prioritäts- und Stationsstatus

Stationen erhalten aggregierte Statuswerte aus Aufträgen, Items, Blockern und Auslastung.

```ts
type StationHealth = {
  stationId: string;
  status: "stable" | "watch" | "at_risk" | "critical";
  waitingItems: number;
  activeItems: number;
  criticalOrders: number;
  mainReason?: string;
};
```

## Speicher für Fotos und Dokumente

Fotos und Dokumente gehören nicht direkt in die Datenbank.

Empfehlung:

- Datenbank speichert Metadaten.
- Objektstorage speichert Dateien.
- `storagePath` verbindet beides.

Mögliche Optionen:

- Supabase Storage,
- S3-kompatibler Storage,
- Cloudflare R2,
- später lokales NAS mit API.

## Rollenmodell

```ts
type UserRole =
  | "admin"
  | "meister"
  | "office"
  | "workshop"
  | "quality"
  | "viewer";
```

Richtlinien:

- Admin: alles.
- Meister: Aufträge, Preise, Badkarte, Verbrauch, Performance.
- Office: Kunden, Aufträge, Kommunikation, Versand.
- Workshop: Stationen, Fotos, Verbrauch, Status.
- Quality: Qualitätskontrolle, Nacharbeit.
- Viewer: nur lesen.

## Integrationsstrategie

### Sofort

- MockProvider bauen.
- Typen sauber definieren.
- UI aus MockProvider lesen lassen.
- Keine Logik in Komponenten verstreuen.

### Später

- API Provider ergänzen.
- Auth anbinden.
- Storage anbinden.
- Datenmigration von Mock zu Datenbank.
- Export für Excel/DATEV/Lexware prüfen.

## Akzeptanzkriterien

- Alle neuen Funktionen sind im Datenmodell abbildbar.
- StatusEvents bleiben zentrale Grundlage.
- Warenwirtschaft ist transaktionsfähig modelliert.
- Badregelkarte ist nicht nur Notizfeld, sondern echte strukturierte Fachkarte.
- Kamera/OCR hat eigene Scan-Entität.
- Material- und Arbeitszeitverbrauch ist auf Auftrag/Teil/Station buchbar.
- Backend kann später gewechselt werden, ohne UI neu zu bauen.
