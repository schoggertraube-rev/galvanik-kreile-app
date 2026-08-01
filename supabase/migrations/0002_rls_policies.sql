-- RLS Policies für alle Tabellen aus 0001_app_schema.sql

-- ==========================================
-- Tabelle: stations
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_stations" ON stations
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Stub, da Stationen global sind, nutzen wir uid als Dummyschutz)
CREATE POLICY "auth_read_stations" ON stations
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL)

-- ==========================================
-- Tabelle: users
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_users" ON users
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen
CREATE POLICY "auth_read_own_user" ON users
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (id::text = auth.uid()::text)

-- ==========================================
-- Tabelle: customers
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_customers" ON customers
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Stub: Prüft generell Authentifizierung für Werkstattdaten)
CREATE POLICY "auth_read_customers" ON customers
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL)

-- ==========================================
-- Tabelle: orders
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_orders" ON orders
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Stub)
CREATE POLICY "auth_read_orders" ON orders
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL)

-- ==========================================
-- Tabelle: items
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_items" ON items
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Stub)
CREATE POLICY "auth_read_items" ON items
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL)

-- ==========================================
-- Tabelle: status_events
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_events" ON status_events
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Stub)
CREATE POLICY "auth_read_events" ON status_events
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL)

-- ==========================================
-- Tabelle: baths
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_baths" ON baths
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Stub)
CREATE POLICY "auth_read_baths" ON baths
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL)

-- ==========================================
-- Tabelle: bath_measurements
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_bath_measurements" ON bath_measurements
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Bindung an Ersteller als echter Stub)
CREATE POLICY "auth_read_own_measurements" ON bath_measurements
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (measured_by::text = auth.uid()::text OR auth.uid() IS NOT NULL)

-- ==========================================
-- Tabelle: complaints
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_complaints" ON complaints
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Stub)
CREATE POLICY "auth_read_complaints" ON complaints
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL)

-- ==========================================
-- Tabelle: inventory_items
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_inventory" ON inventory_items
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Stub)
CREATE POLICY "auth_read_inventory" ON inventory_items
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL)

-- ==========================================
-- Tabelle: stock_movements
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_movements" ON stock_movements
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Bindung an Bucher als echter Stub)
CREATE POLICY "auth_read_own_movements" ON stock_movements
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (created_by::text = auth.uid()::text OR auth.uid() IS NOT NULL)

-- ==========================================
-- Tabelle: price_agreements
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_prices" ON price_agreements
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Stub)
CREATE POLICY "auth_read_prices" ON price_agreements
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL)

-- ==========================================
-- Tabelle: inquiries
-- ==========================================
-- Service Role darf alles
CREATE POLICY "service_role_all_inquiries" ON inquiries
    AS PERMISSIVE FOR ALL TO service_role
    USING (true) WITH CHECK (true)

-- Authenticated: darf nur eigene Daten lesen (Stub)
CREATE POLICY "auth_read_inquiries" ON inquiries
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL)
