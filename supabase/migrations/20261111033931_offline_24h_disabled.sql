-- S03 / A-01: one existing feature flag; disabled until the S06 acceptance.
-- Preserve any already configured row, and never add a second flag store.
INSERT INTO public.feature_flags (id,name,enabled,roles_allowed)
VALUES ('offline_24h','offline_24h',false,ARRAY[]::text[])
ON CONFLICT (id) DO NOTHING;
