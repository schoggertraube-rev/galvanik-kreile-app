# F0_MODULAR_FOUNDATION_MAP — Foundation-Owner, Clients, Importregeln (F0-07)

**Stand:** 2026-08-06. Diese Stufe repariert Grenzen, baut noch keinen Baukasten.

## Foundation-Owner (je genau ein Owner)
| Wahrheit | Owner (Ist) | Status |
|---|---|---|
| Identity/Auth/Session | `src/lib/server/authHelper` (`checkAppAuth`/`checkAppAuthorization`) | kanonisch; server-seitig, Tenant aus Session |
| Database | `src/db` (Drizzle: `schema.ts`, `schema_buchhaltung.ts`, `schema_erfassung.ts`, `schema_marketing.ts`) | ein Zugang `@/db` |
| Storage | Supabase Storage (Buckets, s. F0_STORAGE_CONTRACT) | privat; Signed-URL-Zugriff |
| Offline/Outbox | `src/lib/offline/*` (SyncContext, offlineOutbox) | Containment aktiv (C1) |
| Audit/Telemetry | `audit_log`, `ui_events`, `app_usage_events` | vorhanden |

## Supabase-Clients
- **Kanonisch Browser:** `src/lib/supabase/client.ts` (genau einer). 
- **Kanonisch Server:** `src/lib/supabase/server.ts` (Server Actions via `await createClient()`).
- **Befund (Grenzverletzung):** Direkte `@supabase/supabase-js`-`createClient(url, serviceKey)`-Instanzen
  in `api/erfassung/scan-upload/route.ts` und `item-photo-upload/route.ts` (Service-Role-Adminclient
  ad hoc). **Empfehlung F0-07:** eine kanonische Admin-Client-Factory `src/lib/supabase/admin.ts`
  und CI-Regel gegen direkte `createClient`-Aufrufe außerhalb `lib/supabase/*`.

## Importregeln (Zielvertrag)
1. Modulgrenzen nur über öffentliche TS-Typen, Ports/Provider, Component-Props, versionierte SQL-Views/Functions.
2. Keine Tiefimporte in Modul-Interna.
3. Genau ein kanonischer Browser- und ein Server-Client; ein Admin-Client-Provider.
4. Kreile-Tenant/Rollen/UI-Begriffe nicht in neutrale Foundation-Interna einbrennen.

## Offen für F0-07 PASS
- Admin-Client-Factory + Umbau der zwei Upload-Routen darauf.
- CI-Check: verbotene neue Cross-Imports + verbotene neue Parallel-`createClient`.
- Modulmanifest-Vertrag (Modul-ID, Version, Owner, öffentliche Exporte, Capabilities, Migrationen,
  Views/Functions, Storage-Zwecke, Events, Config, Abhängigkeiten) als validiertes Schema.
- **Keine** Paketextraktion/Massenverschiebung in F0.
