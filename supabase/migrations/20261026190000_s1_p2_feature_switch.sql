-- Verkaufsstufe 1 / P2 / S04: tenant-bound switches for every Bauumfang ID.
-- Existing tenants receive stage 1 enabled and connection stages 2-4 disabled.

CREATE TABLE public.tenant_features (
  tenant text NOT NULL,
  feature_id text NOT NULL,
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT tenant_features_pkey PRIMARY KEY (tenant, feature_id),
  CONSTRAINT tenant_features_tenant_chk CHECK (tenant = btrim(tenant) AND length(tenant) BETWEEN 1 AND 50),
  CONSTRAINT tenant_features_id_chk CHECK (feature_id ~ '^[A-Z][0-9]{2}$')
);

ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_features_tenant_isolation ON public.tenant_features
  USING (tenant = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant = nullif(btrim(current_setting('app.tenant_id', true)), ''));

WITH tenants(tenant) AS (
  SELECT DISTINCT tenant_id FROM public.app_users WHERE tenant_id IS NOT NULL
  UNION
  SELECT DISTINCT tenant_id FROM public.company_settings WHERE tenant_id IS NOT NULL
), features(feature_id, enabled) AS (
  VALUES
    ('E01', true), ('E02', true), ('E03', true), ('E04', true), ('E05', true),
    ('A01', true), ('A02', true), ('A03', true), ('A04', true), ('A05', true),
    ('A06', true), ('A07', true), ('A08', true), ('A09', true),
    ('R01', true), ('R02', true), ('R03', true), ('R04', true), ('R05', true),
    ('S01', true), ('S02', true), ('S03', true),
    ('R06', false), ('B01', false), ('B02', false), ('B03', false), ('B04', false), ('B05', false),
    ('W01', false), ('W02', false), ('W04', false), ('W05', false),
    ('Z01', false), ('Z03', false), ('Z04', false)
)
INSERT INTO public.tenant_features (tenant, feature_id, enabled)
SELECT tenants.tenant, features.feature_id, features.enabled
FROM tenants CROSS JOIN features;

REVOKE ALL ON TABLE public.tenant_features FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.tenant_features TO service_role;
