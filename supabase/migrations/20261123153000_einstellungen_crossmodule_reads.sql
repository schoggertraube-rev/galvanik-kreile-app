-- Narrow, tenant-scoped read seams for the approved settings package.
CREATE VIEW public.v_customers_settings_v1 WITH (security_invoker = true) AS
SELECT tenant_id, id, type, auto_info, marketing_opt_out, kursstichtag
FROM public.customers
WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW public.v_eingang_supplier_invoice_settings_v1 WITH (security_invoker = true) AS
SELECT tenant_id, id
FROM public.supplier_invoice
WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW public.v_accounting_kostenstelle_settings_v1 WITH (security_invoker = true) AS
SELECT tenant_id, kuerzel, ist_aktiv
FROM public.kostenstelle
WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW public.v_eingang_email_template_settings_v1 WITH (security_invoker = true) AS
SELECT tenant_id, id, template_key, subject_template, body_text_template, updated_at
FROM public.email_templates
WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

REVOKE ALL ON public.v_customers_settings_v1,
  public.v_eingang_supplier_invoice_settings_v1,
  public.v_accounting_kostenstelle_settings_v1,
  public.v_eingang_email_template_settings_v1 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.v_customers_settings_v1,
  public.v_eingang_supplier_invoice_settings_v1,
  public.v_accounting_kostenstelle_settings_v1,
  public.v_eingang_email_template_settings_v1 TO service_role;
