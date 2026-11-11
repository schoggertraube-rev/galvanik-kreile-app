-- Existing immutable task reference remains provenance; physical completion follows the qualified remaining ware.
CREATE OR REPLACE VIEW private.v_storage_final_task_context_v1 WITH(security_invoker=true) AS
SELECT source.tenant_id,source.payload->>'taskId' AS task_id,
 source.client_event_id::text AS client_key,source.user_id::text AS creator_id,
 source.payload->'meta'->'orders'->0->>'id' AS order_id,
 (source.status='success' AND source.event_schema_version=1 AND source.user_id IS NOT NULL
  AND source.correlation_id::text=CASE WHEN source.event_type='ORDER_STORAGE_FINAL_TASK_CREATED_V1' THEN source.payload->'meta'->>'letterKey' ELSE source.payload->'meta'->>'stageKey' END
  AND jsonb_typeof(source.payload->'meta'->'orders')='array'
 AND (scope.id IS NULL OR (scope.status='success' AND scope.event_schema_version=1 AND scope.user_id IS NOT NULL
  AND scope.correlation_id=source.correlation_id
  AND scope.payload->'meta'->>'letterKey'=source.payload->'meta'->>'letterKey'
  AND scope.payload->'meta'->>'customerId'=source.payload->'meta'->>'customerId'
  AND scope.payload->'meta'->>'handover'=source.payload->'meta'->>'handover'
  AND jsonb_typeof(scope.payload->'meta'->'orders')='array'
  AND jsonb_array_length(scope.payload->'meta'->'orders')>0
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(scope.payload->'meta'->'orders') member WHERE NOT source.payload->'meta'->'orders' @> jsonb_build_array(member))
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(source.payload->'meta'->'freezes') member
   WHERE NOT scope.payload->'meta'->'freezes' @> jsonb_build_array(member)
    AND NOT EXISTS(SELECT 1 FROM public.events change JOIN public.events reaction ON reaction.tenant_id=change.tenant_id AND reaction.id=change.payload->>'replyEventId'
     JOIN private.v_intake_reply_evidence_v1 original ON original.tenant_id=reaction.tenant_id AND original.item_id=reaction.payload->'receipt'->'proof'->>'itemId'
     WHERE change.tenant_id=source.tenant_id AND change.event_type='ORDER_STORAGE_FINAL_TASK_UPDATED_V1' AND change.status='success' AND change.event_schema_version=1 AND change.payload->>'taskId'=source.payload->>'taskId'
      AND reaction.event_type='ORDER_COLLECTION_REPLY_RECORDED_V1' AND reaction.status='success' AND reaction.event_schema_version=1 AND reaction.user_id IS NOT NULL
      AND reaction.payload->'receipt'->>'customerId'=source.payload->'meta'->>'customerId' AND reaction.payload->'receipt'->>'handover'=source.payload->'meta'->>'handover'
      AND reaction.payload->'receipt'->'proof'->'freezes' @> jsonb_build_array(member)
      AND original.proof_ok AND original.customer_id=reaction.payload->'receipt'->>'customerId'
      AND original.reply_chain->>'originalSha256'=reaction.payload->'receipt'->'proof'->>'originalSha256'
    ))
  ))) AS integrity_ok,
 coalesce((SELECT count(*)>0 AND count(DISTINCT member->>'id')=count(*)
   AND bool_and(coalesce(physical.integrity_ok AND physical.station='abgeholt'
     AND physical.goods_out_event_count=1 AND physical.goods_out_event_id IS NOT NULL,false))
   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(coalesce(scope.payload->'meta',source.payload->'meta')->'orders')='array'
     THEN coalesce(scope.payload->'meta',source.payload->'meta')->'orders' ELSE '[]'::jsonb END) member
   LEFT JOIN private.v_goods_out_ui_state_v1 physical
     ON physical.tenant_id=source.tenant_id AND physical.order_id=member->>'id'),false) AS goods_out_complete
FROM public.events source LEFT JOIN LATERAL (
 SELECT changed.* FROM public.events changed WHERE changed.tenant_id=source.tenant_id AND source.event_type='ORDER_STORAGE_FINAL_TASK_CREATED_V1' AND changed.event_type='ORDER_STORAGE_FINAL_TASK_UPDATED_V1' AND changed.payload->>'taskId'=source.payload->>'taskId' ORDER BY changed.created_at DESC,changed.id DESC LIMIT 1
) scope ON true WHERE source.event_type='ORDER_STORAGE_FINAL_TASK_CREATED_V1' OR (source.event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND source.payload->>'channel'='post' AND source.payload->'meta'->>'stage'='E4' AND source.payload->'document'->>'id'=source.id::text);
REVOKE ALL ON private.v_storage_final_task_context_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.v_storage_final_task_context_v1 TO service_role;
COMMENT ON VIEW private.v_storage_final_task_context_v1 IS 'Task read port: original E5 or postal E4 source and canonical goods-out receipts; no independent task/order state.';
