-- Keep the provenance chosen at creation immutable, including for the service role.
CREATE OR REPLACE FUNCTION private.check_intake_continuation_file() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(NEW.tenant_id, NEW.fortsetzung_von, NEW.file_id)
    IS DISTINCT FROM ROW(OLD.tenant_id, OLD.fortsetzung_von, OLD.file_id) THEN
    RAISE EXCEPTION 'INTAKE_CONTINUATION_ORIGIN_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW.file_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.intake_file file
    WHERE file.tenant_id = NEW.tenant_id AND file.id = NEW.file_id AND file.item_id = NEW.fortsetzung_von
  ) THEN
    RAISE EXCEPTION 'INTAKE_CONTINUATION_FILE_SOURCE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;
