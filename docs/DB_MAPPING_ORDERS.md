# Repository Mapping: Supabase vs. App

Dieses Dokument beschreibt exakt, wie die App-Repositories die Supabase-Tabellen nutzen, welche Felder gelesen/geschrieben werden und welche Pflicht- oder Optionsfelder existieren.

## 1. Orders (`ordersRepository.ts`)
- **Tabelle gelesen:** `orders`, inklusive Join auf `items`
- **Tabelle geschrieben:** `orders`

| UI-Feld | App-Feld (Order) | Supabase-Spalte (`orders`) | Lesen | Schreiben | Bemerkung |
|---|---|---|---|---|---|
| Interne ID | `id` | `id` | ✅ | ✅ | Bei INSERT via App generiert. |
| Auftrags-Nr. | `orderNumber` | `order_number` | ✅ | ✅ | Eindeutig. |
| Kunde | `customerId` | `customer_id` | ✅ | ✅ | Pflichtfeld (FK auf customers) |
| Kurzbeschreibung | `title` | `title` | ✅ | ✅ | Standardwert "Unbenanntes Projekt" |
| Notiz (Task) | `task` | `task` | ✅ | ✅ | Optional. |
| Aktuelle Station | `station` / `currentStationId` | `station` / `current_station_id` / `current_station` | ✅ | ✅ | Aktuell chaotisch: Liest aus `current_station`, schreibt aber teils in `current_station_id`. |
| Status | `status` | `status` | ✅ | ✅ | Enum (in_progress, done, etc.) |
| Ampel-Risiko | `risk` | `risk` | ✅ | ✅ | Optional (green, yellow, red) |
| Priorität | `priorityComputed` | `priority_computed` | ✅ | ❌ | Nur gelesen bzw. Backend-Sache |
| Eingangsdatum | `intakeDate` / `rawIntakeDate` | `intake_date` | ✅ | ✅ | Timestamp. Mapping in App repariert (alt: received_at). |
| Liefertermin | `dueDate` / `rawDueDate` | `due_date` | ✅ | ✅ | Optional. Timestamp. |
| Erstellt am | `createdAt` | `created_at` | ✅ | ❌ | Datenbankseitig generiert. |
| Mandant | - | `tenant_id` | ❌ | ✅ | Wird in Actions hart codiert (neu: galvanik-kreile). |

## 2. Items (`itemsRepository.ts` / `orders.actions.ts`)
- **Tabelle gelesen/geschrieben:** `items`

| UI-Feld | App-Feld (Item) | Supabase-Spalte (`items`) | Lesen | Schreiben | Bemerkung |
|---|---|---|---|---|---|
| Interne ID | `id` | `id` | ✅ | ✅ | |
| Bezeichnung | `name` | `name` | ✅ | ✅ | Pflichtfeld |
| Menge | `quantity` | `quantity` | ✅ | ✅ | Integer |
| Ziel-Oberfläche | `surfaceRequested` | *nicht existent* | ❌ | ❌ | Im Schema nicht vorhanden. Fallback auf Default. |
| Auftrags-ID | - | `order_id` | ✅ | ✅ | FK auf orders |
| Mandant | - | `tenant_id` | ❌ | ✅ | |

## 3. Customers (`customersRepository.ts` / `customers.actions.ts`)
- **Tabelle gelesen/geschrieben:** `customers`

| UI-Feld | App-Feld (Customer) | Supabase-Spalte (`customers`) | Lesen | Schreiben | Bemerkung |
|---|---|---|---|---|---|
| ID | `id` | `id` | ✅ | ✅ | |
| Kunden-Nr. | `customerNumber` | `customer_number` | ✅ | ✅ | |
| Name | `name` | `name` | ✅ | ✅ | Pflichtfeld |
| Typ | `type` | `type` | ✅ | ✅ | business/private |
| Stadt | `city` | `city` | ✅ | ✅ | |
| E-Mail | `email` | `email` | ✅ | ✅ | |
| Telefon | `phone` | `phone` | ✅ | ✅ | |
| Mandant | - | `tenant_id` | ❌ | ✅ | |

## 4. Status Events (`statusEventsRepository.ts` / `status-events.actions.ts`)
- **Tabelle gelesen/geschrieben:** `events` (Achtung: Code nannte sie oft `status_events`)

| UI-Feld | App-Feld (Event) | Supabase-Spalte (`events`) | Lesen | Schreiben | Bemerkung |
|---|---|---|---|---|---|
| Event ID | `id` | `id` | ✅ | ✅ | |
| Auftrags-ID | `orderId` | `order_id` | ✅ | ✅ | FK |
| Typ | `eventType` | `event_type` | ✅ | ✅ | |
| Beschreibung | `description` | `description` | ✅ | ✅ | Optional |
| Notiz | `notes` | `notes` | ✅ | ✅ | Optional |
| Erstellt am | `timestamp` / `date` | `created_at` | ✅ | ❌ | DB-generiert |
| Mandant | - | `tenant_id` | ❌ | ✅ | |

---

## Task 5: Sanity-Test in der App (Checkliste)
So kannst du manuell verifizieren, ob alles klappt:
1. Öffne die App im Browser (http://localhost:3001).
2. Gehe in einen beliebigen Auftrag, klicke das Stift-Icon (Bearbeiten-Modal).
3. Ändere die Notiz ("Task") zu "Test-Notiz 123" und setze ein neues Eingangsdatum.
4. Klicke auf "Speichern".
5. **Network-Tab prüfen:** Der PATCH/UPDATE Request an Supabase (`/orders?id=eq.X`) muss mit Status **200** oder **204** antworten.
6. Lade die Seite hart neu (`Strg+F5`).
7. Die Änderung ("Test-Notiz 123" und neues Datum) muss noch da sein.
8. Öffne die URL im Inkognito-Modus: Auch hier muss die Änderung sichtbar sein.
