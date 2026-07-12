# KREILE_F2_M1 Bericht

## Ergebnis

Additive Umsetzung fuer den Mandanten-Wrapper, die Produktionskunden-View und das Contract-Skelett ist im Workspace vorhanden und lokal verifiziert.

## Geaenderte Dateien

- `src/lib/server/db/withTenant.ts`
- `src/lib/server/db/__tests__/withTenant.test.ts`
- `src/lib/server/contracts/customersContract.ts`
- `src/lib/server/contracts/__tests__/customersContract.test.ts`
- `supabase/migrations/20260712120000_v_production_customers.sql`

## Was gebaut wurde

- `withTenant<T>(tenantId, fn)` wurde als fail-closed DB-Wrapper angelegt.
- Der Wrapper setzt in einer Transaktion `app.tenant_id` via `set_config(...)`.
- Leerer oder fehlender Tenant wirft hart `TENANT_ID_REQUIRED`.
- Die Migration `v_production_customers` wurde additiv angelegt und spiegelt den tenant-hardcode aus `v_production_orders`.
- `customersContract.list()` liest `v_production_customers` ueber `withTenant(...)`.
- Ein Shadow-Diff-Helfer vergleicht die Resultate gegen den bisherigen `getCustomersDb()`-Pfad und loggt nur die Zusammenfassung `newCount` / `missingCount`.

## Gates

- `cmd /d /c npx tsc --noEmit` -> Exit 0
- `cmd /d /c npm run verify:precommit` -> Exit 0

## Bewusst unveraendert

- Keine bestehende Datei-Funktion wurde entfernt.
- Kein UI-Pfad wurde umgeschaltet.
- Keine `USING(true)`-Policy wurde angefasst.
- Keine Tabelle wurde gedroppt.
- Der Contract ist noch nicht in Seiten verdrahtet.
- Der REMOTE-/Cowork-Schritt fuer die eine Quelle bleibt extern.

## Hinweis

- Commit und Push wurden in dieser Runde nicht ausgefuehrt.
