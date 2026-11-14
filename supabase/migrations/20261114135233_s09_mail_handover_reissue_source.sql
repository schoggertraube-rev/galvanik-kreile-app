-- PL14Nov13:40 KORR2: the existing qualified handover view serves both writer branches.
-- Existing immutable reissue guard remains unchanged and consumes this same source.
CREATE OR REPLACE VIEW private.v_order_handover_manual_source_v1 WITH (security_invoker=true) AS
SELECT event.id AS event_id,event.tenant_id,event.order_id,event.client_event_id,
 event.user_id AS actor_id,event.aggregate_version AS order_version,event.created_at,event.payload,
 orders.version AS current_order_version,orders.handover_mode AS current_handover_mode,
 COALESCE(actor.id IS NOT NULL AND orders.id IS NOT NULL
  AND event.payload#>>'{receipt,customerId}'=orders.customer_id
  AND event.payload#>>'{receipt,orderId}'=event.order_id
  AND event.payload#>>'{receipt,eventId}'=event.id
  AND event.payload#>>'{receipt,orderVersion}'=event.aggregate_version::text
  AND event.payload#>>'{receipt,actor,id}'=event.user_id::text
  AND event.aggregate_version<=orders.version,false) AS integrity_ok
FROM public.events event
LEFT JOIN public.orders orders ON orders.tenant_id=event.tenant_id AND orders.id=event.order_id
LEFT JOIN public.app_users actor ON actor.tenant_id=event.tenant_id AND actor.id=event.user_id
WHERE event.event_type='ORDER_HANDOVER_CHANGED_V1' AND event.event_schema_version=1 AND event.status='success'
 AND event.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'')
UNION ALL
SELECT event.id AS event_id,event.tenant_id,event.order_id,event.client_event_id,event.user_id AS actor_id,
   event.aggregate_version AS order_version,event.created_at,event.payload,orders.version AS current_order_version,orders.handover_mode AS current_handover_mode,
   COALESCE(event.payload->>'requestHash' ~ '^[a-f0-9]{64}$'
    AND event.client_event_id IS NOT NULL AND event.correlation_id IS NOT NULL
    AND event.payload#>>'{receipt,eventId}'=event.id
    AND event.payload#>>'{receipt,orderId}'=orders.id
    AND event.payload#>>'{receipt,customerId}'=orders.customer_id
    AND event.payload#>>'{receipt,orderVersion}'=event.aggregate_version::text
    AND event.aggregate_version<=orders.version
    AND event.payload#>>'{receipt,outcome}' IN ('changed','call_customer')
    AND event.payload#>>'{receipt,handoverMode}' IN ('pickup','shipping')
    AND event.payload#>>'{receipt,mailActor,kind}'='mail'
    AND event.payload#>>'{receipt,mailActor,sender}'=original.absender_adresse
    AND event.payload#>>'{receipt,mailActor,graphMessageId}'=original.graph_message_id
    AND applied.vorher->>'kunde_id'=orders.customer_id
    AND applied.vorher->>'version'=event.payload#>>'{receipt,mailActor,originalVersion}'
    AND applied.nachher->>'customerId'=orders.customer_id
    AND applied.nachher->>'orderId'=orders.id
    AND applied.nachher->>'handoverMode'=event.payload#>>'{receipt,handoverMode}'
    AND applied.nachher->>'requestedHandoverMode'=event.payload#>>'{receipt,requestedHandoverMode}'
    AND applied.nachher->>'action' IN ('auftrag.uebergabe_geaendert','auftrag.uebergabe_klaeren')
    AND EXISTS(SELECT 1 FROM public.intake_file mime
     JOIN public.intake_event secured ON secured.tenant_id=mime.tenant_id AND secured.item_id=mime.item_id
      AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=mime.id::text AND secured.nachher->>'sha256'=mime.sha256
     JOIN public.intake_event imported ON imported.tenant_id=mime.tenant_id AND imported.item_id=mime.item_id
      AND imported.nachher->>'action'='mail_import_complete' AND imported.nachher->'fileIds' ? mime.id::text
     WHERE mime.tenant_id=event.tenant_id AND mime.item_id=original.id AND mime.art='mime'
      AND mime.sha256=event.payload#>>'{receipt,mailActor,originalSha256}'),false) AS integrity_ok
  FROM public.events event
  JOIN public.orders orders ON orders.tenant_id=event.tenant_id AND orders.id=event.order_id
  JOIN public.app_users actor ON actor.tenant_id=event.tenant_id AND actor.id=event.user_id
  JOIN public.intake_item original ON original.tenant_id=event.tenant_id AND original.kanal='mail'
   AND original.id::text=event.payload#>>'{receipt,mailActor,originalItemId}'
  JOIN public.intake_event applied ON applied.tenant_id=event.tenant_id AND applied.item_id=original.id
   AND applied.befehl_id=event.client_event_id AND applied.von=event.user_id::text AND applied.art='anliegen'
  WHERE event.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'') AND event.event_type='ORDER_HANDOVER_MAIL_V1'
   AND event.status='success' AND event.event_schema_version=1;
REVOKE ALL ON private.v_order_handover_manual_source_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.v_order_handover_manual_source_v1 TO service_role;
