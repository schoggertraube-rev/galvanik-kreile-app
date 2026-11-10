-- The task owner reads the original final-stage receipt and the canonical physical goods-out port.
CREATE VIEW private.v_storage_final_task_context_v1 WITH(security_invoker=true) AS
SELECT source.tenant_id,source.payload->>'taskId' AS task_id,
 source.client_event_id::text AS client_key,source.user_id::text AS creator_id,
 source.payload->'meta'->'orders'->0->>'id' AS order_id,
 (source.status='success' AND source.event_schema_version=1 AND source.user_id IS NOT NULL
  AND source.correlation_id::text=source.payload->'meta'->>'letterKey'
  AND jsonb_typeof(source.payload->'meta'->'orders')='array') AS integrity_ok,
 coalesce((SELECT count(*)>0 AND count(DISTINCT member->>'id')=count(*)
   AND bool_and(physical.integrity_ok AND physical.station='abgeholt'
     AND physical.goods_out_event_count=1 AND physical.goods_out_event_id IS NOT NULL)
   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(source.payload->'meta'->'orders')='array'
     THEN source.payload->'meta'->'orders' ELSE '[]'::jsonb END) member
   LEFT JOIN private.v_goods_out_ui_state_v1 physical
     ON physical.tenant_id=source.tenant_id AND physical.order_id=member->>'id'),false) AS goods_out_complete
FROM public.events source WHERE source.event_type='ORDER_STORAGE_FINAL_TASK_CREATED_V1';
REVOKE ALL ON private.v_storage_final_task_context_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.v_storage_final_task_context_v1 TO service_role;
COMMENT ON VIEW private.v_storage_final_task_context_v1 IS 'Task read port: original E5 source and canonical goods-out receipts; no independent task/order state.';
