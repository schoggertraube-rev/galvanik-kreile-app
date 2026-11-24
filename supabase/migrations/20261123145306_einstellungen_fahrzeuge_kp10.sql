-- KP10: ein mandantengebundener Fahrzeugstamm mit nachvollziehbarer Pflege.
CREATE TABLE public.vehicles (
  tenant_id text NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kennzeichen text NOT NULL CHECK (length(btrim(kennzeichen)) BETWEEN 1 AND 24),
  art text NOT NULL CHECK (length(btrim(art)) BETWEEN 1 AND 80),
  kraftstoff text NOT NULL CHECK (length(btrim(kraftstoff)) BETWEEN 1 AND 80),
  tankkarte text CHECK (length(btrim(tankkarte)) BETWEEN 1 AND 80),
  fahrer_id uuid,
  start_km integer NOT NULL CHECK (start_km >= 0),
  aktiv boolean NOT NULL DEFAULT true,
  angelegt_am timestamptz NOT NULL DEFAULT statement_timestamp(),
  angelegt_von uuid NOT NULL,
  geaendert_am timestamptz NOT NULL DEFAULT statement_timestamp(),
  geaendert_von uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,fahrer_id) REFERENCES public.app_users(tenant_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id,angelegt_von) REFERENCES public.app_users(tenant_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id,geaendert_von) REFERENCES public.app_users(tenant_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX vehicles_kennzeichen_eindeutig
  ON public.vehicles(tenant_id, (regexp_replace(upper(kennzeichen), '[[:space:]-]+', '', 'g')));
CREATE INDEX vehicles_aktive_auswahl ON public.vehicles(tenant_id,kennzeichen) WHERE aktiv;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY vehicles_mandant ON public.vehicles
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));
REVOKE ALL ON public.vehicles FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT,INSERT,UPDATE ON public.vehicles TO service_role;
