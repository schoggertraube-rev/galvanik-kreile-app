-- H11: the rights matrix and server authorization share one truth.
-- Developers are not employees and therefore cannot execute business flows.
DELETE FROM public.app_user_rights rights
USING public.app_users users
WHERE users.tenant_id = rights.tenant_id
  AND users.id = rights.user_id
  AND users.role = 'developer'
  AND rights.bereich IN ('auftraege', 'eingang', 'kunden', 'geld', 'kassieren', 'mails');

-- System maintenance remains fixed for every active developer login.
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich)
SELECT users.tenant_id, users.id, areas.bereich
FROM public.app_users users
CROSS JOIN LATERAL unnest(ARRAY['einstellungen', 'logins', 'wartung']::text[]) AS areas(bereich)
WHERE users.active = true
  AND users.role = 'developer'
ON CONFLICT (tenant_id, user_id, bereich) DO NOTHING;

-- The master/owner manages logins. Maintenance remains developer-only.
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich)
SELECT users.tenant_id, users.id, 'logins'
FROM public.app_users users
WHERE users.active = true
  AND users.role = 'meister'
ON CONFLICT (tenant_id, user_id, bereich) DO NOTHING;
