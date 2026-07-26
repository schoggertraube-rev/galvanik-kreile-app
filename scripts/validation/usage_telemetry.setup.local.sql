\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;

CREATE TABLE public.ui_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ui_events ENABLE ROW LEVEL SECURITY;
-- The fixture stays fail-closed even when it is accidentally run outside the
-- disposable validation database. The remediation still has to remove an
-- existing policy and all legacy browser grants.
CREATE POLICY ui_events_legacy_deny ON public.ui_events
  FOR ALL TO public USING (false) WITH CHECK (false);
GRANT ALL ON TABLE public.ui_events TO anon, authenticated, service_role;
