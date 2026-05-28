# Database Health Report

Generiert am: 2026-05-27T20:22:05.232Z

## 1. Öffentliche Tabellen
- `bath_measurements`
- `baths`
- `complaints`
- `customers`
- `events`
- `inventory_items`
- `items`
- `locations`
- `orders`
- `price_agreements`
- `stock_movements`
- `users`

## 2. Spalten je Tabelle

### Tabelle: `bath_measurements`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `tenant_id` | `text` | NO | `'galvanik-kreile'::text` |
| `bath_id` | `text` | YES | `null` |
| `measured_at` | `timestamp with time zone` | YES | `now()` |
| `temperature` | `numeric` | YES | `null` |
| `ph_value` | `numeric` | YES | `null` |
| `notes` | `text` | YES | `null` |
| `created_at` | `timestamp with time zone` | YES | `now()` |

### Tabelle: `baths`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `text` | NO | `null` |
| `name` | `text` | NO | `null` |
| `status` | `character varying` | YES | `'stable'::character varying` |
| `last_measured_at` | `timestamp without time zone` | YES | `null` |
| `temperature_max` | `integer` | YES | `null` |
| `temperature_min` | `integer` | YES | `null` |
| `ph_max` | `integer` | YES | `null` |
| `ph_min` | `integer` | YES | `null` |

### Tabelle: `complaints`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `text` | NO | `null` |
| `order_id` | `text` | NO | `null` |
| `customer_id` | `text` | NO | `null` |
| `reason` | `text` | NO | `null` |
| `status` | `character varying` | YES | `'open'::character varying` |
| `created_at` | `timestamp without time zone` | NO | `now()` |

### Tabelle: `customers`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `text` | NO | `null` |
| `customer_number` | `character varying` | YES | `null` |
| `name` | `text` | NO | `null` |
| `type` | `character varying` | NO | `null` |
| `city` | `text` | YES | `null` |
| `address` | `text` | YES | `null` |
| `phone` | `text` | YES | `null` |
| `email` | `text` | YES | `null` |
| `pref_comm` | `character varying` | YES | `null` |
| `risk` | `character varying` | YES | `'Niedrig'::character varying` |
| `risk_note` | `text` | YES | `null` |
| `notes` | `text` | YES | `null` |
| `created_at` | `timestamp without time zone` | NO | `now()` |

### Tabelle: `events`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `text` | NO | `null` |
| `tenant_id` | `character varying` | YES | `'hotel-kreile'::character varying` |
| `order_id` | `text` | NO | `null` |
| `item_id` | `text` | YES | `null` |
| `event_type` | `character varying` | NO | `null` |
| `description` | `text` | YES | `null` |
| `notes` | `text` | YES | `null` |
| `user_id` | `uuid` | YES | `null` |
| `worker_id` | `character varying` | YES | `null` |
| `created_at` | `timestamp without time zone` | NO | `now()` |

### Tabelle: `inventory_items`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `text` | NO | `null` |
| `name` | `text` | NO | `null` |
| `category` | `character varying` | YES | `null` |
| `current_stock` | `integer` | YES | `0` |
| `min_stock` | `integer` | YES | `0` |
| `unit` | `character varying` | YES | `null` |

### Tabelle: `items`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `text` | NO | `null` |
| `tenant_id` | `character varying` | YES | `'hotel-kreile'::character varying` |
| `order_id` | `text` | NO | `null` |
| `customer_id` | `text` | NO | `null` |
| `name` | `text` | NO | `null` |
| `quantity` | `integer` | NO | `1` |
| `current_station_id` | `character varying` | YES | `'wareneingang'::character varying` |
| `created_at` | `timestamp without time zone` | NO | `now()` |

### Tabelle: `locations`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `tenant_id` | `text` | NO | `'galvanik-kreile'::text` |
| `location_code` | `text` | NO | `null` |
| `area` | `text` | NO | `null` |
| `description` | `text` | YES | `null` |
| `active` | `boolean` | YES | `true` |

