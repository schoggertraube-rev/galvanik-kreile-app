-- PLAN_LADEZEIT M9: the existing queries, retained per native backend plan.

CREATE FUNCTION private.read_today_card_snapshot_v1(p_tenant text,p_ids text[])
RETURNS TABLE ("kind" text,"order_id" text,"position" bigint,"data" jsonb)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, private
SET plan_cache_mode = force_generic_plan
AS $function$
#variable_conflict use_column
BEGIN
 RETURN QUERY

    WITH selected AS MATERIALIZED (
     SELECT queue.id,queue.tenant_id,queue.version,queue.order_number,queue.customer_id,queue.customer_name,
      queue.title,queue.task,queue.station,queue.current_station,queue.current_station_id,queue.status,
      queue.intake_date,queue.due_date::date::text AS due_date,queue.created_at,queue.tenant_integrity_ok,
      orders.intake_source,orders.handover_mode,orders.source,orders.nacharbeit_zu,
      EXISTS(SELECT 1 FROM private.quote_conversion_receipts quote WHERE quote.tenant_id=orders.tenant_id AND quote.order_id=orders.id) AS has_commercial_quote
     FROM private.v_operational_station_queue_v1 queue JOIN public.orders orders ON orders.tenant_id=queue.tenant_id AND orders.id=queue.id
     WHERE queue.tenant_id=p_tenant AND queue.id=ANY(p_ids)
    ), latest_content AS (
     SELECT DISTINCT ON(order_id) tenant_id,order_id,event_type,event_schema_version,aggregate_version,status,payload
     FROM public.events WHERE tenant_id=p_tenant AND order_id=ANY(p_ids) AND event_type='ORDER_CONTENT_CHANGED_V1'
     ORDER BY order_id,aggregate_version DESC,created_at DESC
    ), latest_handover AS (
     SELECT DISTINCT ON(order_id) order_id,id,event_type,payload FROM public.events
     WHERE tenant_id=p_tenant AND order_id=ANY(p_ids) AND event_type IN('ORDER_HANDOVER_MAIL_V1','ORDER_HANDOVER_CHANGED_V1') AND event_schema_version=1 AND status='success'
     ORDER BY order_id,aggregate_version DESC,created_at DESC,id DESC
    )
    SELECT 'queue' AS kind,id AS order_id,0::bigint AS position,to_jsonb(selected) AS data FROM selected
    UNION ALL
    SELECT 'item',item.order_id,row_number() OVER(PARTITION BY item.order_id ORDER BY item.created_at,item.id),
     jsonb_build_object('id',item.id,'name',item.name,'quantity',item.quantity,'material',item.material,'surface_requested',item.surface_requested,'execution_requested',item.execution_requested,
      'catalog_service_id',item.catalog_service_id::text,'unit',item.unit,'unit_price_cents',CASE WHEN item.preis_netto IS NULL THEN NULL ELSE round(item.preis_netto*100)::bigint END,'vat_rate_basis_points',item.vat_rate_basis_points,'current_station_id',item.current_station_id)
     FROM public.items item WHERE item.tenant_id=p_tenant AND item.order_id=ANY(p_ids)
    UNION ALL
    SELECT 'intake',receipt.order_id,row_number() OVER(PARTITION BY receipt.order_id ORDER BY receipt.recorded_at DESC),
     jsonb_build_object('tenant_id',receipt.tenant_id,'order_id',receipt.order_id,'customer_id',receipt.customer_id,'items_snapshot',receipt.items_snapshot,'current_order_version',receipt.current_order_version,'current_station',receipt.current_station,'current_status',receipt.current_status,'integrity_ok',receipt.integrity_ok,'surface_mapping_readable',receipt.surface_mapping_readable)
     FROM private.v_order_intake_receipts_v1 receipt WHERE receipt.tenant_id=p_tenant AND receipt.order_id=ANY(p_ids)
    UNION ALL SELECT 'content',order_id,0,to_jsonb(latest_content) FROM latest_content
    UNION ALL
    SELECT 'price',event.order_id,row_number() OVER(PARTITION BY event.order_id ORDER BY event.aggregate_version,event.created_at,event.id),jsonb_build_object('aggregate_version',event.aggregate_version,'payload',event.payload)
     FROM public.events event WHERE event.tenant_id=p_tenant AND event.order_id=ANY(p_ids) AND event.event_type='ORDER_INVOICE_PRICES_SET_V1' AND event.status='success' AND event.event_schema_version=1 AND event.user_id IS NOT NULL
    UNION ALL
    SELECT 'extra',line.order_id,row_number() OVER(PARTITION BY line.order_id ORDER BY line.item_id,line.catalog_position_name,line.catalog_position_id),
     jsonb_build_object('tenant_id',line.tenant_id,'order_id',line.order_id,'item_id',line.item_id,'line_id',line.line_id::text,'catalog_position_id',line.catalog_position_id::text,'catalog_position_name',line.catalog_position_name,'minutes',line.minutes,'hourly_rate_cents',line.hourly_rate_cents,'amount_cents',line.amount_cents,'frozen',line.frozen,'line_version',line.line_version,'frozen_at',line.frozen_at,'integrity_ok',line.integrity_ok)
     FROM private.v_order_extra_work_live_v1 line WHERE line.tenant_id=p_tenant AND line.order_id=ANY(p_ids)
    UNION ALL
    SELECT 'freeze',frozen.order_id,row_number() OVER(PARTITION BY frozen.order_id ORDER BY frozen.occurred_at DESC),
     jsonb_build_object('tenant_id',frozen.tenant_id,'order_id',frozen.order_id,'aggregate_version',frozen.aggregate_version,'freeze_id',frozen.freeze_id::text,'rate_id',frozen.rate_id::text,'hourly_rate_cents',frozen.hourly_rate_cents,'total_amount_cents',frozen.total_amount_cents,'line_count',frozen.line_count,'frozen_at',frozen.frozen_at,'integrity_ok',frozen.integrity_ok)
     FROM private.v_order_frozen_receipts_v1 frozen WHERE frozen.tenant_id=p_tenant AND frozen.order_id=ANY(p_ids) AND frozen.active=true
    UNION ALL SELECT 'handover',order_id,0,to_jsonb(latest_handover) FROM latest_handover
    ORDER BY kind,order_id,position;
