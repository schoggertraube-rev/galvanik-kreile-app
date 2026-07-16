\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;

CREATE TABLE public.periode (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  jahr integer NOT NULL,
  monat integer NOT NULL,
  status text NOT NULL,
  geschlossen_am timestamp,
  geschlossen_von uuid,
  bemerkung text
);

CREATE TABLE public.beleg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_id uuid REFERENCES public.periode(id),
  konto_id uuid,
  kostenstelle_id uuid,
  status text NOT NULL DEFAULT 'erfasst'
);

CREATE TABLE public.ausgangsrechnung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_id uuid REFERENCES public.periode(id),
  order_id text,
  status text NOT NULL DEFAULT 'offen'
);

CREATE TABLE public.orders (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  completed_date timestamptz,
  db_ist numeric,
  status text NOT NULL
);

CREATE TABLE public.bh_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zeit timestamp NOT NULL DEFAULT now(),
  benutzer uuid NOT NULL,
  entitaet text NOT NULL,
  entitaet_id uuid NOT NULL,
  aktion text NOT NULL,
  vorher jsonb,
  nachher jsonb
);

GRANT ALL ON TABLE public.periode, public.beleg, public.ausgangsrechnung, public.orders, public.bh_audit_log
  TO anon, authenticated, service_role;
