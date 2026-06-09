-- Migration: Add missing columns to baths for process types and target values

ALTER TABLE IF EXISTS baths
  ADD COLUMN IF NOT EXISTS target_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS process_type TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS station_id TEXT;

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
