\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;

CREATE TABLE public.aktion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  UNIQUE (tenant_id, id)
);
CREATE TABLE public.kanal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  UNIQUE (tenant_id, id)
);
CREATE TABLE public.item_photo_jobs (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  order_id text NOT NULL,
  storage_path text NOT NULL,
  uploaded_at timestamptz
);
CREATE TABLE public.marketing_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  quelle text NOT NULL,
  auftrag_id text,
  storage_pfad text NOT NULL,
  typ text NOT NULL,
  freigabe_marketing boolean DEFAULT false,
  UNIQUE (tenant_id, id)
);
CREATE TABLE public.touchpoint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  externe_ref text
);

INSERT INTO public.item_photo_jobs (
  id,
  tenant_id,
  order_id,
  storage_path,
  uploaded_at
) VALUES (
  '30000000-0000-4000-8000-000000000090',
  'galvanik-kreile',
  'marketing-order-preexisting',
  'galvanik-kreile/marketing-order-preexisting/photo.jpg',
  '2097-12-31T08:00:00Z'
);

INSERT INTO public.marketing_asset (
  id,
  tenant_id,
  quelle,
  auftrag_id,
  storage_pfad,
  typ,
  freigabe_marketing
) VALUES (
  '30000000-0000-4000-8000-000000000091',
  'galvanik-kreile',
  'auftragsfoto',
  'marketing-order-preexisting',
  'galvanik-kreile/marketing-order-preexisting/photo.jpg',
  'image',
  true
);

GRANT ALL ON TABLE
  public.aktion,
  public.kanal,
  public.item_photo_jobs,
  public.marketing_asset,
  public.touchpoint
  TO anon, authenticated, service_role;
