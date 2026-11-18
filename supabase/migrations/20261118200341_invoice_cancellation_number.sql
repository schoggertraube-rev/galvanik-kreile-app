-- KORR-S54o K2: one cancellation identity on the existing immutable invoice.
-- No historical original/event/snapshot is rewritten or assigned a number.
ALTER TABLE public.invoices ADD COLUMN cancellation_invoice_number text;
ALTER TABLE public.invoices ADD CONSTRAINT invoice_cancellation_number_shape CHECK (
 cancellation_invoice_number IS NULL OR (
  status='cancelled' AND cancellation_invoice_number ~ '^R-[0-9]{4}-[0-9]{4,}$'
  AND cancellation_invoice_number<>invoice_number
  AND substring(cancellation_invoice_number FROM '^R-([0-9]{4})-')=to_char(cancelled_at AT TIME ZONE 'Europe/Berlin','YYYY')
 ));
CREATE UNIQUE INDEX invoice_cancellation_number_unique ON public.invoices(tenant_id,cancellation_invoice_number) WHERE cancellation_invoice_number IS NOT NULL;
DO $migration$
DECLARE definition text; anchor text:='''cancellation_pdf_sha256'', ''cancellation_pdf_content''';
BEGIN
 SELECT pg_get_functiondef('private.guard_f1_4_invoice_update()'::regprocedure) INTO definition;
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>2 THEN RAISE EXCEPTION 'INVOICE_CANCEL_GUARD_ANCHOR_CHANGED'; END IF;
 EXECUTE replace(definition,anchor,anchor||', ''cancellation_invoice_number''');
END $migration$;
CREATE FUNCTION private.guard_invoice_cancellation_number() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $function$
DECLARE number text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.cancellation_invoice_number IS DISTINCT FROM OLD.cancellation_invoice_number AND NOT (
   OLD.status='issued' AND NEW.status='cancelled' AND OLD.cancellation_invoice_number IS NULL
   AND NEW.cancellation_invoice_number IS NOT NULL AND current_setting('app.invoice_cancel_command',true)='v1'
  ) THEN RAISE EXCEPTION 'INVOICE_CANCELLATION_NUMBER_IMMUTABLE' USING ERRCODE='23514'; END IF;
  IF OLD.status='issued' AND NEW.status='cancelled' AND NEW.snapshot->>'schemaVersion'='3' AND NEW.cancellation_invoice_number IS NULL
   THEN RAISE EXCEPTION 'INVOICE_CANCELLATION_NUMBER_REQUIRED' USING ERRCODE='23514'; END IF;
 ELSIF NEW.cancellation_invoice_number IS NOT NULL THEN
  RAISE EXCEPTION 'INVOICE_CANCELLATION_NUMBER_WITHOUT_ORIGINAL' USING ERRCODE='23514';
 END IF;
 -- Cross-column uniqueness in the same namespace, including legacy inserts.
 -- Same allocator serialises the normal command; this also rejects direct
 -- conflicting writes without introducing another number registry.
 FOREACH number IN ARRAY ARRAY[NEW.invoice_number,NEW.cancellation_invoice_number] LOOP
  IF number IS NOT NULL AND number ~ '^R-[0-9]{4}-[0-9]{4,}$' THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id||':'||number,0));
   IF EXISTS(SELECT 1 FROM public.invoices other WHERE other.tenant_id=NEW.tenant_id AND other.id<>NEW.id
    AND (other.invoice_number=number OR other.cancellation_invoice_number=number)) THEN
    RAISE EXCEPTION 'INVOICE_NUMBER_ALREADY_USED' USING ERRCODE='23505';
   END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION private.guard_invoice_cancellation_number() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER invoice_cancellation_number_guard BEFORE INSERT OR UPDATE ON public.invoices
 FOR EACH ROW EXECUTE FUNCTION private.guard_invoice_cancellation_number();
COMMENT ON COLUMN public.invoices.cancellation_invoice_number IS 'KORR-S54o K2: cancellation BT-1 from the existing shared allocator; historical null stays historical.';
