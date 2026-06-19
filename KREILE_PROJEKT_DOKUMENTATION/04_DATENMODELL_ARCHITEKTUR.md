# Kreile — Datenmodell & Architektur

**Quelle:** 03_DATENMODELL_ARCHITEKTUR_BACKEND.md, ANTIGRAVITY_BUILDBRIEF, SPEC 46-E, SPEC 48-A  
**Stand:** 18. Juni 2026

---

## 1. Architektur-Übersicht

```
[Website (Next.js)]          [WerkstattCockpit App (Next.js)]
         │                                    │
         └─────────────┬──────────────────────┘
                       │
              [Supabase Backend]
              ├── PostgreSQL (Hauptdatenbank)
              ├── Auth (Benutzer + Rollen)
              ├── Storage (Fotos, Etiketten)
              ├── Realtime (Live-Updates)
              └── RLS (Row Level Security)
                       │
              [API Layer: Next.js API Routes]
              ├── /api/ocr     (Google Vision)
              ├── /api/scan    (Barcode/QR)
              └── /api/export  (Reports)
```

**Phase 1 (aktuell):** localStorage + IndexedDB  
**Phase 2 (geplant):** Supabase + Drizzle ORM + TanStack Query

---

## 2. Vollständiges Datenbankschema

### Tabelle: customers

```sql
CREATE TABLE customers (
  id          TEXT PRIMARY KEY,    -- cuid2
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,       -- 'private' | 'business' | 'museum' | 'institution'
  email       TEXT,
  phone       TEXT,
  street      TEXT,
  postal_code TEXT,
  city        TEXT,
  country     TEXT DEFAULT 'DE',
  risk_profile TEXT DEFAULT 'low', -- 'low' | 'medium' | 'high'
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  tenant_id   TEXT                 -- für spätere Mandantenfähigkeit
);
```

### Tabelle: orders

