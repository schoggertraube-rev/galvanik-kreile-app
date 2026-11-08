-- AP-REKLA-MAIL RM01: editable template, existing rows remain unchanged.
INSERT INTO public.email_templates(tenant_id,template_key,name,subject_template,body_html_template,body_text_template,variables)
SELECT tenant_id,tenant_id||':reklamation_fotos_anfordern','Reklamation · Fotos anfordern',
 'Ihre Reklamation · Fotos ergänzen',
 '<p>{Kunde},</p><p>bitte antworten Sie auf diese E-Mail mit aussagekräftigen Fotos der beanstandeten Stellen und der betroffenen Teile. So können wir Ihre Reklamation prüfen.</p><p>Mit freundlichen Grüßen</p>',
 E'{Kunde},\n\nbitte antworten Sie auf diese E-Mail mit aussagekräftigen Fotos der beanstandeten Stellen und der betroffenen Teile. So können wir Ihre Reklamation prüfen.\n\nMit freundlichen Grüßen',
 '["Kunde"]'::jsonb
FROM (SELECT DISTINCT tenant_id FROM public.company_settings) tenants
ON CONFLICT(template_key) DO NOTHING;
