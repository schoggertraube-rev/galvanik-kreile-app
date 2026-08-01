-- Entferne legacy-permissive USING(true)-Policies die tenant_isolation übersteuern
-- Migration Engineer | CONDITION-002 Korrektur | 2026-06-19

-- events: public_all_events_final blockiert tenant_isolation
DROP POLICY IF EXISTS "public_all_events_final" ON events;

-- events: tenant_isolation_events ist Duplikat von tenant_isolation (beide gleich), entfernen
DROP POLICY IF EXISTS "tenant_isolation_events" ON events;

-- ausgangsrechnung: "Allow all actions for public" blockiert tenant_isolation
DROP POLICY IF EXISTS "Allow all actions for public" ON ausgangsrechnung;

-- Smoke-Verification: nach dieser Migration sollte
--   SET app.tenant_id='anderer-mandant'; SELECT COUNT(*) FROM events; → 0 liefern
