\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;

CREATE TABLE public.aktion (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.kanal (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.marketing_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_pfad text NOT NULL
);
CREATE TABLE public.touchpoint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  externe_ref text
);

GRANT ALL ON TABLE public.aktion, public.kanal, public.marketing_asset, public.touchpoint
  TO anon, authenticated, service_role;
