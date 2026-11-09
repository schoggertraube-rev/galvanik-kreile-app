-- R2: explicit tenant rules, no guessed defaults and no automatic activation.
ALTER TABLE public.company_settings ADD COLUMN ausgang_regeln jsonb;
ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_output_policy_object CHECK (ausgang_regeln IS NULL OR jsonb_typeof(ausgang_regeln)='object');
COMMENT ON COLUMN public.company_settings.ausgang_regeln IS 'Explicit Ausgang rule configuration; NULL means not configured. Existing shipping-settings writer owns changes.';
