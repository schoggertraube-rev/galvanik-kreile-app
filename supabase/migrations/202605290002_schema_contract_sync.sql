-- ============================================================================
-- Schema Contract Sync Migration
-- Datum: 2026-05-29
-- Zweck: Fehlende Spalten nachziehen, die von Repositories erwartet werden
-- Regel: Rein additiv. Kein DROP, kein ALTER bestehender Spalten-Typen.
-- ============================================================================

-- pgcrypto für gen_random_uuid() (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── customers: ID-Default absichern ─────────────────────────────────────────
ALTER TABLE public.customers ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;

-- ── customers: fehlende Spalten ─────────────────────────────────────────────
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS contact_person text;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS payment_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS expectation_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS technical_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS trust_level text;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS internal_warning text;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_rating text;

-- ── orders: ID-Default absichern ────────────────────────────────────────────
ALTER TABLE public.orders ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;

-- ── items: ID-Default + fehlende Spalte ─────────────────────────────────────
ALTER TABLE public.items ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS surface_requested text;

-- ── PostgREST Schema-Cache neu laden ────────────────────────────────────────
SELECT pg_notify('pgrst', 'reload schema');
