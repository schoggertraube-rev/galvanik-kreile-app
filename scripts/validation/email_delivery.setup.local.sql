\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;

CREATE TABLE public.app_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.customers (id text PRIMARY KEY, tenant_id text NOT NULL DEFAULT 'galvanik-kreile');
CREATE TABLE public.orders (id text PRIMARY KEY, tenant_id text NOT NULL DEFAULT 'galvanik-kreile');
CREATE TABLE public.feedback_mail (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  customer_id text,
  order_id text,
  subject text,
  body text,
  type text,
  channel_type text,
  resend_message_id text,
  status text DEFAULT 'queued',
  opened_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject_template text NOT NULL,
  body_html_template text NOT NULL,
  body_text_template text,
  variables jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON TABLE public.communications, public.email_templates TO anon, authenticated, service_role;
