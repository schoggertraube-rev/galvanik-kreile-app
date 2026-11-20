-- S38a: existing order/payment read uses every frozen native collection member.
-- No representative order, no new money calculation or payment source.
CREATE OR REPLACE VIEW private.v_goods_out_ui_state_v1 WITH (security_invoker=true) AS
 SELECT orders.id AS order_id,
    orders.tenant_id,
    orders.order_number,
    orders.version AS order_version,
    orders.station,
    orders.current_station,
    orders.current_station_id,
    orders.status AS order_status,
    orders.payment_mode,
    orders.payment_mode_version,
        CASE
            WHEN invoice_state.active_invoice_count = 0 THEN 'not_issued'::text
            ELSE 'issued'::text
        END AS invoice_state,
    invoice_state.active_invoice_count,
    payment.invoice_id,
    payment.invoice_number,
    payment.total_amount_cents,
    payment.payment_contract_version,
    payment.payment_status,
    payment.payment_open_amount_cents,
    payment.payment_paid_amount_cents,
    payment.payment_currency,
    payment.payment_method,
    payment.payment_paid_at,
    payment.payment_receipt_id,
    payment.payment_event_id,
    payment.payment_correlation_id,
    payment.payment_version,
    payment.goods_out_allowed AS payment_goods_out_allowed,
    payment.integrity_ok AS payment_integrity_ok,
    payment_actor.user_id AS payment_actor_id,
    COALESCE(goods_out.event_count, 0) AS goods_out_event_count,
    goods_out.event_id AS goods_out_event_id,
    goods_out.client_event_id AS goods_out_client_event_id,
    goods_out.correlation_id AS goods_out_correlation_id,
    goods_out.event_schema_version AS goods_out_event_schema_version,
    goods_out.aggregate_version AS goods_out_order_version,
    goods_out.user_id AS goods_out_actor_id,
    to_char((goods_out.created_at AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) AS goods_out_occurred_at,
    goods_out.payload ->> 'mode'::text AS goods_out_mode,
    orders.station::text = 'fertig'::text AND orders.current_station = 'fertig'::text AND orders.current_station_id::text = 'fertig'::text AND orders.status::text = 'fertig'::text AND (orders.payment_mode = 'keiner'::text AND orders.nacharbeit_zu IS NOT NULL AND invoice_state.active_invoice_count = 0 OR invoice_state.active_invoice_count = 0 AND orders.payment_mode = 'rechnung'::text OR invoice_state.active_invoice_count >= 1 AND payment.goods_out_allowed = true AND all_payment.goods_out_allowed IS TRUE) AS goods_out_allowed,
    COALESCE(orders.tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) AND orders.payment_mode_version >= 0 AND orders.station::text = orders.current_station AND orders.station::text = orders.current_station_id::text AND orders.station::text = orders.status::text AND (invoice_state.active_invoice_count = 0 OR invoice_state.main_invoice_count = 1) AND (invoice_state.active_invoice_count = 0 OR all_payment.invoice_count = invoice_state.active_invoice_count AND all_payment.integrity_ok IS TRUE) AND (orders.payment_mode = 'keiner'::text AND orders.nacharbeit_zu IS NOT NULL AND invoice_state.active_invoice_count = 0 AND payment.invoice_id IS NULL OR (orders.payment_mode = ANY (ARRAY['vorkasse'::text, 'abholung'::text, 'rechnung'::text])) AND (invoice_state.active_invoice_count = 0 AND payment.invoice_id IS NULL OR invoice_state.active_invoice_count >= 1 AND payment.invoice_id IS NOT NULL AND payment.integrity_ok = true AND payment.payment_mode = orders.payment_mode AND (payment.order_id IS NULL AND payment.collection_source IS NOT NULL OR payment.order_id = orders.id AND payment.payment_mode_version = orders.payment_mode_version) AND (payment_actor.user_id IS NOT NULL OR payment.payment_event_id IS NULL))) AND (COALESCE(goods_out.event_count, 0) = 0 OR goods_out.event_count = 1 AND goods_out.event_id IS NOT NULL AND goods_out.user_id IS NOT NULL AND goods_out.aggregate_version <= orders.version AND (goods_out.aggregate_version = orders.version OR (( SELECT count(DISTINCT handover.aggregate_version) AS count
           FROM events handover
             JOIN app_users handover_actor ON handover_actor.tenant_id = handover.tenant_id::text AND handover_actor.id = handover.user_id
             JOIN intake_item original ON original.tenant_id = handover.tenant_id::text AND original.id::text = (((handover.payload -> 'receipt'::text) -> 'mailActor'::text) ->> 'originalItemId'::text)
             JOIN intake_event applied ON applied.tenant_id = handover.tenant_id::text AND applied.item_id = original.id AND applied.befehl_id = handover.client_event_id AND applied.von = handover.user_id::text
             JOIN tasks callback_task ON callback_task.tenant_id = handover.tenant_id::text AND callback_task.id::text = ((handover.payload -> 'receipt'::text) ->> 'taskId'::text) AND callback_task.bezug_id = orders.id AND callback_task.art = 'rueckruf'::text
          WHERE handover.tenant_id::text = orders.tenant_id::text AND handover.order_id = orders.id AND handover.event_type::text = 'ORDER_HANDOVER_MAIL_V1'::text AND handover.event_schema_version = 1 AND handover.status::text = 'success'::text AND handover.client_event_id IS NOT NULL AND handover.correlation_id IS NOT NULL AND handover.aggregate_version > goods_out.aggregate_version AND handover.aggregate_version <= orders.version AND (handover.payload ->> 'requestHash'::text) ~ '^[0-9a-f]{64}$'::text AND ((handover.payload -> 'receipt'::text) ->> 'orderId'::text) = orders.id AND ((handover.payload -> 'receipt'::text) ->> 'customerId'::text) = orders.customer_id AND ((handover.payload -> 'receipt'::text) ->> 'orderVersion'::text) = handover.aggregate_version::text AND (((handover.payload -> 'receipt'::text) ->> 'handoverMode'::text) = ANY (ARRAY['pickup'::text, 'shipping'::text])) AND ((handover.payload -> 'receipt'::text) ->> 'outcome'::text) = 'call_customer'::text AND ((handover.payload -> 'receipt'::text) ->> 'handoverMode'::text) = orders.handover_mode AND (((handover.payload -> 'receipt'::text) -> 'mailActor'::text) ->> 'kind'::text) = 'mail'::text AND (((handover.payload -> 'receipt'::text) -> 'mailActor'::text) ->> 'sender'::text) = original.absender_adresse AND original.kanal = 'mail'::text AND (applied.vorher ->> 'kunde_id'::text) = orders.customer_id AND (applied.nachher ->> 'customerId'::text) = orders.customer_id AND applied.art = 'anliegen'::text AND (applied.vorher ->> 'version'::text) = (((handover.payload -> 'receipt'::text) -> 'mailActor'::text) ->> 'originalVersion'::text) AND (applied.nachher ->> 'orderId'::text) = orders.id AND (applied.nachher ->> 'handoverMode'::text) = ((handover.payload -> 'receipt'::text) ->> 'handoverMode'::text) AND ((applied.nachher ->> 'action'::text) = ANY (ARRAY['auftrag.uebergabe_geaendert'::text, 'auftrag.uebergabe_klaeren'::text])) AND (EXISTS ( SELECT 1
                   FROM intake_file mime
                     JOIN intake_event secured ON secured.tenant_id = mime.tenant_id AND secured.item_id = mime.item_id AND secured.art = 'original_gespeichert'::text AND (secured.nachher ->> 'fileId'::text) = mime.id::text AND (secured.nachher ->> 'sha256'::text) = mime.sha256
                  WHERE mime.tenant_id = handover.tenant_id::text AND mime.item_id = original.id AND mime.art = 'mime'::text AND mime.sha256 = (((handover.payload -> 'receipt'::text) -> 'mailActor'::text) ->> 'originalSha256'::text))))) = (orders.version - goods_out.aggregate_version)) AND (goods_out.payload ->> 'orderId'::text) = orders.id AND (goods_out.payload ->> 'orderVersion'::text) = goods_out.aggregate_version::text AND ((goods_out.payload ->> 'mode'::text) = ANY (ARRAY['versand'::text, 'abholung'::text])) AND ((goods_out.event_type::text = ANY (ARRAY['ORDER_PICKED_UP_V1'::character varying, 'ORDER_PICKED_UP_V2'::character varying, 'ORDER_PICKED_UP_V3'::character varying]::text[])) AND (goods_out.payload ->> 'paymentMode'::text) = orders.payment_mode OR goods_out.event_type::text = 'ORDER_PICKED_UP_V4'::text AND orders.payment_mode = 'keiner'::text AND (goods_out.payload ->> 'paymentMode'::text) = 'keiner'::text AND (goods_out.payload ->> 'reworkComplaintId'::text) = orders.nacharbeit_zu)), false) AS integrity_ok,
    orders.nacharbeit_zu AS rework_complaint_id,
    all_payment.goods_out_allowed AS all_invoice_payments_allowed,
    payment.collection_source AS payment_collection_source
   FROM orders orders
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS active_invoice_count,
            count(*) FILTER (WHERE invoice.belegart = 'auftrag'::text)::integer AS main_invoice_count
           FROM invoices invoice
          WHERE invoice.tenant_id = orders.tenant_id::text AND (invoice.order_id = orders.id OR (invoice.order_id IS NULL AND EXISTS (SELECT 1 FROM private.v_invoice_order_members_v1 member WHERE member.tenant_id = orders.tenant_id::text AND member.invoice_id = invoice.id AND member.order_id = orders.id))) AND invoice.status = 'issued'::text) invoice_state ON true
     LEFT JOIN private.v_payment_summary_v1 payment ON payment.tenant_id = orders.tenant_id::text AND (payment.order_id = orders.id OR (payment.order_id IS NULL AND EXISTS (SELECT 1 FROM private.v_invoice_order_members_v1 member WHERE member.tenant_id = orders.tenant_id::text AND member.invoice_id = payment.invoice_id AND member.order_id = orders.id))) AND (EXISTS ( SELECT 1
           FROM invoices main_invoice
          WHERE main_invoice.tenant_id = orders.tenant_id::text AND main_invoice.id = payment.invoice_id AND main_invoice.belegart = 'auftrag'::text))
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS invoice_count,
            bool_and(summary.goods_out_allowed IS TRUE) AS goods_out_allowed,
            bool_and(summary.integrity_ok IS TRUE AND summary.payment_mode = orders.payment_mode AND (summary.order_id IS NULL AND summary.collection_source IS NOT NULL OR summary.order_id = orders.id AND summary.payment_mode_version = orders.payment_mode_version) AND (summary.payment_event_id IS NULL OR (EXISTS ( SELECT 1
                   FROM events actor_event
                  WHERE actor_event.tenant_id::text = orders.tenant_id::text AND actor_event.order_id IS NOT DISTINCT FROM summary.order_id AND (summary.order_id IS NOT NULL OR actor_event.payload ->> 'collectionId' = summary.collection_source ->> 'collectionId') AND actor_event.id = summary.payment_event_id AND actor_event.event_type::text = 'PAYMENT_CONFIRMED_V1'::text AND actor_event.user_id IS NOT NULL)))) AS integrity_ok
           FROM private.v_payment_summary_v1 summary
          WHERE summary.tenant_id = orders.tenant_id::text AND (summary.order_id = orders.id OR (summary.order_id IS NULL AND EXISTS (SELECT 1 FROM private.v_invoice_order_members_v1 member WHERE member.tenant_id = orders.tenant_id::text AND member.invoice_id = summary.invoice_id AND member.order_id = orders.id)))) all_payment ON true
     LEFT JOIN events payment_actor ON payment_actor.tenant_id::text = orders.tenant_id::text AND payment_actor.order_id IS NOT DISTINCT FROM payment.order_id AND (payment.order_id IS NOT NULL OR payment_actor.payload ->> 'collectionId' = payment.collection_source ->> 'collectionId') AND payment_actor.id = payment.payment_event_id AND payment_actor.event_type::text = 'PAYMENT_CONFIRMED_V1'::text
     LEFT JOIN LATERAL ( SELECT count(*) OVER ()::integer AS event_count,
            event.id AS event_id,
            event.client_event_id,
            event.correlation_id,
            event.event_schema_version,
            event.aggregate_version,
            event.user_id,
            event.created_at,
            event.payload,
            event.event_type
           FROM events event
          WHERE event.tenant_id::text = orders.tenant_id::text AND event.order_id = orders.id AND (event.event_type::text = ANY (ARRAY['ORDER_PICKED_UP_V1'::character varying, 'ORDER_PICKED_UP_V2'::character varying, 'ORDER_PICKED_UP_V3'::character varying, 'ORDER_PICKED_UP_V4'::character varying]::text[])) AND event.status::text = 'success'::text
          ORDER BY event.created_at DESC, event.id DESC
         LIMIT 1) goods_out ON true
  WHERE NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND orders.tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text);