### Tabelle: `orders`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `text` | NO | `null` |
| `tenant_id` | `character varying` | YES | `'hotel-kreile'::character varying` |
| `order_number` | `text` | NO | `null` |
| `customer_id` | `text` | NO | `null` |
| `title` | `text` | NO | `null` |
| `task` | `text` | YES | `null` |
| `station` | `character varying` | NO | `'wareneingang'::character varying` |
| `current_station_id` | `character varying` | YES | `null` |
| `status` | `character varying` | NO | `'in_progress'::character varying` |
| `risk` | `character varying` | YES | `'green'::character varying` |
| `priority_computed` | `character varying` | YES | `'green'::character varying` |
| `parts` | `jsonb` | YES | `null` |
| `status_text` | `text` | YES | `null` |
| `delay_reason` | `text` | YES | `null` |
| `recommended_action` | `text` | YES | `null` |
| `intake_date` | `timestamp without time zone` | YES | `now()` |
| `due_date` | `timestamp without time zone` | YES | `null` |
| `created_at` | `timestamp without time zone` | NO | `now()` |
| `current_station` | `text` | YES | `'wareneingang'::text` |

### Tabelle: `price_agreements`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `text` | NO | `null` |
| `customer_id` | `text` | NO | `null` |
| `scope` | `text` | NO | `null` |
| `rate` | `text` | NO | `null` |
| `date` | `timestamp without time zone` | NO | `now()` |

### Tabelle: `stock_movements`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `tenant_id` | `text` | NO | `'galvanik-kreile'::text` |
| `inventory_item_id` | `text` | YES | `null` |
| `movement_type` | `text` | NO | `null` |
| `quantity` | `numeric` | NO | `null` |
| `reason` | `text` | YES | `null` |
| `order_id` | `text` | YES | `null` |
| `created_at` | `timestamp with time zone` | YES | `now()` |

### Tabelle: `users`
| Spalte | Datentyp | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `email` | `text` | NO | `null` |
| `full_name` | `text` | NO | `null` |
| `role` | `character varying` | NO | `'workshop'::character varying` |
| `active` | `boolean` | NO | `true` |
| `created_at` | `timestamp without time zone` | NO | `now()` |

## 8 & 9. Übersicht `tenant_id`

**Tabellen MIT `tenant_id`:**
- `bath_measurements`
- `events`
- `items`
- `locations`
- `orders`
- `stock_movements`

**Tabellen OHNE `tenant_id`:**
- `baths`
- `complaints`
- `customers`
- `inventory_items`
- `price_agreements`
- `users`

## 3. Primärschlüssel

| Tabelle | Primärschlüssel |
|---|---|
| `users` | `id` |
| `customers` | `id` |
| `price_agreements` | `id` |
| `orders` | `id` |
| `items` | `id` |
| `events` | `id` |
| `complaints` | `id` |
| `baths` | `id` |
| `inventory_items` | `id` |
| `stock_movements` | `id` |
| `bath_measurements` | `id` |
| `locations` | `id` |

## 4. Fremdschlüssel

| Tabelle | Spalte | Ziel-Tabelle | Ziel-Spalte |
|---|---|---|---|
| `price_agreements` | `customer_id` | `customers` | `id` |
| `orders` | `customer_id` | `customers` | `id` |
| `items` | `order_id` | `orders` | `id` |
| `items` | `customer_id` | `customers` | `id` |
| `events` | `order_id` | `orders` | `id` |
| `events` | `user_id` | `users` | `id` |
| `complaints` | `order_id` | `orders` | `id` |
| `complaints` | `customer_id` | `customers` | `id` |

## 6 & 7. RLS Status und Policies

| Tabelle | RLS Aktiviert |
|---|---|
| `stock_movements` | ✅ Ja |
| `bath_measurements` | ✅ Ja |
| `locations` | ✅ Ja |
| `orders` | ❌ Nein |
| `users` | ❌ Nein |
| `customers` | ❌ Nein |
| `price_agreements` | ❌ Nein |
| `events` | ❌ Nein |
| `items` | ❌ Nein |
| `complaints` | ❌ Nein |
| `baths` | ❌ Nein |
| `inventory_items` | ❌ Nein |

### Aktive Policies
| Tabelle | Policy Name | Command | Roles | Qual | With Check |
|---|---|---|---|---|---|
| `orders` | `allow_all_insert_orders` | `INSERT` | `{public}` | `` | `true` |
| `orders` | `allow_all_select_orders` | `SELECT` | `{public}` | `true` | `` |
| `orders` | `allow_all_update_orders` | `UPDATE` | `{public}` | `true` | `true` |

## 10. Nutzung durch App-Repositories
- `orders` (ordersRepository)
- `items` (itemsRepository, ordersRepository)
- `customers` (customersRepository, ordersRepository)
- `events` (statusEventsRepository)
- `baths` (bathMeasurementsRepository)
- `bath_measurements` (bathMeasurementsRepository)
- `inventory_items` (inventoryRepository)
- `stock_movements` (inventoryRepository)

