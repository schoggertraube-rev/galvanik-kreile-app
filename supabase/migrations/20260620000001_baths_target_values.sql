-- Migration: Add missing columns to baths for process types and target values

ALTER TABLE IF EXISTS baths
  ADD COLUMN IF NOT EXISTS target_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS process_type TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS station_id TEXT,
  ADD COLUMN IF NOT EXISTS temperature_min numeric(5,2),
  ADD COLUMN IF NOT EXISTS temperature_max numeric(5,2),
  ADD COLUMN IF NOT EXISTS ph_min numeric(4,2),
  ADD COLUMN IF NOT EXISTS ph_max numeric(4,2),
  ADD COLUMN IF NOT EXISTS last_measured_at timestamptz;

UPDATE baths
SET last_measured_at = last_measurement_at
WHERE last_measured_at IS NULL
  AND last_measurement_at IS NOT NULL;

UPDATE baths
SET target_values = jsonb_strip_nulls(
  jsonb_build_object(
    'temperatureMin', temperature_min,
    'temperatureMax', temperature_max,
    'phMin', ph_min,
    'phMax', ph_max
  )
)
WHERE target_values = '{}'::jsonb
  AND (
    temperature_min IS NOT NULL
    OR temperature_max IS NOT NULL
    OR ph_min IS NOT NULL
    OR ph_max IS NOT NULL
  );
