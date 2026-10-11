---
name: project-view-security-invariants
description: Security invariants when reviewing new public/private v_* SQL view contracts in this repo — RLS is NOT the tenant boundary on the app path
metadata:
  type: project
---

When reviewing any new `v_*` view contract: the app's Drizzle connection (`src/db/index.ts`) uses a plain
`DATABASE_URL` Postgres role (locally the `postgres` superuser). That role, like `service_role`, has
BYPASSRLS. Therefore `WITH (security_invoker = true)` contributes **no** tenant enforcement on the app
request path, even though `public.orders` and `public.events` both have RLS enabled.

**Why:** The only SQL-layer tenant boundary for these views is the view's own
`nullif(btrim(current_setting('app.tenant_id', true)), '')` filter plus an explicit `IS NOT NULL` guard
(precedent: `supabase/migrations/20260908101500_werkstatt_kpi_view.sql`). That GUC is installed by
`withPrivilegedTenantTransaction` in `src/lib/server/privilegedDb.ts`. Unset GUC yields NULL, so the
equality predicate drops every row — fail-closed, but only if the guard is actually written.

**How to apply:**
- Never accept "security_invoker makes it fail-closed" as the tenant argument; demand the GUC guard.
- `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT SELECT ... TO service_role` is still required —
  its real job is closing the PostgREST/Data-API surface, not app-path tenant isolation.
- `scripts/quality/check-module-gates.mjs` (Naht 4) accepts a `private.v_*` view exclusively owned by one
  module. Prefer `private.v_*` over `public.v_*` for module-internal read ports and for anything carrying
  finance fields — it is gate-compliant with zero Data-API exposure. Finance precedents:
  `private.v_payment_summary_v1`, `private.v_goods_out_receipt_v2`.
- Finance columns on `public.orders` are gated for `authenticated` by
  `private.current_user_can_view_finance()`; a `public.v_*` view must not route around that gate.
