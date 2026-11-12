-- PL 11.11.09:00: optional original device evidence on the existing events.
-- Preserve every existing extra-work condition; admit only this exact envelope.
CREATE FUNCTION private.valid_offline_original_event_v1(original jsonb, actor uuid, request_key uuid)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE device_time timestamptz;
BEGIN
 IF jsonb_typeof(original) IS DISTINCT FROM 'object'
  OR original IS DISTINCT FROM jsonb_build_object('deviceCapturedAt',original->'deviceCapturedAt','actorId',original->'actorId','clientEventId',original->'clientEventId')
  OR jsonb_typeof(original->'deviceCapturedAt') IS DISTINCT FROM 'string'
  OR original->>'actorId' IS DISTINCT FROM actor::text
  OR original->>'clientEventId' IS DISTINCT FROM request_key::text
  OR coalesce(original->>'deviceCapturedAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$'
 THEN RETURN false; END IF;
 device_time := (original->>'deviceCapturedAt')::timestamptz;
 RETURN actor IS NOT NULL AND request_key IS NOT NULL AND isfinite(device_time);
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION private.valid_offline_original_event_v1(jsonb,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.valid_offline_original_event_v1(jsonb,uuid,uuid) TO service_role;

DO $$
DECLARE original_definition text; replacement text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO STRICT original_definition FROM pg_constraint
 WHERE conrelid='public.events'::regclass AND conname='events_order_item_extra_work_set_v1_contract_chk';
 IF strpos(original_definition,'(payload = jsonb_build_object(')=0 THEN
  RAISE EXCEPTION 'OFFLINE_ORIGINAL_EXPECTED_EXTRA_WORK_CONTRACT_MISSING';
 END IF;
 replacement := replace(original_definition,'(payload = jsonb_build_object(', '((payload - ''offlineOriginal''::text) = jsonb_build_object(');
 ALTER TABLE public.events DROP CONSTRAINT events_order_item_extra_work_set_v1_contract_chk;
 EXECUTE 'ALTER TABLE public.events ADD CONSTRAINT events_order_item_extra_work_set_v1_contract_chk '||replacement;
END $$;
ALTER TABLE public.events ADD CONSTRAINT events_offline_original_v1_contract_chk CHECK (
 NOT coalesce(payload ? 'offlineOriginal',false)
 OR (event_type IN ('ORDER_ITEM_FINISHED_CHANGED_V1','ORDER_ITEM_EXTRA_WORK_CHANGED_V1')
  AND private.valid_offline_original_event_v1(payload->'offlineOriginal',user_id,client_event_id))
) NOT VALID;
