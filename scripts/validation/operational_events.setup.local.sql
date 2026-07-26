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
CREATE TABLE public.events (
  id text PRIMARY KEY,
  tenant_id varchar(50) DEFAULT 'galvanik-kreile',
  order_id text,
  item_id text,
  event_type varchar(100) NOT NULL,
  description text,
  notes text,
  user_id uuid,
  worker_id varchar(100),
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  payload jsonb,
  status varchar(50) DEFAULT 'success',
  station text,
  CONSTRAINT events_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.app_users(id)
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_open ON public.events FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.events TO anon, authenticated, service_role;

INSERT INTO public.orders (id, tenant_id) VALUES ('order-legacy', 'galvanik-kreile');
INSERT INTO public.items (id, tenant_id, order_id, current_station_id)
VALUES ('item-legacy', 'galvanik-kreile', 'order-legacy', 'wareneingang');
INSERT INTO public.events (
  id, tenant_id, order_id, item_id, event_type, status, station
) VALUES (
  'event-legacy', 'galvanik-kreile', 'order-legacy', 'item-legacy',
  'ORDER_CREATED', 'success', 'wareneingang'
);
