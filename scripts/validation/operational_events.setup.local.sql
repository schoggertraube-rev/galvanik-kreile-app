\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;

CREATE TABLE public.orders (id text PRIMARY KEY, tenant_id text, created_at timestamptz DEFAULT now());
CREATE TABLE public.items (id text PRIMARY KEY, tenant_id text, order_id text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE public.events (
  id text PRIMARY KEY,
  tenant_id text,
  order_id text NOT NULL,
  item_id text,
  event_type text NOT NULL,
  payload jsonb,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_open ON public.events FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.events TO anon, authenticated, service_role;
