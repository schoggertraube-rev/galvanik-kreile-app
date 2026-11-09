-- RM08: explicit nullable workday settings; no automatic activation or guessed deadlines.
ALTER TABLE public.company_settings ADD COLUMN rekla_fotos_erinnerung_tage integer;
ALTER TABLE public.company_settings ADD COLUMN rekla_fotos_anruf_tage integer;
ALTER TABLE public.company_settings ADD CONSTRAINT company_photo_reminder_days_valid CHECK (rekla_fotos_erinnerung_tage IS NULL OR rekla_fotos_erinnerung_tage BETWEEN 0 AND 3650);
ALTER TABLE public.company_settings ADD CONSTRAINT company_photo_call_days_valid CHECK (rekla_fotos_anruf_tage IS NULL OR rekla_fotos_anruf_tage BETWEEN 0 AND 3650);
-- Leave the customer-facing body explicitly incomplete until it is filled in the existing editor.
INSERT INTO public.email_templates(tenant_id,template_key,name,subject_template,body_html_template,body_text_template,variables)
SELECT tenant_id,tenant_id||':reklamation_fotos_erinnern','Reklamation · Fotos erinnern','Reklamation · Fotos erinnern','',NULL,'["Kunde"]'::jsonb
FROM (SELECT DISTINCT tenant_id FROM public.company_settings) tenants
ON CONFLICT(template_key) DO NOTHING;
