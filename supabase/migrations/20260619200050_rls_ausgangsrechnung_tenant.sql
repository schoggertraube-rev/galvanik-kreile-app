-- RLS Tenant-Isolation für ausgangsrechnung + ausgangsrechnung_position
-- CONDITION-002 | 2026-06-19

-- Schritt 1: tenant_id zu ausgangsrechnung
ALTER TABLE ausgangsrechnung
  ADD COLUMN IF NOT EXISTS tenant_id varchar(50) DEFAULT 'galvanik-kreile' NOT NULL;

-- Schritt 2: Backfill
UPDATE ausgangsrechnung
  SET tenant_id = 'galvanik-kreile'
  WHERE tenant_id IS NULL OR tenant_id = '';

-- Schritt 3: Alte offene Policy ersetzen
DROP POLICY IF EXISTS ausgangsrechnung_all ON ausgangsrechnung;
CREATE POLICY tenant_isolation ON ausgangsrechnung
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Schritt 4: RLS auf ausgangsrechnung_position via EXISTS-JOIN
ALTER TABLE ausgangsrechnung_position ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON ausgangsrechnung_position;
CREATE POLICY tenant_isolation ON ausgangsrechnung_position
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ausgangsrechnung ar
      WHERE ar.id = ausgangsrechnung_position.ausgangsrechnung_id
        AND ar.tenant_id = current_setting('app.tenant_id', true)
    )
  );
