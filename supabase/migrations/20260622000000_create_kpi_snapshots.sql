-- Migration: 20260622000000_create_kpi_snapshots.sql
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     text NOT NULL DEFAULT 'galvanik-kreile',
  kpi_key       text NOT NULL,
  periode       text NOT NULL,       -- 'woche' | 'monat' | 'quartal' | 'jahr'
  periode_start date NOT NULL,
  wert          numeric,
  einheit       text,                -- '%', 'tage', 'eur', 'anzahl'
  meta          jsonb,               -- z.B. {"n": 25, "station_detail": {...}}
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kpi_key, periode, periode_start)
);

-- RLS
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;

-- Analyse read policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kpi_snapshots' AND policyname = 'analyse_read'
  ) THEN
    CREATE POLICY "analyse_read" ON kpi_snapshots FOR SELECT USING (true);
  END IF;
END $$;