END;
$function$;
REVOKE ALL ON FUNCTION private.read_today_card_snapshot_v1(text,text[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.read_today_card_snapshot_v1(text,text[]) TO postgres;

CREATE FUNCTION private.read_order_informed_receipts_v1(p_tenant text,p_ids text[])
RETURNS TABLE ("batch_order_id" text,"records" jsonb[])
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, private
SET plan_cache_mode = force_generic_plan
AS $function$
#variable_conflict use_column
BEGIN
 RETURN QUERY
 SELECT requested.order_id AS batch_order_id,ARRAY(SELECT to_jsonb(source) FROM (SELECT event.payload,
    (event.payload->'receipt'->>'actorId'=event.user_id::text AND event.payload->'receipt'->>'orderId'=event.order_id
    AND event.payload->'receipt'->>'eventId'=event.id::text AND event.event_schema_version=1
    AND (event.payload->'receipt'->>'channel'='telefon' AND event.payload->'receipt'->'threadId'='null'::jsonb OR
     event.payload->'receipt'->>'channel'='mail' AND EXISTS(SELECT 1 FROM public.communication_threads thread
      JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email'
      JOIN public.events sent ON sent.tenant_id=thread.tenant_id AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.payload->>'threadId'=thread.id::text
      WHERE thread.tenant_id=event.tenant_id AND thread.id::text=event.payload->'receipt'->>'threadId' AND thread.status='sent'
       AND sent.payload->'document'->>'kind'='INVOICE'
       AND (sent.payload->'document'->>'orderId'=event.order_id OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(sent.payload->'document'->'bundle','[]'::jsonb)) member WHERE member->>'orderId'=event.order_id))
       AND sent.payload->>'intent'=event.payload->>'intent'))) AS proof_ok
   FROM public.events event JOIN private.v_order_freeze_state_v1 freeze_state ON freeze_state.tenant_id=event.tenant_id AND freeze_state.order_id=event.order_id
   WHERE event.tenant_id=p_tenant AND event.order_id=requested.order_id AND event.event_type='ORDER_CUSTOMER_INFORMED_V1' AND event.status='success'
    AND freeze_state.active AND freeze_state.integrity_ok AND event.payload->'receipt'->>'freezeId'=freeze_state.freeze_id::text
   ORDER BY event.created_at ASC,event.id ASC LIMIT 1001) source) AS records FROM unnest(p_ids) requested(order_id);
