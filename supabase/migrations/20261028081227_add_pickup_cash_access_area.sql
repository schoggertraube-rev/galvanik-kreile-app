-- F0/K28: pickup cash is an independently grantable access area.
-- Existing workshop users stay unchanged; only the approved templates receive it.
ALTER TABLE public.app_user_rights
  DROP CONSTRAINT app_user_rights_bereich_chk,
  ADD CONSTRAINT app_user_rights_bereich_chk CHECK (
    bereich IN ('auftraege', 'eingang', 'kunden', 'geld', 'kassieren', 'mails', 'einstellungen', 'logins', 'wartung')
  );

INSERT INTO public.app_user_rights (tenant_id, user_id, bereich)
SELECT tenant_id, id, 'kassieren'
FROM public.app_users
WHERE role IN ('meister', 'developer')
ON CONFLICT (tenant_id, user_id, bereich) DO NOTHING;
