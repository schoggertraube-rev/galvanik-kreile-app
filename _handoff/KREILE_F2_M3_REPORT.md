# KREILE_F2_M3 Bericht

## Ergebnis

Die Kundenseite rendert jetzt serverseitig mit initialer Datenliste im ersten Frame. Der Customer-Loader macht im Normalfall nur noch genau einen Primärpfad-Aufruf; der Shadow-Diff liegt separat hinter `KREILE_SHADOW_CUSTOMERS`. Der Header liest Rolle, Initialen und Sichtbarkeit aus dem serverseitig gebootstrappten Auth-Snapshot im Context, ohne bei jeder Navigation erneut `resolveAuthorization()` auszulösen.

## Geaenderte Dateien

- `src/app/actions/customers.actions.ts`
- `src/app/actions/__tests__/customers.page-loader.test.ts`
- `src/app/customers/page.tsx`
- `src/app/customers/CustomersPageClient.tsx`
- `src/components/layout/KreileAppShell.tsx`
- `src/lib/auth/PermissionsContext.tsx`
- `src/lib/auth/__tests__/PermissionsContext.test.tsx`
- `src/lib/server/authBootstrap.ts`
- `src/lib/server/authorization.ts`
- `src/lib/server/__tests__/authBootstrap.test.ts`

## Was gebaut wurde

- `getCustomersPageCustomers()` schaltet bei `KREILE_CONTRACT_CUSTOMERS=ON` direkt auf `listCustomersContract()` und faellt nur bei Fehler auf Legacy zurueck.
- Der Shadow-Diff laeuft nur noch bei gesetztem Diagnose-Flag `KREILE_SHADOW_CUSTOMERS`; ohne Diagnose-Flag gibt es keine Doppelquery mehr.
- `/customers` ist von einer Client-Page auf eine Server-Page plus neue Client-Child-Komponente umgestellt worden; Filter, Suche, Overlay und Sync-Reload bleiben funktional gleich.
- `getAuthBootstrapState()` seeded jetzt einen vollstaendigen Authorization-Snapshot in den Permissions-Context.
- `PermissionsProvider` refresht nicht mehr auf jedem `pathname`-Wechsel; Refresh bleibt nur fuer echte Auth-State-Wechsel bzw. explizite Aufrufe erhalten.
- `KreileAppShell` zeigt den Session-Hinweis aus dem Context-Status statt ueber einen Navigations-Roundtrip.

## Gates

- `npx tsc --noEmit` -> Exit 0
- `npm run verify:precommit` -> Exit 0
- `vitest run --exclude "**/*.integration.test.ts"` innerhalb `verify:precommit` -> 20 Dateien, 125 Tests, alles gruen

## Status

- Commit und Push sind noch nicht ausgefuehrt und warten auf deine Freigabe.
