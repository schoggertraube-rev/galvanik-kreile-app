-- PL 07.11. 20:05: one editable template in the existing tenant-owned source.
INSERT INTO public.email_templates(tenant_id,template_key,name,subject_template,body_html_template,body_text_template,variables)
SELECT tenant_id,tenant_id||':nacharbeit_begleitschein','Nacharbeit · Begleitschein',
 'Nacharbeit {Auftragsnummer} · Ihre Teile',
 '<p>{Kunde},</p><p>für die Nacharbeit {Auftragsnummer} zu Ihrer Reklamation {RK-Nummer} warten wir noch auf Ihre Teile. Bitte geben Sie bei der Rücksendung die Auftragsnummer {Auftragsnummer} an.</p><p>Mit freundlichen Grüßen</p>',
 E'{Kunde},\n\nfür die Nacharbeit {Auftragsnummer} zu Ihrer Reklamation {RK-Nummer} warten wir noch auf Ihre Teile. Bitte geben Sie bei der Rücksendung die Auftragsnummer {Auftragsnummer} an.\n\nMit freundlichen Grüßen',
 '["Kunde","Auftragsnummer","RK-Nummer"]'::jsonb
FROM (SELECT DISTINCT tenant_id FROM public.company_settings) tenants
ON CONFLICT(template_key) DO NOTHING;
