-- Migration: Add missing columns to baeder for process types and target values

ALTER TABLE IF EXISTS baeder
  ADD COLUMN IF NOT EXISTS target_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS process_type TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS station_id TEXT;
