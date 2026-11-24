ALTER TABLE public.stock_locations
  ADD COLUMN parent_id uuid NULL,
  ALTER COLUMN bereich DROP NOT NULL,
  DROP CONSTRAINT stock_locations_bereich_check,
  ADD CONSTRAINT stock_locations_bereich_check CHECK (bereich IS NULL OR btrim(bereich) <> ''),
  ADD CONSTRAINT stock_locations_parent_fk FOREIGN KEY (tenant_id, parent_id)
    REFERENCES public.stock_locations (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_locations_parent_chk CHECK (parent_id IS NULL OR (bereich IS NOT NULL AND parent_id <> id)),
  DROP CONSTRAINT stock_locations_tenant_id_stockwerk_bereich_key;
CREATE UNIQUE INDEX stock_locations_ort_key ON public.stock_locations
  (tenant_id, stockwerk, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), bereich)
  WHERE bereich IS NOT NULL;
CREATE UNIQUE INDEX stock_locations_stockwerk_key ON public.stock_locations (tenant_id, stockwerk)
  WHERE bereich IS NULL;
CREATE INDEX stock_locations_parent_idx ON public.stock_locations (tenant_id, parent_id);
