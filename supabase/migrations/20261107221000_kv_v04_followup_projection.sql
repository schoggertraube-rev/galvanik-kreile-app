-- KV-09: canonical Task -> quote projection, never two independently editable dates.
CREATE FUNCTION private.quote_followup_key(p_quote uuid,p_edition integer) RETURNS uuid LANGUAGE plpgsql IMMUTABLE STRICT SET search_path='' AS $fn$
DECLARE bytes bytea;
BEGIN
 bytes:=sha256(convert_to('kreile-task-effect-v1:'||p_quote::text||':'||p_edition::text||':quote-followup','UTF8'));
 bytes:=set_byte(bytes,6,(get_byte(bytes,6)&15)|80);
 bytes:=set_byte(bytes,8,(get_byte(bytes,8)&63)|128);
 RETURN substring(encode(bytes,'hex') FROM 1 FOR 32)::uuid;
END; $fn$;
REVOKE ALL ON FUNCTION private.quote_followup_key(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.quote_followup_key(uuid,integer) TO service_role;

CREATE FUNCTION private.project_quote_followup_task() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF NEW.bezug_typ='kv' AND NEW.art='aufgabe' THEN
  UPDATE private.quotes quote SET nachfass_am=CASE WHEN NEW.status='offen' THEN NEW.faellig_am ELSE NULL END
  WHERE quote.tenant_id=NEW.tenant_id AND quote.id::text=NEW.bezug_id
    AND (NEW.client_key=private.quote_followup_key(quote.id,quote.fassung) OR NEW.client_key=private.quote_followup_key(quote.id,quote.gesendet_fassung));
 END IF;
 RETURN NEW;
END; $fn$;
REVOKE ALL ON FUNCTION private.project_quote_followup_task() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.project_quote_followup_task() TO service_role;
CREATE TRIGGER task_quote_followup_projection AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION private.project_quote_followup_task();

CREATE FUNCTION private.protect_quote_followup_projection() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF NEW.nachfass_am IS DISTINCT FROM OLD.nachfass_am AND pg_trigger_depth()<2 THEN
  RAISE EXCEPTION 'QUOTE_FOLLOWUP_REQUIRES_CANONICAL_TASK' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $fn$;
REVOKE ALL ON FUNCTION private.protect_quote_followup_projection() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.protect_quote_followup_projection() TO service_role;
CREATE TRIGGER quote_followup_projection_only BEFORE UPDATE OF nachfass_am ON private.quotes FOR EACH ROW EXECUTE FUNCTION private.protect_quote_followup_projection();
COMMENT ON COLUMN private.quotes.nachfass_am IS 'Read-only projection of the current canonical follow-up Task; changing a task date updates this field in the same transaction.';
