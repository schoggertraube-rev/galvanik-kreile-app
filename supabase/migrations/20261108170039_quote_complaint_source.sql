-- AF-12: one permanent source reference on the existing quote aggregate.
ALTER TABLE private.quotes ADD COLUMN quelle_reklamation_id text,
 ADD CONSTRAINT quotes_complaint_source_tenant_fk FOREIGN KEY(tenant_id,quelle_reklamation_id) REFERENCES public.complaints(tenant_id,id) ON DELETE RESTRICT;
CREATE INDEX quotes_complaint_source_idx ON private.quotes(tenant_id,quelle_reklamation_id) WHERE quelle_reklamation_id IS NOT NULL;
CREATE FUNCTION private.protect_quote_complaint_source_v1() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.quelle_reklamation_id IS NOT NULL AND NEW.quelle_reklamation_id IS DISTINCT FROM OLD.quelle_reklamation_id THEN
   RAISE EXCEPTION 'QUOTE_COMPLAINT_SOURCE_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF NEW.quelle_reklamation_id IS NOT DISTINCT FROM OLD.quelle_reklamation_id THEN RETURN NEW; END IF;
 END IF;
 IF NEW.quelle_reklamation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.complaints c WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.quelle_reklamation_id AND c.customer_id=NEW.customer_id AND c.bewertung='abgelehnt') THEN
  RAISE EXCEPTION 'QUOTE_REJECTED_COMPLAINT_SOURCE_REQUIRED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $fn$;
REVOKE ALL ON FUNCTION private.protect_quote_complaint_source_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.protect_quote_complaint_source_v1() TO service_role;
CREATE TRIGGER quote_complaint_source_guard BEFORE INSERT OR UPDATE ON private.quotes FOR EACH ROW EXECUTE FUNCTION private.protect_quote_complaint_source_v1();
