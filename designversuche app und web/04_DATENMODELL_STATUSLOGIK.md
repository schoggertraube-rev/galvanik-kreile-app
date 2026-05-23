# Kreile WerkstattCockpit — Datenmodell und Statuslogik

## Ziel

Dieses Dokument definiert eine robuste Datenstruktur für die App. Sie soll zunächst mit Mockdaten funktionieren, später aber backendfähig bleiben.

---

## Grundstruktur

Die wichtigsten Entitäten:

- Customer
- Order
- Item
- Station
- StatusEvent
- Photo
- Document
- Action
- Complaint/Rework
- Shipment

---

## Customer

```ts
type Customer = {
  id: string;
  customerNumber: string;
  name: string;
  type: "private" | "business" | "institution";
  city?: string;
  address?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  notes?: string;
  priceAgreements?: PriceAgreement[];
  communicationPreference?: "phone" | "email" | "whatsapp" | "post" | "unknown";
  createdAt: string;
  updatedAt: string;
};
```

---

## Order

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

  priorityManual?: "low" | "normal" | "high" | "express";
  priorityComputed: "in_plan" | "watch" | "light_critical" | "at_risk" | "critical";

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

  currentStationId?: string;
  itemIds: string[];
  documentIds: string[];
  photoIds: string[];
  eventIds: string[];
  actionIds: string[];

  blockerReason?: BlockerReason;
  nextAction?: NextAction;

  internalNotes?: string;
  customerNotes?: string;

  updatedAt: string;
};
```

---

## Item

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
  eventIds: string[];

  isMissing?: boolean;
  isDamaged?: boolean;
  needsRework?: boolean;

  createdAt: string;
  updatedAt: string;
};
```

---

## Station

```ts
type Station = {
  id: string;
  name:
    | "Wareneingang"
    | "Prüfung / Vorerfassung"
    | "Fotodokumentation"
    | "Angebot / Freigabe"
    | "Schleiferei / Politur"
    | "Galvanische Bäder"
    | "Chemische Entlackung"
    | "Qualitätskontrolle"
    | "Endmontage / Verpackung"
    | "Versand / Abholung";

  sortOrder: number;

  capacityTarget?: number;
  currentLoad?: number;
  waitingItems?: number;
  status: "free" | "stable" | "high" | "critical" | "overloaded";

  expectedDurationHours?: number;
};
```

---

## StatusEvent

```ts
type StatusEvent = {
  id: string;
  orderId?: string;
  itemId?: string;
  customerId?: string;

  eventType:
    | "ORDER_CREATED"
    | "ITEM_ADDED"
    | "OCR_SCAN_COMPLETED"
    | "PHOTO_CAPTURED"
    | "LABEL_PRINTED"
    | "CUSTOMER_APPROVAL_REQUESTED"
    | "CUSTOMER_APPROVAL_RECEIVED"
    | "MATERIAL_MISSING"
    | "MATERIAL_RECEIVED"
    | "STATION_STARTED"
    | "STATION_COMPLETED"
    | "QUALITY_CHECK_STARTED"
    | "QUALITY_CHECK_PASSED"
    | "QUALITY_CHECK_FAILED"
    | "REWORK_STARTED"
    | "REWORK_COMPLETED"
    | "READY_FOR_SHIPPING"
    | "SHIPPED"
    | "PICKED_UP"
    | "ORDER_CLOSED";

  stationId?: string;
  timestamp: string;
  userId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
};
```

---

## Photo

```ts
type Photo = {
  id: string;
  orderId?: string;
  itemId?: string;
  customerId?: string;

  type:
    | "condition_before"
    | "damage_detail"
    | "process"
    | "condition_after"
    | "packaging"
    | "document"
    | "other";

  url: string;
  caption?: string;
  capturedAt: string;
  capturedBy?: string;
};
```

---

## Action / Maßnahme

```ts
type Action = {
  id: string;
  orderId?: string;
  itemId?: string;
  stationId?: string;

  type:
    | "contact_customer"
    | "request_approval"
    | "check_material"
    | "reprioritize"
    | "start_rework"
    | "add_photo"
    | "plan_batch"
    | "ship_order"
    | "other";

  title: string;
  description?: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  assignedTo?: string;
  dueAt?: string;
  createdAt: string;
  completedAt?: string;
};
```

---

## BlockerReason

```ts
type BlockerReason =
  | "customer_approval"
  | "material_missing"
  | "station_overload"
  | "quality_issue"
  | "documentation_missing"
  | "technical_clarification"
  | "external_processing"
  | "unknown";
```

---

## NextAction

```ts
type NextAction = {
  label: string;
  actionType:
    | "call_customer"
    | "send_email"
    | "add_photo"
    | "start_station"
    | "complete_station"
    | "request_approval"
    | "resolve_blocker"
    | "start_quality_check"
    | "start_rework"
    | "ship"
    | "none";
  urgency: "low" | "medium" | "high" | "critical";
};
```

---

## Prioritätsberechnung

### Eingangsgrößen

