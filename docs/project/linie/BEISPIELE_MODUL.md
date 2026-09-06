# KREILE — BEISPIEL: so sieht ein korrektes Modul aus (Path 1)

Vorbild-Disziplin: Lerninsel `modules/*/public.ts` (closed-world, CI-erzwungen) — dieselbe Naht kommt nach Kreile. Ein Modul besitzt ALLES seines Fachs an EINEM Ort; Quer-Zugriff nur über die Fassade.

## Ordner-Skelett (verbindlich)
```
src/modules/orders/
  public.ts                      # EINZIGE Fassade — nur was hier re-exportiert wird, darf von außen importiert werden
  orders.manifest.json           # Vertrag des Moduls (siehe unten)
  ui/                            # React-Komponenten dieses Fachs (Auftragskarte etc.)
  server/                        # Commands/Actions ('use server'), Versionsprüfung
  api/                           # route-handler dieses Fachs
  db/                            # Migrations-Referenzen + v_* View-Verträge des Fachs
  __tests__/
```
Nichts von `orders` liegt in `src/components/orders`, `src/lib/orders`, `src/app/orders` o.ä. — sonst ist es kein Modul.

## public.ts — positive Fassade
```ts
// src/modules/orders/public.ts
export type { Order, OrderSummary } from "./server/types";
export { createOrderIntake, setPaymentMode } from "./server/commands";
export { OrderCard } from "./ui/OrderCard";
// NICHTS aus server/db/api direkt exportieren, was intern bleiben soll.
```
Fremdmodul importiert NUR so: `import { OrderSummary } from "@/modules/orders/public"`. Tiefimport `@/modules/orders/server/...` von außen = **BUILD-FEHLER** (dependency-cruiser).

## orders.manifest.json — Vertrag (Schema: MODULE_MANIFEST.schema.json)
```json
{
  "name": "orders",
  "version": "1.0.0",
  "publicExports": ["OrderCard", "createOrderIntake", "setPaymentMode", "Order", "OrderSummary"],
  "events": ["ORDER_INTAKE_V1", "PAYMENT_MODE_SET_V1"],
  "migrations": ["supabase/migrations/*_orders_*.sql"],
  "views": ["private.v_order_summary_v1"],
  "searchIndex": ["order_number", "customer_name", "termin"]
}
```
Jedes Modul MUSS ein valides Manifest haben (CI-FAIL sonst). `searchIndex` erfüllt den Suchvertrag der Suchleiste.

## Tenant — injiziert, NIE Literal
```ts
// verboten (Lint-Fehler): const tenant = 'galvanik-kreile'
// richtig:
import { useTenant } from "@/modules/fundament/public";       // Client
const tenant = useTenant();
// Server: tenant kommt aus resolveAuthorization()/Context, nie hartkodiert.
```

## Cross-Modul-Fakten NUR über v_* + Typen + Props
```ts
// orders liest Kunden-Summary NICHT aus customers-Tabellen, sondern:
import { CustomerSummary } from "@/modules/customers/public";  // Typ + Read-Port v_customer_summary_v1
```
Keine Fremd-Tabellen, kein Fremd-`server/`-Import. Ports gegen echte (auch leere) Daten, nie erfundene (kein Mock).

## Checkliste „Modul fertig" (grün ≠ genug)
1. Ordner `src/modules/<fach>/` enthält ui+server+api+db+manifest+public.ts, nichts außerhalb.
2. Manifest valide; nur `publicExports` von außen erreichbar (Tiefimport build-rot).
3. Kein Tenant-Literal; Tenant injiziert.
4. Cross-Modul nur über `public.ts`/`v_*`.
5. UI (falls Home/Karte) gegen `ui/`-Mock, kein Stationsband.
6. Tests gegen echte/leere Daten. Domänen-Vertrag (F1.x-Bauvertrag) eingehalten.
