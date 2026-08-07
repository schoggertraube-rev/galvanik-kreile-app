-- Migration: Add current_station to orders and allow updates

-- 1. Spalte für die Arbeitsstation hinzufügen
ALTER TABLE orders ADD COLUMN IF NOT EXISTS current_station text DEFAULT 'wareneingang';

-- 2. RLS Policies erweitern, damit Benutzer (oder Anon im Dev-Modus) Aufträge bearbeiten können
DROP POLICY IF EXISTS "allow_all_update_orders" ON orders;
CREATE POLICY "allow_all_update_orders" ON orders 
    AS PERMISSIVE FOR UPDATE TO public 
    USING (true) WITH CHECK (true);

-- Erlaube INSERT
DROP POLICY IF EXISTS "allow_all_insert_orders" ON orders;
CREATE POLICY "allow_all_insert_orders" ON orders 
    AS PERMISSIVE FOR INSERT TO public 
    WITH CHECK (true);

-- Erlaube SELECT für alle (falls vorher nur auth ging)
DROP POLICY IF EXISTS "allow_all_select_orders" ON orders;
CREATE POLICY "allow_all_select_orders" ON orders 
    AS PERMISSIVE FOR SELECT TO public 
    USING (true);

-- Lade Cache neu
NOTIFY pgrst, 'reload schema';
