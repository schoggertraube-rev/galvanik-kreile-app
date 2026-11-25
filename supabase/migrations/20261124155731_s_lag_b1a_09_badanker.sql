-- P2/L4: vorhandene Bad- und Messwerttabellen an die explizite Mandantenidentität anbinden.
BEGIN;
ALTER TABLE public.baths ADD COLUMN tenant_id text;

DO $zuordnung$
DECLARE standmandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
BEGIN
  -- Mehrere belegte Mandanten zu einem früher globalen Bad sind mehrdeutig.
  IF EXISTS (
    SELECT 1 FROM public.bath_measurements messung
    JOIN public.baths bad ON bad.id = messung.bath_id
    GROUP BY bad.id HAVING count(DISTINCT messung.tenant_id) > 1
  ) THEN
    RAISE EXCEPTION 'LAGER_BAD_MANDANT_MEHRDEUTIG';
  END IF;

  UPDATE public.baths bad
  SET tenant_id = coalesce((
    SELECT min(nullif(btrim(messung.tenant_id), '')) FROM public.bath_measurements messung
    WHERE messung.bath_id = bad.id
  ), standmandant);

  IF EXISTS (SELECT 1 FROM public.baths WHERE tenant_id IS NULL) THEN
    RAISE EXCEPTION 'LAGER_BAD_EXPLIZITER_MANDANT_FEHLT';
  END IF;
END;
$zuordnung$;

ALTER TABLE public.baths
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT baths_lager_mandant_chk CHECK (tenant_id <> '' AND btrim(tenant_id) = tenant_id),
  ADD CONSTRAINT baths_lager_mandant_id_key UNIQUE (tenant_id, id);

ALTER TABLE public.bath_measurements
  ADD CONSTRAINT bath_measurements_lager_bad_fk FOREIGN KEY (tenant_id, bath_id)
    REFERENCES public.baths (tenant_id, id) ON DELETE RESTRICT NOT VALID;
CREATE INDEX bath_measurements_lager_tenant_bad_zeit_idx
  ON public.bath_measurements (tenant_id, bath_id, measured_at DESC, id);

ALTER TABLE public.baths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bath_measurements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_baths ON public.baths;
DROP POLICY IF EXISTS service_role_bath_measurements ON public.bath_measurements;

CREATE POLICY baths_lager_mandant ON public.baths
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));
CREATE POLICY bath_measurements_lager_mandant ON public.bath_measurements
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));

REVOKE ALL ON TABLE public.baths, public.bath_measurements FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON TABLE public.baths TO service_role;
GRANT SELECT, INSERT ON TABLE public.bath_measurements TO service_role;

ALTER TABLE public.stock_locations
  ADD COLUMN orttyp text NOT NULL DEFAULT 'lager',
  ADD COLUMN bad_id text,
  ADD CONSTRAINT stock_locations_lager_bad_typ_chk CHECK (
    (orttyp IN ('lager','werkstatt') AND bad_id IS NULL)
    OR (orttyp = 'bad_prozess' AND bad_id IS NOT NULL)
  ),
  ADD CONSTRAINT stock_locations_lager_bad_fk FOREIGN KEY (tenant_id, bad_id)
    REFERENCES public.baths (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_locations_lager_bad_ort_key UNIQUE (tenant_id, id, bad_id);
CREATE UNIQUE INDEX stock_locations_lager_bad_key ON public.stock_locations (tenant_id, bad_id)
  WHERE bad_id IS NOT NULL;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_lager_bad_ort_fk FOREIGN KEY (tenant_id, ort_id, bad_id)
    REFERENCES public.stock_locations (tenant_id, id, bad_id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_movements_lager_badzugabe_chk CHECK (
    geschaeftsgrund IS DISTINCT FROM 'badzugabe' OR (movement_type = 'move' AND (
      (quantity > 0 AND bad_id IS NOT NULL AND bestandsart = 'werkstatt_prozess')
      OR (quantity < 0 AND bad_id IS NULL)
    ))
  );
COMMIT;