```sql
CREATE TABLE orders (
  id              TEXT PRIMARY KEY,
  order_number    TEXT UNIQUE NOT NULL,  -- z.B. A-2025-0160
  customer_id     TEXT REFERENCES customers(id),
  intake_date     TIMESTAMPTZ NOT NULL,
  due_date        TIMESTAMPTZ,
  desired_due_date TIMESTAMPTZ,
  priority        TEXT DEFAULT 'normal',  -- 'normal' | 'high' | 'express'
  status          TEXT DEFAULT 'draft',
  current_risk    TEXT DEFAULT 'green',
  delay_reason    TEXT,
  internal_note   TEXT,
  source          TEXT DEFAULT 'manual',  -- 'manual' | 'scan' | 'email' | 'phone'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabelle: parts (Teile/Objekte)

```sql
CREATE TABLE parts (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT REFERENCES orders(id),
  part_number         TEXT,
  title               TEXT NOT NULL,
  category            TEXT,
  material            TEXT,  -- 'steel' | 'brass' | 'aluminum' | 'zinc_die_cast' | 'unknown'
  target_finish       TEXT,  -- 'chrome' | 'nickel' | 'polish' | 'dechrome' | 'other'
  condition_note      TEXT,
  storage_location    TEXT,
  current_station_id  TEXT REFERENCES stations(id),
  qr_code             TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabelle: stations

```sql
CREATE TABLE stations (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  type            TEXT,  -- 'intake' | 'grinding' | 'polishing' | 'deplating' | 'bath' | 'assembly' | 'shipping'
  capacity_per_day INTEGER,
  sort_order      INTEGER DEFAULT 0,
  active          BOOLEAN DEFAULT TRUE
);

-- Kreile Standard-Stationen:
INSERT INTO stations VALUES
  ('s1', 'Wareneingang',        'wareneingang',       'intake',    20, 1, true),
  ('s2', 'Schleiferei/Politur', 'schleiferei',        'grinding',  10, 2, true),
  ('s3', 'Entmetallisierung',   'entmetallisierung',  'deplating',  8, 3, true),
  ('s4', 'Galvanik',            'galvanik',           'bath',       6, 4, true),
  ('s5', 'Warenausgang',        'warenausgang',       'shipping',  20, 5, true);
```

### Tabelle: work_steps

```sql
CREATE TABLE work_steps (
  id                TEXT PRIMARY KEY,
  part_id           TEXT REFERENCES parts(id),
  station_id        TEXT REFERENCES stations(id),
  title             TEXT NOT NULL,
  status            TEXT DEFAULT 'waiting',  -- 'waiting' | 'ready' | 'in_progress' | 'blocked' | 'done'
  planned_start     TIMESTAMPTZ,
  planned_end       TIMESTAMPTZ,
  actual_start      TIMESTAMPTZ,
  actual_end        TIMESTAMPTZ,
  estimated_minutes INTEGER,
  assigned_to       TEXT,  -- user_id
  blocker_reason    TEXT
);
```

### Tabelle: status_events (Kern der Analytik)

```sql
CREATE TABLE status_events (
  id          TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,   -- 'order' | 'part' | 'workstep'
  entity_id   TEXT NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type  TEXT NOT NULL,   -- Enum: siehe unten
  user_id     TEXT,
  note        TEXT
);

-- Event-Types:
-- 'created', 'scanned', 'station_changed', 'status_changed',
-- 'photo_added', 'deadline_changed', 'blocked', 'completed', 'shipped',
-- 'complaint_opened', 'complaint_closed', 'price_changed'
```

### Tabelle: photos

```sql
CREATE TABLE photos (
  id          TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,  -- 'order' | 'part' | 'scan'
  entity_id   TEXT NOT NULL,
  url         TEXT NOT NULL,  -- Supabase Storage URL
  thumbnail   TEXT,
  type        TEXT DEFAULT 'object',  -- 'intake' | 'object' | 'label' | 'before' | 'after'
  taken_at    TIMESTAMPTZ DEFAULT NOW(),
  user_id     TEXT
);
```

### Tabelle: scan_results

```sql
CREATE TABLE scan_results (
  id           TEXT PRIMARY KEY,
  image_url    TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  scan_type    TEXT,          -- 'shipping_label' | 'object_photo' | 'document' | 'unknown'
  confidence   FLOAT,
  raw_ocr      JSONB,         -- vollständiges OCR-Ergebnis
  extracted    JSONB,         -- strukturierte Felder
  suggestions  JSONB,         -- Matching-Vorschläge
  confirmed_by TEXT,          -- user_id der Bestätigung
  confirmed_at TIMESTAMPTZ,
  order_id     TEXT REFERENCES orders(id),
  customer_id  TEXT REFERENCES customers(id)
);
```

### Tabelle: price_agreements (Preisabsprachen je Kunde)

```sql
CREATE TABLE price_agreements (
  id          TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  description TEXT NOT NULL,
  price       DECIMAL(10,2),
  valid_from  DATE,
  valid_until DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabelle: complaints (Reklamationen)

```sql
CREATE TABLE complaints (
  id          TEXT PRIMARY KEY,
  order_id    TEXT REFERENCES orders(id),
  customer_id TEXT REFERENCES customers(id),
  description TEXT NOT NULL,
  status      TEXT DEFAULT 'open',  -- 'open' | 'in_progress' | 'resolved' | 'rejected'
  resolution  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
```

### Tabelle: inventory (Lager / Chemie)

```sql
CREATE TABLE inventory (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  category       TEXT,   -- 'chemical' | 'material' | 'consumable' | 'tool'
  stock          FLOAT NOT NULL DEFAULT 0,
  unit           TEXT,   -- 'l' | 'kg' | 'pcs' | 'g'
  min_stock      FLOAT,  -- Mindestbestand → Warnung
  last_checked   DATE,
  location       TEXT,
  notes          TEXT
);
```

### Tabelle: bath_logs (Badregelkarte)

```sql
CREATE TABLE bath_logs (
  id          TEXT PRIMARY KEY,
  bath_name   TEXT NOT NULL,
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  parameters  JSONB,   -- { ph: 7.2, temperature: 45, density: 1.8, ... }
  user_id     TEXT,
  notes       TEXT
);
```

---

## 3. RLS-Policies (Supabase)

```sql
-- Alle Tabellen: nur eigener Tenant
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON customers
  USING (tenant_id = current_setting('app.tenant_id'));

-- workers: nur lesen + eigene Einträge erstellen
CREATE POLICY "workers_can_read" ON orders
  FOR SELECT USING (auth.role() IN ('worker', 'manager', 'admin'));

-- manager+admin: vollzugriff
CREATE POLICY "managers_full" ON orders
  USING (auth.role() IN ('manager', 'admin'));
```

---

## 4. API-Routes (Next.js)

| Route | Methode | Funktion |
|---|---|---|
| `/api/ocr` | POST | Bild → OCR → strukturiertes Ergebnis |
| `/api/scan/barcode` | POST | Bild → Barcode/QR erkennen |
| `/api/orders/[id]/events` | POST | StatusEvent schreiben |
| `/api/performance/kpis` | GET | KPIs aus StatusEvents berechnen |
| `/api/export/orders` | GET | CSV/PDF-Export |

---

## 5. Performance-Kennzahlen (Berechnung)

Alle Kennzahlen kommen aus `status_events`. Keine Performance ohne Events.

```typescript
// Termintreue
const termintreue = orders
  .filter(o => o.status === 'done')
  .filter(o => {
    const completedEvent = events.find(e => e.entity_id === o.id && e.event_type === 'completed');
    return completedEvent && new Date(completedEvent.timestamp) <= new Date(o.due_date);
  }).length / doneOrders.length;

// Durchlaufzeit (in Tagen)
const durchlaufzeit = orders
  .filter(o => o.status === 'done')
  .map(o => {
    const completed = events.find(e => e.entity_id === o.id && e.event_type === 'completed');
    return differenceInDays(new Date(completed.timestamp), new Date(o.intake_date));
  });

// Engpassstation
const engpass = stations
  .map(s => ({
    station: s,
    waiting: workSteps.filter(w => w.station_id === s.id && w.status === 'waiting').length
  }))
  .sort((a, b) => b.waiting - a.waiting)[0];
```

---

## 6. Supabase Storage Struktur

```
kreile-storage/
├── photos/
│   ├── orders/{orderId}/{photoId}.jpg
│   ├── parts/{partId}/{photoId}.jpg
│   └── scans/{scanId}/{photoId}.jpg
├── labels/
│   └── {orderId}/etikett_{partId}.pdf
└── reports/
    └── {year}/{month}/report_{date}.pdf
```

---

## 7. Offline-Strategie

```typescript
// IndexedDB-Tabellen (lokal)
const DB_STORES = [
  'orders',        // gecachte Aufträge
  'customers',     // gecachte Kunden
  'sync_queue',    // ausstehende Aktionen
  'photo_queue',   // ausstehende Foto-Uploads
];

// Sync-Logik
class OfflineManager {
  onOnline() {
    // 1. sync_queue abarbeiten
    // 2. photo_queue hochladen
    // 3. lokalen Cache aktualisieren
  }
}
```
