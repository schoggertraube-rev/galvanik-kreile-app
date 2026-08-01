-- Migration: kpi_cost_assumptions
-- Konfigurierbare Modellannahmen für Werkstatt-Puls Economics
-- Klar getrennt von Ist-Daten, kein Fake

CREATE TABLE IF NOT EXISTS kpi_cost_assumptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL DEFAULT 'galvanik-kreile',
  key             text NOT NULL,
  value_numeric   numeric(12,4),
  unit            text,
  description     text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (tenant_id, key)
)

ALTER TABLE kpi_cost_assumptions ENABLE ROW LEVEL SECURITY

CREATE POLICY "service_role_all_kpi_cost_assumptions" ON kpi_cost_assumptions
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true)
