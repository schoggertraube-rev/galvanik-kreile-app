-- Migration: Entferne legacy USING(true)-Policies die tenant_isolation übersteuerten
-- Migration Engineer | Security Lead | 2026-06-19
-- Remote angewendet via Supabase MCP (apply_migration)
--
-- Hintergrund: PostgreSQL PERMISSIVE-Policies werden mit OR verknüpft.
-- Eine einzige USING(true)-Policy macht alle anderen tenant-Policies wirkungslos.
-- Diese Policies stammen aus früheren Migrations (buchhaltung_core, harden_rls).

-- events: policies only existed in environments with an out-of-band events table.
DO $events$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "public_all_events_final" ON public.events;
    DROP POLICY IF EXISTS "tenant_isolation_events" ON public.events;
  END IF;
END
$events$;

-- ausgangsrechnung: "Allow all actions for public" blockierte tenant_isolation
DROP POLICY IF EXISTS "Allow all actions for public" ON ausgangsrechnung;
