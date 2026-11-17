-- S20, PL16.11.07:55: approved existing rights/settings/click source only.
-- PL16.11.14:51: technical entries require verified user and tenant; no anonymous fallback.
ALTER TABLE public.app_user_rights DROP CONSTRAINT app_user_rights_bereich_chk;
ALTER TABLE public.app_user_rights ADD CONSTRAINT app_user_rights_bereich_chk CHECK (
  bereich IN ('auftraege','eingang','kunden','geld','kassieren','mails',
    'entscheiden','einstellungen','logins','wartung','statistik_alle','protokoll'));
INSERT INTO public.app_user_rights(tenant_id,user_id,bereich)
SELECT tenant_id,id,'protokoll' FROM public.app_users WHERE active AND role='admin'
ON CONFLICT(tenant_id,user_id,bereich) DO NOTHING;

ALTER TABLE public.company_settings
  ADD COLUMN protokoll_aufbewahrung_tage integer NULL
    CONSTRAINT company_settings_protokoll_aufbewahrung_tage_chk CHECK (protokoll_aufbewahrung_tage > 0),
  ADD COLUMN protokoll_langsam_ms integer NOT NULL DEFAULT 1000
    CONSTRAINT company_settings_protokoll_langsam_ms_chk CHECK (protokoll_langsam_ms > 0),
  ADD COLUMN protokoll_haenger_ms integer NOT NULL DEFAULT 3000
    CONSTRAINT company_settings_protokoll_haenger_ms_chk CHECK (protokoll_haenger_ms > 0);

ALTER TABLE public.app_usage_events DROP CONSTRAINT app_usage_events_tenant_fixed;
ALTER TABLE public.app_usage_events ADD CONSTRAINT app_usage_events_tenant_fixed
  CHECK (tenant_id = 'galvanik-kreile' OR tenant_id LIKE 'TEST-%') NOT VALID;
GRANT DELETE ON TABLE public.app_usage_events TO service_role;

INSERT INTO public.feature_flags(id,name,enabled,roles_allowed)
VALUES ('logging','logging',true,ARRAY[]::text[])
ON CONFLICT(id) DO NOTHING;
