-- F0-04: service_role Table-Grants exakt auf Prod-Ist (Paritaet).
-- Prod-verifiziert 2026-08-07 via aclexplode(relacl). GRANT ALL (inkl. PG17 MAINTAIN) + gezielte Ausnahmen.
-- Ersetzt die partielle PROD_SERVICE_ROLE_ACL aus der Baseline autoritativ (laeuft zuletzt).

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA private TO service_role;

-- 3 RPC-Tabellen: kein direktes DML (Zugriff nur via SECURITY-DEFINER-RPC), = Prod.
REVOKE ALL ON public.ai_usage_reservations FROM service_role;
REVOKE ALL ON public.item_photo_jobs FROM service_role;
REVOKE ALL ON public.security_rate_limit_counters FROM service_role;

-- Telemetrie/Control: reduzierte Rechte wie Prod.
REVOKE ALL ON public.app_usage_events FROM service_role;
GRANT SELECT ON public.app_usage_events TO service_role;
REVOKE ALL ON public.developer_feedback FROM service_role;
GRANT SELECT ON public.developer_feedback TO service_role;
REVOKE ALL ON public.operator_control_events FROM service_role;
GRANT INSERT, SELECT ON public.operator_control_events TO service_role;
REVOKE ALL ON public.tenant_operator_controls FROM service_role;
GRANT INSERT, SELECT, UPDATE ON public.tenant_operator_controls TO service_role;
