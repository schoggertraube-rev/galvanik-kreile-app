-- ==============================================================================
-- 01_rls_setup.sql - Row Level Security Policies für Kreile WerkstattCockpit
-- ==============================================================================

-- 1. RLS auf allen kritischen Tabellen aktivieren
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE baths ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- 2. Hilfsfunktion zur Rollen-Ermittlung
-- Geht davon aus, dass Supabase auth.uid() dem users.id entspricht
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS text AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid()::text;
$$ LANGUAGE sql SECURITY DEFINER;

-- ==============================================================================
-- KUNDEN (Customers)
-- ==============================================================================
-- Alle (admin, meister, office, workshop, quality, viewer) dürfen Kunden lesen
CREATE POLICY "Jeder darf Kunden lesen" ON customers
FOR SELECT USING (true);

-- Nur admin, meister, office dürfen Kunden anlegen/bearbeiten
CREATE POLICY "Backoffice darf Kunden verwalten" ON customers
FOR ALL USING (auth_user_role() IN ('admin', 'meister', 'office'));

-- ==============================================================================
-- PREISABSPRACHEN (Price Agreements)
-- ==============================================================================
-- Nur admin, meister, office dürfen Preisabsprachen sehen und anlegen
CREATE POLICY "Nur Backoffice sieht Preise" ON price_agreements
FOR ALL USING (auth_user_role() IN ('admin', 'meister', 'office'));

-- ==============================================================================
-- AUFTRÄGE (Orders)
-- ==============================================================================
-- Alle dürfen Aufträge lesen
CREATE POLICY "Jeder darf Aufträge lesen" ON orders
FOR SELECT USING (true);

-- Admin, Meister, Office dürfen Aufträge frei verwalten
CREATE POLICY "Backoffice darf Aufträge verwalten" ON orders
FOR ALL USING (auth_user_role() IN ('admin', 'meister', 'office'));

-- Workshop darf Aufträge nur updaten (Station & Material), aber nicht löschen
CREATE POLICY "Workshop darf Aufträge aktualisieren" ON orders
FOR UPDATE USING (auth_user_role() = 'workshop');

-- ==============================================================================
-- BESTAND (Inventory / Stock Movements)
-- ==============================================================================
-- Jeder darf den Bestand lesen
CREATE POLICY "Bestand ist für alle lesbar" ON inventory_items
FOR SELECT USING (true);

-- Admin, Meister, Office, Workshop dürfen buchen
CREATE POLICY "Operatives Personal darf buchen" ON inventory_items
FOR UPDATE USING (auth_user_role() IN ('admin', 'meister', 'office', 'workshop'));
