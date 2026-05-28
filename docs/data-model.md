# Datenmodell-Analyse: Galvanik Kreile (Mock vs. Migration)

Dieses Dokument vergleicht die TypeScript-Typen aus `src/lib/repositories/` und `src/lib/types/` mit dem initialen Supabase-Datenbankschema aus `0000_charming_ken_ellis.sql`.

## Entitäten-Mapping & Lückenanalyse

| Entity (Repo/Table) | Felder (Auszug) | Typen | Required | Beziehungen | Bereits in Migration? | Lücken (Mock ↔ DB) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Customer / `customers`** | name, type, contactPerson, email, phone | string, enum | Ja (name, type) | Keine (im DB-Schema fehlen FKs) | Ja | 🚨 **Im Mock, aber nicht in DB:** `paymentProfile`, `approvalProfile`, `expectationProfile`, `technicalProfile`, `trustLevel`, `internalWarning`, `tags`, `creditRating`.<br>*(Hinweis: Diese tiefen Strukturen fehlen im SQL-Schema völlig)* |
| **Order / `orders`** | orderNumber, customerId, title, status | string, enum | Ja (customer_id, title) | `customerId` -> `customers.id` | Ja | 🚨 **Im Mock, aber nicht in DB:** `parts` (Array in Mock, in DB über `items`), `risk`, `statusText`, `delayReason`, `recommendedAction`.<br>⚠️ **In DB, aber nicht in Repo:** `received_at`, `promised_date`. |
| **Item / `items`** | orderId, name, quantity, material, surfaceRequested | string, number | Ja (orderId, name) | `orderId` -> `orders.id` | Ja | 🚨 **Im Mock, aber nicht in DB:** `photoIds`, `photo` (In DB gibt es dafür die `attachments` Tabelle).<br>⚠️ **In DB, aber nicht in Repo:** `is_missing`, `is_damaged`, `needs_rework`. |
| **StatusEvent / `status_events`**| orderId, eventType, timestamp, metadata | string, jsonb | Ja (eventType) | `orderId`, `itemId` | Ja | 🟢 Weitgehend synchron. Mock nutzt lokales Timestamp-Workaround, DB hat `now()`. |
| **Bath / `baths`** | bathNumber, name, processType, status | string, enum | Ja (bathNumber) | `stationId` -> `stations` | Ja | 🟢 Synchron (`targetValues` ist JSONB in DB). |
| **BathMeasurementLog / `bath_measurements`**| bathId, temperature, ph, concentration | string, float | Ja (bathId) | `bathId` -> `baths` | Ja | 🟢 Synchron. |
| **Complaint / `complaints`** | orderId, reason, description | string | Ja (orderId) | `orderId`, `customerId`| Ja | 🚨 **Im Mock, aber nicht in DB:** `description`, `stationId`, `itemId`. (Die DB hat nur `reason` und `resolution`). |
| **InventoryItem / `inventory_items`**| sku, name, currentStock, minStock | string, float | Ja (sku, name) | - | Ja | 🚨 **Im Mock, aber nicht in DB:** `pricePerUnit`. |
| **StockMovement / `stock_movements`**| inventoryItemId, movementType, quantity | string, float | Ja (inventoryItemId)| `inventoryItemId` | Ja | 🟢 Weitgehend synchron. |
| **PriceAgreement / `price_agreements`**| customerId, title, price, currency | string, float | Ja (customerId, price)| `customerId` | Ja | 🚨 **Im Mock, aber nicht in DB:** `itemPattern`. |
| **QuoteRequest / `inquiries`** | customerName, subject, rustLevel, pricing | string, json | Ja (subject) | `customerId` | ❌ **Nein** | 🚨 **Die Tabelle für Angebote/Anfragen (`QuoteRequest`) fehlt im SQL-Migration-Skript komplett!** |
| **TimelineEntry** | (UI Aggregation) | UI-Model | - | - | ❌ **Nein** | (Ist ein reines Frontend-View-Modell, das Events, Complaints etc. vereint). |

---

### Tabellen in der Migration, die keinem Repo entsprechen:
Folgende Tabellen wurden in `0000_charming_ken_ellis.sql` angelegt, besitzen aber aktuell **kein Repository** im TypeScript-Code und werden in der App nicht aktiv per DB-Logik beschrieben (teils nur lokal gemockt):

1. **`attachments`**: Bilder und Dateien (Im Repo aktuell einfach als `photo` Base64 im `Item` gemockt).
2. **`bath_additions`**: Chemie-Nachfüllungen (Im Repo rudimentär als Typ vorhanden, aber kaum API).
3. **`communications`**: Kunden-Kommunikation.
4. **`consumable_uses`**: Spezifische Verbrauchsbuchungen (Im Code oft über generische `stock_movements` gelöst).
5. **`shipments`**: Versand- und Trackingdaten.
6. **`stations`**: Die Stationen sind im Code als Konstante in `src/constants/stations.ts` hartverdrahtet.
7. **`users`**: Nutzer werden aktuell im Frontend gemockt (`DEMO_USERS`).
8. **`work_time_logs`**: Arbeitszeitbuchungen haben aktuell kein eigenes Repo (Buchung passiert über Events/Mock).
9. **`ocr_scans`**: Scan-Historie (Wird von Gemini verarbeitet, aber nicht persistent als Tabelle lokal gecached).

### Generelle strukturelle Lücken in der Migration:
*   **Foreign Keys fehlen:** Keine einzige Tabelle hat saubere `REFERENCES`-Beziehungen auf Datenbankebene.
*   **Keine RLS-Policies:** Es gibt keine Row Level Security; Datensätze wären ungeschützt.
*   **Tenant-ID Fallback:** `tenant_id` wird fälschlicherweise auf `hotel-kreile` gesetzt (Copy/Paste Relikt).
