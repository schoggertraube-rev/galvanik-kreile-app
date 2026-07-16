\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END
$roles$;

CREATE TABLE public.app_users (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  full_name text NOT NULL,
  kostensatz_eur_pro_stunde numeric(8,2)
);

CREATE TABLE public.orders (
  id text PRIMARY KEY,
  tenant_id text NOT NULL
);

CREATE TABLE public.inventory_items (
  id text PRIMARY KEY,
  tenant_id text,
  name text NOT NULL,
  current_stock integer,
  unit varchar(20),
  einkaufspreis_eur numeric(10,4)
);

CREATE TABLE public.vorlage_zeit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  station_kuerzel text NOT NULL
);

CREATE TABLE public.vorlage_verbrauch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  station_kuerzel text NOT NULL
);

CREATE TABLE public.kostensatz_default (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  station_kuerzel text NOT NULL
);

CREATE TABLE public.teile_klassifikator (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  klasse text NOT NULL
);

CREATE TABLE public.arbeitszeit_buchung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  auftrag_id text NOT NULL REFERENCES public.orders(id),
  employee_id uuid NOT NULL REFERENCES public.app_users(id),
  station_kuerzel text NOT NULL,
  start_zeit timestamptz NOT NULL,
  end_zeit timestamptz,
  dauer_minuten integer NOT NULL,
  kostensatz_eur_pro_stunde numeric(8,2) NOT NULL,
  erstellt_am timestamptz DEFAULT now()
);

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  inventory_item_id text REFERENCES public.inventory_items(id),
  movement_type text NOT NULL,
  quantity numeric NOT NULL,
  order_id text REFERENCES public.orders(id),
  station_kuerzel text,
  erfasst_von uuid REFERENCES public.app_users(id),
  snapshot_einkaufspreis_eur numeric(10,4),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.audit_log (
  id text PRIMARY KEY,
  action text NOT NULL,
  table_name text,
  record_id text,
  actor_id uuid REFERENCES public.app_users(id),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_users (id, tenant_id, full_name, kostensatz_eur_pro_stunde)
VALUES ('11111111-1111-4111-8111-111111111111', 'galvanik-kreile', 'Lokaler Prüfer', 60);

INSERT INTO public.orders (id, tenant_id)
VALUES ('order-local-1', 'galvanik-kreile');

INSERT INTO public.inventory_items (id, tenant_id, name, current_stock, unit, einkaufspreis_eur)
VALUES ('material-local-1', NULL, 'Lokales Prüfmaterial', 5, 'kg', 2.5000);

INSERT INTO public.arbeitszeit_buchung (
  tenant_id, auftrag_id, employee_id, station_kuerzel, start_zeit,
  dauer_minuten, kostensatz_eur_pro_stunde
) VALUES (
  'galvanik-kreile', 'order-local-1', '11111111-1111-4111-8111-111111111111',
  'galvanik', now(), 0, 60
);

INSERT INTO public.audit_log (id, action, payload)
VALUES ('legacy-audit', 'legacy', '{"tenant_id":"galvanik-kreile"}'::jsonb);
