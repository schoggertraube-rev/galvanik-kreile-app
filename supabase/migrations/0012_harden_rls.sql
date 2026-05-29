-- 0012_harden_rls.sql

-- ==========================================
-- 1. orders
-- ==========================================
-- Drop old permissive policies
DROP POLICY IF EXISTS "service_role_all_orders" ON orders;
DROP POLICY IF EXISTS "auth_read_orders" ON orders;
DROP POLICY IF EXISTS "allow_all_update_orders" ON orders;
DROP POLICY IF EXISTS "allow_all_insert_orders" ON orders;
DROP POLICY IF EXISTS "allow_all_select_orders" ON orders;

-- Create tenant_id based policy
CREATE POLICY tenant_isolation_orders ON orders
  FOR ALL TO public
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ==========================================
-- 2. events
-- ==========================================
-- Note: schema.ts uses 'events', earlier migrations used 'status_events'. 
-- We apply this to 'events' (assuming the table was renamed or is 'events').
DROP POLICY IF EXISTS "service_role_all_events" ON events;
DROP POLICY IF EXISTS "auth_read_events" ON events;
DROP POLICY IF EXISTS "tenant_isolation_events" ON events;

CREATE POLICY tenant_isolation_events ON events
  FOR ALL TO public
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Try for status_events just in case it wasn't renamed in DB
DROP POLICY IF EXISTS "service_role_all_events" ON status_events;
DROP POLICY IF EXISTS "auth_read_events" ON status_events;
DROP POLICY IF EXISTS "tenant_isolation_status_events" ON status_events;

CREATE POLICY tenant_isolation_status_events ON status_events
  FOR ALL TO public
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ==========================================
-- 3. inquiries (ensure WITH CHECK exists)
-- ==========================================
DROP POLICY IF EXISTS "service_role_all_inquiries" ON inquiries;
DROP POLICY IF EXISTS "auth_read_inquiries" ON inquiries;
DROP POLICY IF EXISTS "allow_tenant_all_inquiries" ON inquiries;
DROP POLICY IF EXISTS "tenant_isolation_inquiries" ON inquiries;

CREATE POLICY tenant_isolation_inquiries ON inquiries
  FOR ALL TO public
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ==========================================
-- 4. items (ensure WITH CHECK exists)
-- ==========================================
DROP POLICY IF EXISTS "service_role_all_items" ON items;
DROP POLICY IF EXISTS "auth_read_items" ON items;
DROP POLICY IF EXISTS "tenant_isolation_items" ON items;

CREATE POLICY tenant_isolation_items ON items
  FOR ALL TO public
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ==========================================
-- 5. complaints (ensure WITH CHECK exists)
-- ==========================================
DROP POLICY IF EXISTS "service_role_all_complaints" ON complaints;
DROP POLICY IF EXISTS "auth_read_complaints" ON complaints;
DROP POLICY IF EXISTS "tenant_isolation_complaints" ON complaints;

CREATE POLICY tenant_isolation_complaints ON complaints
  FOR ALL TO public
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ==========================================
-- 6. ui_events (ensure WITH CHECK exists)
-- ==========================================
DROP POLICY IF EXISTS "ui_events tenant isolation" ON ui_events;
DROP POLICY IF EXISTS "tenant_isolation_ui_events" ON ui_events;

CREATE POLICY tenant_isolation_ui_events ON ui_events
  FOR ALL TO public
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- The following tables DO NOT have a tenant_id column in schema.ts, 
-- therefore they cannot receive a tenant_isolation policy without schema changes:
-- customers, baths, bath_measurements, inventory_items, stock_movements, 
-- app_users, feature_flags, import_jobs, import_job_rows, audit_log, price_agreements.
