-- Migration: Entferne legacy USING(true)-Policies die tenant_isolation übersteuerten
-- Migration Engineer | Security Lead | 2026-06-19
-- Remote angewendet via Supabase MCP (apply_migration)
--
-- Hintergrund: PostgreSQL PERMISSIVE-Policies werden mit OR verknüpft.
-- Eine einzige USING(true)-Policy macht alle anderen tenant-Policies wirkungslos.
-- Diese Policies stammen aus früheren Migrations (buchhaltung_core, harden_rls).

-- events: public_all_events_final blockierte tenant_isolation
DROP POLICY IF EXISTS "public_all_events_final" ON events;

-- events: tenant_isolation_events war Duplikat von tenant_isolation
DROP POLICY IF EXISTS "tenant_isolation_events" ON events;

-- ausgangsrechnung: "Allow all actions for public" blockierte tenant_isolation
DROP POLICY IF EXISTS "Allow all actions for public" ON ausgangsrechnung;
