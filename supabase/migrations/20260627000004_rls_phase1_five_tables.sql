-- RLS Phase 1 Migration
-- Skipping table: public.ausgangsrechnung_position (STOP: Missing tenant_id column, reported to Siglinder)

-- 1. Table: events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON events;
CREATE POLICY tenant_isolation ON events
  USING (tenant_id = current_setting('app.tenant_id', true));

-- 2. Table: communications
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON communications;
CREATE POLICY tenant_isolation ON communications
  USING (tenant_id = current_setting('app.tenant_id', true));

-- 3. Table: arbeitszeit_buchung
ALTER TABLE arbeitszeit_buchung ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON arbeitszeit_buchung;
CREATE POLICY tenant_isolation ON arbeitszeit_buchung
  USING (tenant_id = current_setting('app.tenant_id', true));

-- 4. Table: konto
ALTER TABLE konto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON konto;
CREATE POLICY tenant_isolation ON konto
  USING (tenant_id = current_setting('app.tenant_id', true));
