-- KORR_REVIEW K3: permit only the decided server clock marker on extra work.
-- Preserve every original field, actor/key validation and extra-work condition.
DO $$
DECLARE original_definition text; replacement text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO STRICT original_definition FROM pg_constraint
 WHERE conrelid='public.events'::regclass AND conname='events_order_item_extra_work_set_v1_contract_chk';
 IF strpos(original_definition, '(payload - ''offlineOriginal''::text)') = 0 THEN
  RAISE EXCEPTION 'K3_EXPECTED_EXTRA_WORK_ORIGINAL_CONTRACT_MISSING';
 END IF;
 replacement := replace(original_definition,
  '(payload - ''offlineOriginal''::text)',
  '(payload - ''offlineOriginal''::text - ''geraetezeit_abweichend''::text)');
 ALTER TABLE public.events DROP CONSTRAINT events_order_item_extra_work_set_v1_contract_chk;
 EXECUTE 'ALTER TABLE public.events ADD CONSTRAINT events_order_item_extra_work_set_v1_contract_chk ' || replacement;
END $$;
ALTER TABLE public.events ADD CONSTRAINT events_extra_work_clock_marker_v1_chk CHECK (
 event_type IS DISTINCT FROM 'ORDER_ITEM_EXTRA_WORK_CHANGED_V1'
 OR NOT coalesce(payload ? 'geraetezeit_abweichend', false)
 OR (payload->'geraetezeit_abweichend' = 'true'::jsonb
  AND private.valid_offline_original_event_v1(payload->'offlineOriginal', user_id, client_event_id))
) NOT VALID;
