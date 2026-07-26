\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;

CREATE TABLE public.app_users (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL
);
CREATE TABLE public.orders (
  id text PRIMARY KEY,
  tenant_id varchar(50) NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.items (
  id text PRIMARY KEY,
  tenant_id varchar(50) NOT NULL,
  order_id text NOT NULL,
  current_station_id text,
  created_at timestamptz DEFAULT now()
);
