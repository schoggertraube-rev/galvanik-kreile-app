-- S09 / PL14Nov07:10. One immutable source in the existing events truth.
ALTER TABLE public.events ADD CONSTRAINT events_s09_manual_handover_chk CHECK (
 event_type<>'ORDER_HANDOVER_CHANGED_V1' OR COALESCE(
  tenant_id IS NOT NULL AND order_id IS NOT NULL AND user_id IS NOT NULL
  AND client_event_id IS NOT NULL AND correlation_id IS NOT NULL
  AND event_schema_version=1 AND aggregate_version>0 AND status='success'
  AND jsonb_typeof(payload)='object'
  AND payload=jsonb_build_object('requestHash',payload->'requestHash','before',payload->'before','receipt',payload->'receipt')
  AND payload->>'requestHash' ~ '^[0-9a-f]{64}$'
  AND payload->'before'=jsonb_build_object('handoverMode',payload#>'{before,handoverMode}')
  AND payload#>>'{before,handoverMode}' IN ('pickup','shipping')
  AND jsonb_typeof(payload->'receipt')='object'
  AND payload->'receipt'=jsonb_build_object('eventId',payload#>'{receipt,eventId}','orderId',payload#>'{receipt,orderId}',
    'orderNumber',payload#>'{receipt,orderNumber}','customerId',payload#>'{receipt,customerId}',
    'expectedVersion',payload#>'{receipt,expectedVersion}','orderVersion',payload#>'{receipt,orderVersion}',
    'handoverMode',payload#>'{receipt,handoverMode}','requestedHandoverMode',payload#>'{receipt,requestedHandoverMode}',
    'outcome',payload#>'{receipt,outcome}','message',payload#>'{receipt,message}',
    'taskClientKey',payload#>'{receipt,taskClientKey}','taskTitle',payload#>'{receipt,taskTitle}',
    'passed',payload#>'{receipt,passed}','actor',payload#>'{receipt,actor}')
  AND payload#>>'{receipt,eventId}'=id AND payload#>>'{receipt,orderId}'=order_id
  AND payload#>>'{receipt,orderVersion}'=aggregate_version::text
  AND payload#>>'{receipt,handoverMode}' IN ('pickup','shipping')
  AND payload#>>'{receipt,requestedHandoverMode}' IN ('pickup','shipping')
  AND payload#>>'{receipt,outcome}' IN ('changed','call_customer')
  AND jsonb_typeof(payload#>'{receipt,expectedVersion}')='number'
  AND (payload#>>'{receipt,expectedVersion}') ~ '^[1-9][0-9]*$'
  AND jsonb_typeof(payload#>'{receipt,passed}')='boolean'
  AND jsonb_typeof(payload#>'{receipt,message}')='string'
  AND length(btrim(payload#>>'{receipt,message}'))>0
  AND payload#>>'{receipt,actor,kind}'='login'
  AND payload#>'{receipt,actor}'=jsonb_build_object('kind',payload#>'{receipt,actor,kind}','id',payload#>'{receipt,actor,id}','at',payload#>'{receipt,actor,at}')
  AND payload#>>'{receipt,actor,id}'=user_id::text
  AND payload#>>'{receipt,actor,at}'=to_char(created_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  AND CASE WHEN payload#>>'{receipt,outcome}'='changed' THEN
    payload#>>'{receipt,handoverMode}'=payload#>>'{receipt,requestedHandoverMode}'
    AND payload#>'{receipt,passed}'='false'::jsonb
    AND payload#>'{receipt,taskClientKey}'='null'::jsonb
    AND payload#>'{receipt,taskTitle}'='null'::jsonb
    AND aggregate_version=(payload#>>'{receipt,expectedVersion}')::integer+1
   ELSE payload#>>'{receipt,handoverMode}'=payload#>>'{before,handoverMode}'
    AND payload#>>'{receipt,taskClientKey}'=client_event_id::text
    AND jsonb_typeof(payload#>'{receipt,taskTitle}')='string'
    AND length(btrim(payload#>>'{receipt,taskTitle}')) BETWEEN 1 AND 120
    AND aggregate_version=(payload#>>'{receipt,expectedVersion}')::integer
      +CASE WHEN payload#>'{receipt,passed}'='true'::jsonb THEN 0 ELSE 1 END
   END,false)
) NOT VALID;

CREATE TRIGGER events_s09_manual_handover_update BEFORE UPDATE ON public.events
 FOR EACH ROW WHEN (OLD.event_type='ORDER_HANDOVER_CHANGED_V1' OR NEW.event_type='ORDER_HANDOVER_CHANGED_V1')
 EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_s09_manual_handover_delete BEFORE DELETE ON public.events
 FOR EACH ROW WHEN (OLD.event_type='ORDER_HANDOVER_CHANGED_V1')
 EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE VIEW private.v_order_handover_manual_source_v1 WITH (security_invoker=true) AS
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
 AND event.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'');
REVOKE ALL ON private.v_order_handover_manual_source_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.v_order_handover_manual_source_v1 TO service_role;

-- Preserve the complete original MIME/assignment branch and add the same qualified login source.
-- AF19: use immutable assignment facts at the time of application; later explicit mail reassignment must not hide an existing order.
CREATE OR REPLACE VIEW "private"."v_order_intake_receipts_v1" WITH (security_invoker=true) AS
SELECT receipt.id AS receipt_id,
    receipt.event_id,
    receipt.tenant_id,
    receipt.order_id,
    receipt.customer_id,
    receipt.actor_id,
    actor.full_name AS actor_display_name,
    receipt.client_event_id,
    receipt.correlation_id,
    receipt.intent_sha256,
    receipt.customer_mode,
    receipt.order_number,
    receipt.customer_display_name,
    receipt.due_date,
    receipt.note,
    receipt.geprueft,
    receipt.items_snapshot,
    receipt.created_at AS recorded_at,
    orders.version AS current_order_version,
    orders.station AS current_station,
    orders.status AS current_status,
    receipt.geprueft IS NOT DISTINCT FROM orders.geprueft AND event.id IS NOT NULL AND orders.id IS NOT NULL AND customer.id IS NOT NULL AND actor.id IS NOT NULL AND event.user_id = receipt.actor_id AND event.client_event_id = receipt.client_event_id AND event.correlation_id = receipt.correlation_id AND event.event_type::text = 'ORDER_INTAKE_CREATED_V1'::text AND event.status::text = 'success'::text AND orders.customer_id = receipt.customer_id AND (orders.promised_due_date IS NULL OR orders.due_date::date = orders.promised_due_date::date) AND (COALESCE(orders.promised_due_date, orders.due_date::timestamp with time zone)::date = receipt.due_date OR COALESCE(orders.promised_due_date, orders.due_date::timestamp with time zone)::date::text = (( SELECT due_event.payload ->> 'promisedDueDate'::text
           FROM events due_event
             JOIN app_users due_actor ON due_actor.tenant_id = due_event.tenant_id::text AND due_actor.id = due_event.user_id
          WHERE due_event.tenant_id::text = receipt.tenant_id AND due_event.order_id = receipt.order_id AND due_event.event_type::text = 'ORDER_PROMISED_DUE_DATE_CHANGED_V1'::text AND due_event.event_schema_version = 1 AND due_event.status::text = 'success'::text AND due_event.client_event_id IS NOT NULL AND due_event.correlation_id IS NOT NULL AND due_event.aggregate_version <= orders.version AND due_event.payload ? 'promisedDueDate'::text AND (due_event.payload ->> 'promisedDueDate'::text) ~ '^\d{4}-\d{2}-\d{2}$'::text AND due_event.notes = btrim(due_event.notes) AND length(due_event.notes) >= 3 AND length(due_event.notes) <= 500
          ORDER BY due_event.aggregate_version DESC, due_event.created_at DESC, due_event.id DESC
         LIMIT 1))) AND (receipt.intake_term_status IS NULL OR receipt.intake_term_status = orders.intake_term_status) AND (receipt.intake_source IS NULL OR receipt.intake_source = orders.intake_source) AND (NOT event.payload ? 'handoverMode'::text OR orders.handover_mode = COALESCE((
 SELECT bound.mode FROM (
 SELECT handover.payload->'receipt'->>'handoverMode' AS mode,handover.aggregate_version AS version,handover.created_at,handover.id
 FROM public.events handover
 JOIN public.app_users handover_actor ON handover_actor.tenant_id=handover.tenant_id AND handover_actor.id=handover.user_id
 JOIN public.intake_item original ON original.tenant_id=handover.tenant_id AND original.id::text=handover.payload->'receipt'->'mailActor'->>'originalItemId'
 JOIN public.intake_event applied ON applied.tenant_id=handover.tenant_id AND applied.item_id=original.id AND applied.befehl_id=handover.client_event_id AND applied.von=handover.user_id::text
 WHERE handover.tenant_id=receipt.tenant_id AND handover.order_id=receipt.order_id
 AND handover.event_type='ORDER_HANDOVER_MAIL_V1' AND handover.event_schema_version=1 AND handover.status='success'
 AND handover.client_event_id IS NOT NULL AND handover.correlation_id IS NOT NULL
 AND handover.aggregate_version<=orders.version AND handover.payload->>'requestHash' ~ '^[0-9a-f]{64}$'
 AND handover.payload->'receipt'->>'orderId'=receipt.order_id
 AND handover.payload->'receipt'->>'customerId'=receipt.customer_id
 AND handover.payload->'receipt'->>'orderVersion'=handover.aggregate_version::text
 AND handover.payload->'receipt'->>'handoverMode' IN ('pickup','shipping')
 AND handover.payload->'receipt'->>'outcome' IN ('changed','call_customer')
 AND handover.payload->'receipt'->'mailActor'->>'kind'='mail'
 AND handover.payload->'receipt'->'mailActor'->>'sender'=original.absender_adresse
 AND original.kanal='mail'
 AND applied.vorher->>'kunde_id'=receipt.customer_id AND applied.nachher->>'customerId'=receipt.customer_id
 AND applied.art='anliegen' AND applied.vorher->>'version'=handover.payload->'receipt'->'mailActor'->>'originalVersion'
 AND applied.nachher->>'orderId'=receipt.order_id
 AND applied.nachher->>'handoverMode'=handover.payload->'receipt'->>'handoverMode'
 AND applied.nachher->>'action' IN ('auftrag.uebergabe_geaendert','auftrag.uebergabe_klaeren')
 AND EXISTS(SELECT 1 FROM public.intake_file mime JOIN public.intake_event secured ON secured.tenant_id=mime.tenant_id AND secured.item_id=mime.item_id AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=mime.id::text AND secured.nachher->>'sha256'=mime.sha256 WHERE mime.tenant_id=handover.tenant_id AND mime.item_id=original.id AND mime.art='mime' AND mime.sha256=handover.payload->'receipt'->'mailActor'->>'originalSha256')

 UNION ALL
 SELECT manual.payload#>>'{receipt,handoverMode}' AS mode,manual.order_version AS version,manual.created_at,manual.event_id AS id
 FROM private.v_order_handover_manual_source_v1 manual
 WHERE manual.tenant_id=receipt.tenant_id AND manual.order_id=receipt.order_id
  AND manual.payload#>>'{receipt,customerId}'=receipt.customer_id AND manual.integrity_ok
 ) bound ORDER BY bound.version DESC,bound.created_at DESC,bound.id DESC LIMIT 1
 ),event.payload->>'handoverMode') AND ((event.payload ->> 'paymentMode'::text) = orders.payment_mode OR (EXISTS ( SELECT 1
           FROM events payment_event
             JOIN app_users payment_actor ON payment_actor.tenant_id = payment_event.tenant_id::text AND payment_actor.id = payment_event.user_id
          WHERE payment_event.tenant_id::text = receipt.tenant_id AND payment_event.order_id = receipt.order_id AND payment_event.event_type::text = 'PAYMENT_MODE_SET_V1'::text AND payment_event.event_schema_version = 1 AND payment_event.status::text = 'success'::text AND payment_event.station IS NULL AND payment_event.from_station IS NULL AND payment_event.client_event_id IS NOT NULL AND payment_event.correlation_id IS NOT NULL AND payment_event.aggregate_version = orders.payment_mode_version AND (payment_event.payload ->> 'orderId'::text) = receipt.order_id AND (payment_event.payload ->> 'paymentMode'::text) = orders.payment_mode AND (payment_event.payload ->> 'paymentModeVersion'::text) ~ '^[0-9]+$'::text AND ((payment_event.payload ->> 'paymentModeVersion'::text)::integer) = orders.payment_mode_version AND (payment_event.payload ->> 'expectedVersion'::text) ~ '^[0-9]+$'::text AND (((payment_event.payload ->> 'expectedVersion'::text)::integer) + 1) = orders.payment_mode_version AND (payment_event.payload ->> 'receiptId'::text) = ((('payment-mode://'::text || receipt.order_id) || '/'::text) || orders.payment_mode_version::text))))) AND jsonb_typeof(receipt.items_snapshot) = 'array'::text AND jsonb_array_length(receipt.items_snapshot) >= 1 AND jsonb_array_length(receipt.items_snapshot) <= 20 AND NOT (EXISTS ( SELECT 1
           FROM jsonb_array_elements(receipt.items_snapshot) snapshot(item)
             LEFT JOIN items line ON line.id = (snapshot.item ->> 'id'::text) AND line.order_id = receipt.order_id AND line.tenant_id::text = receipt.tenant_id AND line.customer_id = receipt.customer_id
             LEFT JOIN catalog_services service ON service.id =
                CASE
                    WHEN (snapshot.item ->> 'catalogServiceId'::text) IS NOT NULL THEN (snapshot.item ->> 'catalogServiceId'::text)::uuid
                    ELSE NULL::uuid
                END AND service.tenant_id = receipt.tenant_id
          WHERE line.id IS NULL OR line.name IS DISTINCT FROM (snapshot.item ->> 'name'::text) OR line.quantity IS DISTINCT FROM ((snapshot.item ->> 'quantity'::text)::numeric) OR line.material IS DISTINCT FROM NULLIF(snapshot.item ->> 'material'::text, ''::text) OR line.surface_requested IS DISTINCT FROM private.order_position_surface_key(snapshot.item ->> 'surfaceRequested'::text) OR line.execution_requested IS DISTINCT FROM COALESCE(snapshot.item ->> 'executionRequested'::text, 'offen'::text) OR
                CASE
                    WHEN (snapshot.item ->> 'catalogServiceId'::text) IS NOT NULL THEN service.id IS NULL OR line.catalog_service_id IS DISTINCT FROM service.id OR line.unit IS DISTINCT FROM private.order_position_unit_key(snapshot.item ->> 'unit'::text) OR round(line.preis_netto * 100::numeric)::integer IS DISTINCT FROM ((snapshot.item ->> 'unitPriceCents'::text)::integer) OR line.vat_rate_basis_points IS DISTINCT FROM ((snapshot.item ->> 'vatRateBasisPoints'::text)::integer)
                    ELSE line.catalog_service_id IS NOT NULL OR line.unit IS DISTINCT FROM private.order_position_unit_key(snapshot.item ->> 'unit'::text) OR line.unit IS NOT NULL AND (line.unit <> ALL (ARRAY['stueck'::text, 'kg'::text, 'dm2'::text, 'satz'::text, 'stunde'::text])) OR CASE WHEN (snapshot.item ->> 'unitPriceCents'::text) IS NOT NULL THEN
                      NOT (coalesce(snapshot.item ->> 'unitPriceCents'::text, '') ~ '^[1-9][0-9]{0,6}$' AND (snapshot.item ->> 'unitPriceCents'::text)::integer <= 9999999)
                      OR (snapshot.item ->> 'vatRateBasisPoints'::text)::integer IS DISTINCT FROM 1900
                      OR line.vat_rate_basis_points IS DISTINCT FROM 1900
                      OR round(line.preis_netto * 100::numeric)::integer IS DISTINCT FROM (snapshot.item ->> 'unitPriceCents'::text)::integer
                    ELSE line.vat_rate_basis_points IS NOT NULL OR NOT (line.preis_netto IS NULL OR (EXISTS ( SELECT 1
                       FROM events price_event
                         CROSS JOIN LATERAL jsonb_array_elements(price_event.payload -> 'prices'::text) price(entry)
                         JOIN app_users price_actor ON price_actor.id = price_event.user_id AND price_actor.tenant_id = price_event.tenant_id::text
                      WHERE price_event.tenant_id::text = receipt.tenant_id AND price_event.order_id = receipt.order_id AND price_event.event_type::text = 'ORDER_INVOICE_PRICES_SET_V1'::text AND price_event.event_schema_version = 1 AND price_event.status::text = 'success'::text AND price_event.aggregate_version <= orders.version AND price_event.payload ? 'requestHash'::text AND jsonb_typeof(price_event.payload -> 'prices'::text) = 'array'::text AND (price.entry ->> 'itemId'::text) = line.id AND COALESCE(price.entry ->> 'unitPriceCents'::text, ''::text) ~ '^[1-9][0-9]{0,8}$'::text AND ((price.entry ->> 'unitPriceCents'::text)::integer) = round(line.preis_netto * 100::numeric)::integer)))
                    END
                END)) AS integrity_ok,
    orders.handover_mode,
    orders.payment_mode,
    receipt.intake_term_status,
    receipt.intake_source
   FROM private.order_intake_receipts receipt
     LEFT JOIN events event ON event.id = receipt.event_id AND event.tenant_id::text = receipt.tenant_id
     LEFT JOIN orders orders ON orders.id = receipt.order_id AND orders.tenant_id::text = receipt.tenant_id
     LEFT JOIN customers customer ON customer.id = receipt.customer_id AND customer.tenant_id::text = receipt.tenant_id
     LEFT JOIN app_users actor ON actor.id = receipt.actor_id AND actor.tenant_id = receipt.tenant_id
  WHERE receipt.tenant_id = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text);
REVOKE ALL ON TABLE "private"."v_order_intake_receipts_v1" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE "private"."v_order_intake_receipts_v1" TO service_role;
