-- Existing tenant-owned template source; no existing template or business row is changed.
INSERT INTO public.email_templates(tenant_id,template_key,name,subject_template,body_html_template,body_text_template,variables)
SELECT tenant_id,tenant_id||':reklamation_ergebnis','Reklamation Ergebnis',
 'Ergebnis Ihrer Reklamation {RK-Nummer}',
 '<p>{Kunde},</p><p>zu Ihrer Reklamation {RK-Nummer} teilen wir Ihnen folgendes Ergebnis mit:</p><p>{Ergebnis}<br>{Begründung}</p><p>Mit freundlichen Grüßen</p>',
 E'{Kunde},\n\nzu Ihrer Reklamation {RK-Nummer} teilen wir Ihnen folgendes Ergebnis mit:\n\n{Ergebnis}\n{Begründung}\n\nMit freundlichen Grüßen',
 '["Kunde","RK-Nummer","Ergebnis","Begründung"]'::jsonb
FROM (SELECT DISTINCT tenant_id FROM public.company_settings) tenants
ON CONFLICT(template_key) DO NOTHING;
