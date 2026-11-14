-- PL 14.11.10:20: terminal rejection is evidence of no effect, never success.
-- The existing immutable original and TaskWriter remain the only sources.
CREATE UNIQUE INDEX offline_workshop_rejected_original_key_uidx
ON public.events (tenant_id, lower(payload #>> '{original,input,clientEventId}'))
WHERE event_type = 'OFFLINE_WORKSHOP_REJECTED_V1';

CREATE OR REPLACE FUNCTION private.guard_offline_original_no_effect_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE original_key uuid;
BEGIN
  IF NEW.event_type = 'OFFLINE_WORKSHOP_REJECTED_V1' THEN
    original_key := (NEW.payload #>> '{original,input,clientEventId}')::uuid;
    IF original_key IS NULL OR original_key = NEW.client_event_id
       OR NEW.payload->>'rejection' IS NULL
       OR NEW.payload->>'rejection' NOT IN ('CONFLICT','FORBIDDEN','NOT_FOUND','VALIDATION_ERROR') THEN
      RAISE EXCEPTION 'OFFLINE_ORIGINAL_REJECTION_INVALID' USING ERRCODE = '23514';
    END IF;
  ELSE
    original_key := NEW.client_event_id;
  END IF;
  IF original_key IS NULL THEN RETURN NEW; END IF;
  -- Both possible outcomes serialize at the actual business-event boundary.
  -- A competing writer either commits first (no rejection is allowed), or its
  -- mandatory event is refused and its transaction rolls back after rejection.
  PERFORM pg_advisory_xact_lock(hashtextextended('offline-no-effect:' || NEW.tenant_id || ':' || original_key::text, 0));
  IF NEW.event_type = 'OFFLINE_WORKSHOP_REJECTED_V1' THEN
    IF EXISTS (SELECT 1 FROM public.events effect
               WHERE effect.tenant_id = NEW.tenant_id AND effect.client_event_id = original_key) THEN
      RAISE EXCEPTION 'OFFLINE_ORIGINAL_EFFECT_ALREADY_EXISTS' USING ERRCODE = '23514';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.events rejected
                WHERE rejected.tenant_id = NEW.tenant_id
                  AND rejected.event_type = 'OFFLINE_WORKSHOP_REJECTED_V1'
                  AND lower(rejected.payload #>> '{original,input,clientEventId}') = original_key::text) THEN
    RAISE EXCEPTION 'OFFLINE_ORIGINAL_ALREADY_REJECTED_WITHOUT_EFFECT' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_offline_original_no_effect_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.guard_offline_original_no_effect_v1() TO service_role;
CREATE TRIGGER offline_original_no_effect_before_insert
BEFORE INSERT ON public.events FOR EACH ROW
EXECUTE FUNCTION private.guard_offline_original_no_effect_v1();