END;
$function$;
REVOKE ALL ON FUNCTION private.read_order_informed_receipts_v1(text,text[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.read_order_informed_receipts_v1(text,text[]) TO postgres;

CREATE FUNCTION private.read_order_informed_orders_v1(p_tenant text,p_ids text[])
RETURNS TABLE ("batch_order_id" text,"customer_id" text,"station" character varying,"version" integer,"handover_mode" text,"allowed" boolean,"invoice_state" text,"invoice_id" text,"payment_allowed" boolean,"frozen_at" text,"freeze_id" text,"goods_out_event_id" text,"debt_ids" text[])
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, private
SET plan_cache_mode = force_generic_plan
AS $function$
#variable_conflict use_column
BEGIN
 RETURN QUERY
 SELECT requested.order_id AS batch_order_id,source.* FROM unnest(p_ids) requested(order_id) CROSS JOIN LATERAL (SELECT orders.customer_id,orders.station,orders.version,orders.handover_mode,private.order_release_allowed_v1(orders.tenant_id,orders.id) AS allowed,
   state.invoice_state,state.invoice_id::text,state.all_invoice_payments_allowed AS payment_allowed,freeze_state.frozen_at::text,freeze_state.freeze_id::text,state.goods_out_event_id::text,
   ARRAY(SELECT invoice.id::text FROM public.invoices invoice WHERE invoice.tenant_id=orders.tenant_id AND invoice.customer_id=orders.customer_id AND private.invoice_is_overdue_v1(invoice.status::text,invoice.payment_status::text,invoice.payment_open_amount_cents,invoice.due_date,(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date) ORDER BY invoice.id) AS debt_ids
   FROM public.orders orders JOIN private.v_goods_out_ui_state_v1 state ON state.tenant_id=orders.tenant_id AND state.order_id=orders.id AND state.integrity_ok
   LEFT JOIN private.v_order_frozen_receipts_v1 freeze_state ON freeze_state.tenant_id=orders.tenant_id AND freeze_state.order_id=orders.id AND freeze_state.active AND freeze_state.integrity_ok
   WHERE orders.tenant_id=p_tenant AND orders.id=requested.order_id) source;
END;
$function$;
REVOKE ALL ON FUNCTION private.read_order_informed_orders_v1(text,text[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.read_order_informed_orders_v1(text,text[]) TO postgres;

CREATE FUNCTION private.read_invoice_shipping_headers_v1(p_tenant text,p_ids text[])
RETURNS TABLE ("id" text,"customer_id" text,"handover_mode" text,"version" integer,"order_number" text,"station" character varying,"current_station" text,"current_station_id" character varying,"status" character varying,"invoice_exists" boolean,"freeze_active" boolean,"freeze_invalid" boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, private
SET plan_cache_mode = force_generic_plan
AS $function$
#variable_conflict use_column
BEGIN
 RETURN QUERY

   SELECT orders.id,orders.customer_id,orders.handover_mode,orders.version,orders.order_number,
    orders.station,orders.current_station,orders.current_station_id,orders.status,
    EXISTS(SELECT 1 FROM private.v_invoice_order_members_v1 member JOIN public.invoices invoice ON invoice.tenant_id=member.tenant_id AND invoice.id=member.invoice_id
     WHERE member.tenant_id=orders.tenant_id AND member.order_id=orders.id AND invoice.status='issued') AS invoice_exists,
    EXISTS(SELECT 1 FROM private.v_order_freeze_state_v1 frozen WHERE frozen.tenant_id=orders.tenant_id AND frozen.order_id=orders.id AND frozen.active) AS freeze_active,
    (EXISTS(SELECT 1 FROM private.v_order_freeze_state_v1 frozen WHERE frozen.tenant_id=orders.tenant_id AND frozen.order_id=orders.id AND frozen.integrity_ok IS NOT TRUE)
     OR EXISTS(SELECT 1 FROM public.events event WHERE event.tenant_id=orders.tenant_id AND event.order_id=orders.id AND event.event_type='ORDER_FROZEN_V1'
      AND NOT EXISTS(SELECT 1 FROM private.v_order_freeze_state_v1 frozen WHERE frozen.tenant_id=event.tenant_id AND frozen.order_id=event.order_id AND frozen.event_id=event.id))) AS freeze_invalid
   FROM public.orders orders WHERE orders.tenant_id=p_tenant AND orders.id=ANY(p_ids);
END;
$function$;
REVOKE ALL ON FUNCTION private.read_invoice_shipping_headers_v1(text,text[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.read_invoice_shipping_headers_v1(text,text[]) TO postgres;

CREATE FUNCTION private.read_order_payment_states_v1(p_tenant text,p_ids text[])
RETURNS TABLE ("batch_order_id" text,"order_id" text,"tenant_id" character varying,"order_number" text,"order_version" integer,"station" character varying,"current_station" text,"current_station_id" character varying,"order_status" character varying,"payment_mode" text,"payment_mode_version" integer,"invoice_state" text,"active_invoice_count" integer,"invoice_id" uuid,"invoice_number" text,"total_amount_cents" integer,"payment_contract_version" integer,"payment_status" text,"payment_open_amount_cents" integer,"payment_paid_amount_cents" integer,"payment_currency" text,"payment_method" text,"payment_paid_at" timestamp with time zone,"payment_receipt_id" text,"payment_event_id" text,"payment_correlation_id" uuid,"payment_version" integer,"payment_goods_out_allowed" boolean,"payment_integrity_ok" boolean,"payment_actor_id" uuid,"goods_out_event_count" integer,"goods_out_event_id" text,"goods_out_client_event_id" uuid,"goods_out_correlation_id" uuid,"goods_out_event_schema_version" integer,"goods_out_order_version" integer,"goods_out_actor_id" uuid,"goods_out_occurred_at" text,"goods_out_mode" text,"goods_out_allowed" boolean,"integrity_ok" boolean,"rework_complaint_id" text,"all_invoice_payments_allowed" boolean,"payment_collection_source" jsonb,"credit_customer_id" text,"customer_overdue_invoice_ids" text[])
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, private
SET plan_cache_mode = force_generic_plan
AS $function$
#variable_conflict use_column
BEGIN
 RETURN QUERY
 SELECT requested.order_id AS batch_order_id,source.* FROM unnest(p_ids) requested(order_id) LEFT JOIN LATERAL (
        SELECT state.*, parent.customer_id AS credit_customer_id, ARRAY (
          SELECT invoice.id::text FROM public.invoices invoice
          JOIN public.orders orders
            ON orders.tenant_id = invoice.tenant_id
            AND orders.customer_id = invoice.customer_id
          WHERE orders.tenant_id = state.tenant_id
            AND orders.id = state.order_id
            AND private.invoice_is_overdue_v1(invoice.status::text,invoice.payment_status::text,invoice.payment_open_amount_cents,invoice.due_date,(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date)
          ORDER BY invoice.due_date,invoice.id
        ) AS customer_overdue_invoice_ids
        FROM private.v_goods_out_ui_state_v1 state
        JOIN public.orders parent ON parent.tenant_id=state.tenant_id AND parent.id=state.order_id
        WHERE state.tenant_id=p_tenant AND state.order_id = requested.order_id
        LIMIT 2
      ) source ON true;
END;
$function$;
REVOKE ALL ON FUNCTION private.read_order_payment_states_v1(text,text[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.read_order_payment_states_v1(text,text[]) TO postgres;
