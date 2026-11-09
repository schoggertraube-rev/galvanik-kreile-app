-- PL 09.11. 00:01: use the existing effective-rights register, not runtime role identity.
ALTER TABLE public.app_user_rights DROP CONSTRAINT app_user_rights_bereich_chk;
ALTER TABLE public.app_user_rights ADD CONSTRAINT app_user_rights_bereich_chk CHECK (
 bereich IN ('auftraege','eingang','kunden','geld','kassieren','mails','entscheiden','einstellungen','logins','wartung','statistik_alle'));
INSERT INTO public.app_user_rights(tenant_id,user_id,bereich)
 SELECT tenant_id,id,'statistik_alle' FROM public.app_users WHERE active AND role='admin'
 ON CONFLICT(tenant_id,user_id,bereich) DO NOTHING;
