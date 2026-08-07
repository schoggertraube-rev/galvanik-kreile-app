-- F0-03/05 Parität + Least-Privilege: service_role-ACL an Prod angleichen.
-- Selbst gefundener, entscheidungsfreier Fehler: Supabase-Default-Privileges granten service_role
-- auf neu erzeugten Tabellen VOLL (7 Rechte). Prod haelt service_role auf 4 Telemetrie-/Control-Tabellen
-- bewusst knapp. Richtung = restriktiver = sicher, Prod autoritativ -> REVOKE. Idempotent/replay-safe.

-- app_usage_events: Prod = SELECT
revoke delete, insert, references, trigger, truncate, update on public.app_usage_events from service_role;
-- developer_feedback: Prod = SELECT
revoke delete, insert, references, trigger, truncate, update on public.developer_feedback from service_role;
-- operator_control_events: Prod = INSERT, SELECT
revoke delete, references, trigger, truncate, update on public.operator_control_events from service_role;
-- tenant_operator_controls: Prod = INSERT, SELECT, UPDATE
revoke delete, references, trigger, truncate on public.tenant_operator_controls from service_role;

-- OFFEN (ENTSCHEIDUNG, NICHT hier): ai_usage_reservations, item_photo_jobs, security_rate_limit_counters.
-- Dort ist die Baseline restriktiver (nur REFERENCES/TRIGGER/TRUNCATE), Prod hat service_role VOLL.
-- Parität wuerde GRANT bedeuten; Security spricht fuer Least-Privilege (nur die SECURITY-DEFINER-RPC schreibt).
-- Richtung ist eine Produkt-/Security-Entscheidung -> bewusst ausgelassen.
