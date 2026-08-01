-- Migration: KVP Items
-- Erstellt die Tabelle für Betriebliches KVP

CREATE TABLE IF NOT EXISTS public.kvp_items (
    id text PRIMARY KEY,
    tenant_id text DEFAULT 'galvanik-kreile'::text NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    benefit text NOT NULL,
    status text NOT NULL DEFAULT 'neu',
    problem_desc text,
    has_photo boolean DEFAULT false,
    date text,
    is_demo boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
)

ALTER TABLE public.kvp_items ENABLE ROW LEVEL SECURITY

-- Grundlegende RLS Policy für Prototyping
CREATE POLICY "Enable all for public on kvp_items"
ON public.kvp_items
FOR ALL
TO public
USING (true)
