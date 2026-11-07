-- R53/P101: an overflow intake keeps a tenant-bound, durable link to its source.
-- Existing originals remain immutable and are referenced rather than copied.
ALTER TABLE public.intake_item
  ADD COLUMN fortsetzung_von uuid,
  ADD COLUMN file_id uuid,
  ADD CONSTRAINT intake_continuation_parent_fk
    FOREIGN KEY (tenant_id, fortsetzung_von) REFERENCES public.intake_item(tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT intake_continuation_file_fk
    FOREIGN KEY (tenant_id, file_id) REFERENCES public.intake_file(tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT intake_continuation_not_self CHECK (fortsetzung_von IS NULL OR fortsetzung_von <> id),
  ADD CONSTRAINT intake_continuation_file_parent CHECK (file_id IS NULL OR fortsetzung_von IS NOT NULL);

CREATE INDEX intake_continuation_source_idx ON public.intake_item (tenant_id, fortsetzung_von)
  WHERE fortsetzung_von IS NOT NULL;

CREATE FUNCTION private.check_intake_continuation_file() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF NEW.file_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.intake_file file
    WHERE file.tenant_id = NEW.tenant_id AND file.id = NEW.file_id AND file.item_id = NEW.fortsetzung_von
  ) THEN
    RAISE EXCEPTION 'INTAKE_CONTINUATION_FILE_SOURCE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION private.check_intake_continuation_file() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.check_intake_continuation_file() TO service_role;
CREATE TRIGGER intake_continuation_file_source
  BEFORE INSERT OR UPDATE OF tenant_id, fortsetzung_von, file_id ON public.intake_item
  FOR EACH ROW EXECUTE FUNCTION private.check_intake_continuation_file();
