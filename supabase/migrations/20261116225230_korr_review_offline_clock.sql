-- KORR_REVIEW K3: the single server clock decision is preserved on the event.
-- Keep the raw qualified original, actor/key binding and historical rows intact.
CREATE OR REPLACE FUNCTION private.order_production_time_v1(source public.events) RETURNS timestamp without time zone
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public,private AS $$
BEGIN
 IF source.event_type='ORDER_ITEM_FINISHED_CHANGED_V1' AND source.payload->>'finished'='true' AND source.payload ? 'offlineOriginal' THEN
  IF NOT private.valid_offline_original_event_v1(source.payload->'offlineOriginal',source.user_id,source.client_event_id)
   THEN RAISE EXCEPTION 'ORDER_PRODUCTION_OFFLINE_ORIGINAL_INVALID'; END IF;
  IF source.payload->'geraetezeit_abweichend'='true'::jsonb THEN RETURN source.created_at; END IF;
  RETURN (source.payload->'offlineOriginal'->>'deviceCapturedAt')::timestamptz AT TIME ZONE 'UTC';
 END IF;
 RETURN source.created_at;
END $$;
REVOKE ALL ON FUNCTION private.order_production_time_v1(public.events) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.order_production_time_v1(public.events) TO service_role;
