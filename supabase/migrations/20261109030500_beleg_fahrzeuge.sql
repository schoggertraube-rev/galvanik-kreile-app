-- PL 09.11.2026 02:03: optional invoice vehicle choices, one existing settings truth.
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS beleg_fahrzeuge jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(beleg_fahrzeuge) = 'array');
COMMENT ON COLUMN public.company_settings.beleg_fahrzeuge IS
  'Optional invoice vehicle choices: stable id, label, active; historical invoice names live in existing intake events.';
