-- Migration: 0004_fix_hotel_tenant.sql
-- Purpose: Remove all 'hotel-kreile' defaults and fix existing tenant_id data safely

DO $$ 
BEGIN
    -- 1. Tabelle 'orders'
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tenant_id') THEN
        ALTER TABLE orders ALTER COLUMN tenant_id SET DEFAULT 'galvanik-kreile';
        UPDATE orders SET tenant_id = 'galvanik-kreile' WHERE tenant_id = 'hotel-kreile';
    END IF;

    -- 2. Tabelle 'items'
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'tenant_id') THEN
        ALTER TABLE items ALTER COLUMN tenant_id SET DEFAULT 'galvanik-kreile';
        UPDATE items SET tenant_id = 'galvanik-kreile' WHERE tenant_id = 'hotel-kreile';
    END IF;

    -- 3. Tabelle 'events'
    IF to_regclass('public.events') IS NOT NULL
       AND EXISTS (
         SELECT FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'tenant_id'
       ) THEN
        ALTER TABLE public.events ALTER COLUMN tenant_id SET DEFAULT 'galvanik-kreile';
        UPDATE public.events SET tenant_id = 'galvanik-kreile' WHERE tenant_id = 'hotel-kreile';
    END IF;

END $$;

-- Supabase Schema-Cache neu laden, um Fehler (wie PGRST204) zu vermeiden
NOTIFY pgrst, 'reload schema';