- `dueDate`
- `currentStation`
- `stationLoad`
- `waitingTimeInStation`
- `status`
- `blockerReason`
- `manualPriority`
- `expectedRemainingDuration`
- `customerType`
- `hasQualityIssue`

### Logik

```ts
function computePriority(order: Order): Priority {
  if (order.status === "rework") return "critical";
  if (order.hasQualityIssue) return "critical";
  if (isOverdue(order.dueDate)) return "critical";

  if (order.blockerReason === "customer_approval" && waitingLongerThan(order, 48)) {
    return "at_risk";
  }

  if (order.blockerReason === "material_missing" && waitingLongerThan(order, 24)) {
    return "at_risk";
  }

  if (expectedRemainingDuration(order) > timeUntilDue(order)) {
    return "at_risk";
  }

  if (dueWithin(order, 24)) return "light_critical";
  if (dueWithin(order, 72)) return "watch";

  return "in_plan";
}
```

---

## Statusfarben

```ts
const statusColors = {
  in_plan: {
    label: "Im Plan",
    color: "green",
    icon: "circle"
  },
  watch: {
    label: "Beobachten",
    color: "yellow",
    icon: "alert-small"
  },
  light_critical: {
    label: "Leicht kritisch",
    color: "orange",
    icon: "triangle"
  },
  at_risk: {
    label: "Gefährdet",
    color: "deep-orange",
    icon: "warning"
  },
  critical: {
    label: "Kritisch",
    color: "red",
    icon: "octagon-alert"
  },
  waiting: {
    label: "Wartet",
    color: "blue-gray",
    icon: "pause"
  }
};
```

---

## Stationsauslastung

### Berechnung

```ts
stationLoadPercent = (currentLoad / capacityTarget) * 100
```

### Status

```ts
function computeStationStatus(loadPercent: number) {
  if (loadPercent > 95) return "overloaded";
  if (loadPercent > 80) return "critical";
  if (loadPercent > 60) return "high";
  return "stable";
}
```

---

## Nächste Aktion berechnen

```ts
function computeNextAction(order: Order): NextAction {
  if (order.blockerReason === "customer_approval") {
    return {
      label: "Kunde kontaktieren",
      actionType: "call_customer",
      urgency: "high"
    };
  }

  if (order.blockerReason === "material_missing") {
    return {
      label: "Material klären",
      actionType: "check_material",
      urgency: "high"
    };
  }

  if (order.status === "new") {
    return {
      label: "Auftrag prüfen",
      actionType: "resolve_blocker",
      urgency: "medium"
    };
  }

  if (order.status === "quality_check") {
    return {
      label: "Qualität prüfen",
      actionType: "start_quality_check",
      urgency: "medium"
    };
  }

  if (order.status === "ready_shipping") {
    return {
      label: "Versand abschließen",
      actionType: "ship",
      urgency: "medium"
    };
  }

  return {
    label: "Details öffnen",
    actionType: "none",
    urgency: "low"
  };
}
```

---

## Performance-Kennzahlen

### Termintreue

```text
Termintreue = pünktlich abgeschlossene Aufträge / alle abgeschlossenen Aufträge
```

### Durchlaufzeit

```text
Durchlaufzeit = Abschlusszeitpunkt - Wareneingangszeitpunkt
```

### Stationswartezeit

```text
Wartezeit Station = Start Station - Eingang in Station
```

### Reklamationsquote

```text
Reklamationsquote = reklamierte Aufträge / abgeschlossene Aufträge
```

### Scanquote

```text
Scanquote = Aufträge mit OCR/Scan / alle neuen Aufträge
```

### Dokumentationsquote

```text
Dokumentationsquote = Teile mit vollständigen Fotos / relevante Teile
```

### Engpassstation

```text
Engpassstation = Station mit höchster gewichteter Kombination aus Auslastung, Wartezeit und kritischen Aufträgen
```

---

## Mockdaten-Anforderung

Mockdaten sollen realistisch sein:

- mehrere Kundentypen,
- alte und neue Aufträge,
- kritische und grüne Fälle,
- wartende Freigaben,
- Materialmangel,
- Reklamationsfall,
- mehrere Teile pro Auftrag,
- Fotos als Platzhalter,
- Stationen mit verschiedenen Auslastungen.

Beispielkunden:

- Museum Lenzburg
- Atelier Schmid
- Kirche St. Martin
- Privatkunde Lenz
- Antik Galerie Main

Beispielaufträge:

- Stoßstangen vernickeln
- Motorradteile BMW R75 verchromen
- Besteckteile versilbern
- Jugendstilleuchter brünieren
- Möbelbeschläge vergolden

---

## Implementationshinweis

Alle Status- und Farblogiken zentral definieren. Keine verstreuten Farbcodes in einzelnen Komponenten.

Empfohlen:

- `constants/status.ts`
- `constants/stations.ts`
- `lib/priority.ts`
- `lib/performance.ts`
- `components/status/StatusBadge.tsx`
- `components/heatmap/StationHeatmap.tsx`
