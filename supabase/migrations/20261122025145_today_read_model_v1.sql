-- PLAN_LADEZEIT E-B/E1. Additive, private derived reader results only.
-- Business commands remain authoritative; invalidation commits with each write.
CREATE TABLE private.today_source_v1 (
 tenant_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('order','orders','messages','money','complaints','quote_followups','quotes','tasks','company')),
 source_id text NOT NULL,
 listed boolean NOT NULL DEFAULT true,
 source_seq bigint NOT NULL DEFAULT 1,
 built_seq bigint NOT NULL DEFAULT 0,
 built_tenant_seq bigint NOT NULL DEFAULT 0,
 built_day date,
 projector_version integer NOT NULL DEFAULT 0,
 source_version integer,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','OK','SOURCE_INCOMPLETE','GONE')),
 error_code text,
 payload jsonb,
 built_at timestamptz,
 build_ms integer,
 PRIMARY KEY(tenant_id,kind,source_id)
);
CREATE INDEX today_source_v1_stale ON private.today_source_v1(tenant_id) WHERE source_seq<>built_seq;
CREATE INDEX today_source_v1_listed ON private.today_source_v1(tenant_id,kind) WHERE listed;
CREATE TABLE private.today_tenant_v1 (
 tenant_id text PRIMARY KEY,
 tenant_seq bigint NOT NULL DEFAULT 1,
 refresh_lease_until timestamptz,
 rebuilt_at timestamptz
);
ALTER TABLE private.today_source_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.today_tenant_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.today_source_v1,private.today_tenant_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON private.today_source_v1,private.today_tenant_v1 TO service_role;

ALTER TABLE public.company_settings
 ADD COLUMN today_read_source text NOT NULL DEFAULT 'modell' CHECK(today_read_source IN ('modell','live')),
 ADD COLUMN today_refresh_batch_limit integer NOT NULL DEFAULT 20 CHECK(today_refresh_batch_limit>0),
 ADD COLUMN today_refresh_lease_seconds integer NOT NULL DEFAULT 30 CHECK(today_refresh_lease_seconds>0),
 ADD COLUMN today_stale_poll_ms integer NOT NULL DEFAULT 1500 CHECK(today_stale_poll_ms BETWEEN 1 AND 2147483647),
 ADD COLUMN nav_prefetch_max_age_seconds integer NOT NULL DEFAULT 60 CHECK(nav_prefetch_max_age_seconds>0);

-- EVENT_SCOPE_INVENTORY: generated once from the reviewed event constants.
-- New types invalidate the tenant and must be explicitly classified by E-G3.

CREATE FUNCTION private.today_event_scope_v1(event_type text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path=pg_catalog AS $scope$
 SELECT CASE
  WHEN event_type IN (
   'ORDER_CANCELLED_V1',
   'ORDER_COLLECTION_ATTACH_PENDING_V1',
   'ORDER_COLLECTION_ATTACH_REPAIRED_V1',
   'ORDER_COLLECTION_CALL_CREATED_V1',
   'ORDER_COLLECTION_CALL_RESULT_V1',
   'ORDER_COLLECTION_CALL_UPDATED_V1',
   'ORDER_COLLECTION_MEMBER_REMOVED_V1',
   'ORDER_COLLECTION_PLANNED_V1',
   'ORDER_COLLECTION_REMINDER_PREPARED_V1',
   'ORDER_COLLECTION_REMINDER_SENT_V1',
   'ORDER_COLLECTION_REPLY_RECORDED_V1',
   'ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1',
   'ORDER_COLLECTION_TASK_ENDED_FOR_REPLY_V1',
   'ORDER_CONTENT_CHANGED_V1',
   'ORDER_CUSTOMER_INFORMED_V1',
   'ORDER_FREEZE_CORRECTED_V1',
   'ORDER_FROZEN_V1',
   'ORDER_GOODS_OUT_DEBT_OVERRIDE_V1',
   'ORDER_HANDOVER_CHANGED_V1',
   'ORDER_HANDOVER_MAIL_V1',
   'ORDER_INTAKE_CREATED_V1',
   'ORDER_INTAKE_ORIGINAL_V1',
   'ORDER_INVOICE_PRICES_SET_V1',
   'ORDER_ITEM_EXTRA_WORK_CHANGED_V1',
   'ORDER_ITEM_FINISHED_CHANGED_V1',
   'ORDER_PICKED_UP_V1',
   'ORDER_PICKED_UP_V2',
   'ORDER_PICKED_UP_V3',
   'ORDER_PICKED_UP_V4',
   'ORDER_PICKUP_APPOINTMENT_SET_V1',
   'ORDER_PICKUP_NOTICE_CHANGED_V1',
   'ORDER_PRINT_JOBS_QUEUED_V1',
   'ORDER_PRINT_JOBS_RETIRED_V1',
   'ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1',
   'ORDER_PROMISED_DUE_DATE_CHANGED_V1',
   'ORDER_REWORK_CREATED_V1',
   'ORDER_STATION_CORRECTED_V1',
   'ORDER_STATION_MOVED_V1',
   'ORDER_STORAGE_FINAL_TASK_CLOSED_V1',
   'ORDER_STORAGE_FINAL_TASK_CREATED_V1',
   'ORDER_STORAGE_FINAL_TASK_UPDATED_V1',
   'ORDER_STORAGE_LETTER_VOIDED_V1',
   'ORDER_TASK_ASSIGNED_V1',
   'ORDER_TASK_HANDED_BACK_V1',
   'PAYMENT_MODE_SET_V1',
   'SHIPMENT_GROUP_HANDED_OVER_V1',
   'SHIPMENT_HANDED_OVER_V1',
   'SHIPMENT_MANUAL_TRACKING_SET_V1') THEN 'order'
  WHEN event_type IN (
   'COMMUNICATION_COLLECTION_EFFECT_RETRY_REQUIRED_V1',
   'COMMUNICATION_COMPLAINT_EFFECT_RETRY_REQUIRED_V1',
   'COMMUNICATION_DELIVERY_FAILED_V1',
   'COMMUNICATION_DOCUMENT_EFFECTS_APPLIED_V1',
   'COMMUNICATION_DOCUMENT_EFFECT_RETRY_REQUIRED_V1',
   'COMMUNICATION_DOCUMENT_PREPARED_V1',
   'COMMUNICATION_DOCUMENT_SENT_V1',
   'COMMUNICATION_INVOICE_HANDED_OVER_V1',
   'COMMUNICATION_INVOICE_TASK_CREATED_V1',
   'COMMUNICATION_MAIL_PREPARED_V1',
   'COMMUNICATION_MAIL_RESEND_CONFIRMED_V1',
   'COMMUNICATION_MAIL_SENT_V1',
   'CUSTOMER_AGREEMENT_REVOKED_V1',
   'CUSTOMER_AGREEMENT_SAVED_V1',
   'CUSTOMER_CREATED_V1',
   'CUSTOMER_CREDIT_PAYOUT_V1',
   'CUSTOMER_INVOICE_TERMS_ENABLED_V1',
   'CUSTOMER_UPDATED_V1') THEN 'customer'
  WHEN event_type IN (
   'INVOICE_CANCELLED_V1',
   'INVOICE_CREATED_V1',
   'INVOICE_CREATED_V2',
   'INVOICE_CREATED_V3',
   'INVOICE_MAIL_REMAINDER_PENDING_V1',
   'INVOICE_MAIL_REQUEST_SNAPSHOT_V1',
   'PAYMENT_CONFIRMED_V1') THEN 'invoice'
  WHEN event_type IN (
   'QUOTE_AWARDED_V1',
   'QUOTE_CALCULATION_V04',
   'QUOTE_COMPLAINT_LINKED_V1',
   'QUOTE_CONVERSION_REVERSED_V04',
   'QUOTE_CREATED_V1',
   'QUOTE_FOLLOWUP_COMPLETED_V1',
   'QUOTE_LIFECYCLE_V04',
   'QUOTE_MINUTES_FROM_TOTAL_V1',
   'QUOTE_ONSITE_PHASE_V04',
   'QUOTE_ONSITE_REQUESTED_V04',
   'QUOTE_ORDER_TASK_V1',
   'QUOTE_SETTINGS_UPDATED_V04',
   'QUOTE_SHIPPING_INCLUDED_SET_V1',
   'QUOTE_UPDATED_V1',
   'QUOTE_VAT_FROM_COMPANY_V1') THEN 'quote'
  WHEN event_type IN (
   'GOODS_RECEIPT_SAVED_V1',
   'INTAKE_DRAFT_DISCARDED_V1',
   'INTAKE_DRAFT_SAVED_V1') THEN 'intake'
  WHEN event_type IN (
   'USER_LAST_SEEN_RECORDED_V1') THEN 'none'
  WHEN event_type IN (
   'COMPLAINT_CHANGED_V1',
   'DELIVERY_NOTE_ORIGINAL_V1',
   'DELIVERY_NOTE_REQUESTED_V1',
   'DISPATCH_REPLY_RETRY_REQUIRED_V1',
   'EMAIL_TEMPLATE_UPDATED_V1',
   'EXTRA_WORK_CATALOG_CONFIGURED_V1',
   'EXTRA_WORK_RATE_SET_V1',
   'GALVANIK_HANDOFF_ORIGINAL_V1',
   'OFFLINE_NOTE_CONFLICT_TASK_V1',
   'OFFLINE_NOTE_CONFLICT_V1',
   'OFFLINE_WORKSHOP_REJECTED_TASK_V1',
   'OFFLINE_WORKSHOP_REJECTED_V1') THEN 'tenant'
  ELSE 'tenant' END
$scope$;
REVOKE ALL ON FUNCTION private.today_event_scope_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.today_event_scope_v1(text) TO service_role;

CREATE FUNCTION private.today_mark_rows_v1(source_table text, changed jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
BEGIN
 IF jsonb_array_length(changed)=0 THEN RETURN; END IF;
 -- Collect both transition tables before writing. Old relations matter when a
 -- source moves to another customer/order/tenant; never mark just NEW.
 WITH rows AS MATERIALIZED (
  SELECT row,row->>'tenant_id' AS tenant_id,row->>'id' AS id,
   CASE WHEN source_table='public.events' THEN private.today_event_scope_v1(row->>'event_type') ELSE NULL END AS event_scope
  FROM jsonb_array_elements(changed) row
 ), affected AS (
  SELECT tenant_id FROM rows
  WHERE source_table IN ('public.company_settings','public.catalog_services','public.feature_flags','public.tenant_features',
    'private.extra_work_hourly_rates','private.extra_work_catalog_positions','public.app_user_rights','public.app_users')
   OR source_table='public.events' AND (event_scope='tenant'
    OR event_scope IN ('order','customer','invoice','quote','intake') AND row->>'order_id' IS NULL
     AND NULLIF(row->'payload'->>CASE event_scope WHEN 'order' THEN 'orderId' WHEN 'customer' THEN 'customerId'
      WHEN 'invoice' THEN 'invoiceId' WHEN 'quote' THEN 'quoteId' ELSE 'itemId' END,'') IS NULL)
 )
 INSERT INTO private.today_tenant_v1(tenant_id)
 SELECT DISTINCT tenant_id FROM affected WHERE tenant_id IS NOT NULL ORDER BY tenant_id
 ON CONFLICT(tenant_id) DO UPDATE SET tenant_seq=today_tenant_v1.tenant_seq+1;

 WITH rows AS MATERIALIZED (
  SELECT row,row->>'tenant_id' AS tenant_id,row->>'id' AS id,
   CASE WHEN source_table='public.events' THEN private.today_event_scope_v1(row->>'event_type') ELSE NULL END AS event_scope
  FROM jsonb_array_elements(changed) row
 ), base AS (
  SELECT tenant_id,'order'::text AS kind,id AS source_id FROM rows WHERE source_table='public.orders'
  UNION ALL
  SELECT tenant_id,'order',row->>'order_id' FROM rows WHERE row->>'order_id' IS NOT NULL
  UNION ALL
  SELECT tenant_id,'order',row->>'auftrag_id' FROM rows WHERE source_table='public.goods_receipt'
  UNION ALL
  SELECT tenant_id,'order',row->'payload'->>'orderId' FROM rows WHERE source_table='public.events' AND event_scope='order'
  UNION ALL
  SELECT r.tenant_id,'order',o.id FROM rows r JOIN public.orders o ON o.tenant_id=r.tenant_id AND o.customer_id=CASE
    WHEN source_table='public.customers' THEN r.id
    WHEN source_table='public.events' THEN r.row->'payload'->>'customerId'
    ELSE r.row->>'customer_id' END
   WHERE source_table IN ('public.customers','public.customer_agreements') OR source_table='public.events' AND event_scope='customer'
  UNION ALL
  SELECT r.tenant_id,'order',member.order_id FROM rows r JOIN public.invoice_collection_orders member
   ON member.tenant_id=r.tenant_id AND member.collection_id::text=r.id WHERE source_table='public.invoice_collections'
  UNION ALL
  SELECT r.tenant_id,'order',member.order_id FROM rows r JOIN private.v_invoice_order_members_v1 member
   ON member.tenant_id=r.tenant_id AND member.invoice_id::text=r.row->'payload'->>'invoiceId'
   WHERE source_table='public.events' AND event_scope='invoice'
  UNION ALL
  SELECT r.tenant_id,'order',thread.order_id FROM rows r JOIN public.communication_threads thread
   ON thread.tenant_id=r.tenant_id AND thread.id::text=r.row->>'thread_id' WHERE source_table='public.communication_messages'
  UNION ALL
  SELECT r.tenant_id,'order',quote.linked_order_id FROM rows r JOIN private.quotes quote
   ON quote.tenant_id=r.tenant_id AND quote.id::text=CASE WHEN source_table='private.quotes' THEN r.id
    WHEN source_table='public.events' THEN r.row->'payload'->>'quoteId' ELSE r.row->>'quote_id' END
   WHERE source_table IN ('private.quotes','private.quote_positions') OR source_table='public.events' AND event_scope='quote'
  UNION ALL
  SELECT tenant_id,'order',row->>'linked_order_id' FROM rows WHERE source_table='private.quotes'
  UNION ALL
  SELECT r.tenant_id,'order',CASE WHEN link.target_type='ORDER' THEN link.target_id ELSE item.order_id END
   FROM rows r JOIN private.evidence_domain_links link ON link.tenant_id=r.tenant_id AND
    CASE WHEN source_table='private.order_station_evidence' THEN link.evidence_id::text=r.id ELSE link.id::text=r.id END
   LEFT JOIN public.items item ON item.tenant_id=link.tenant_id AND link.target_type='ORDER_ITEM' AND item.id=link.target_id
   WHERE source_table IN ('private.order_station_evidence','private.evidence_domain_links') AND link.target_type IN ('ORDER','ORDER_ITEM')
  UNION ALL
  SELECT r.tenant_id,'order',CASE WHEN r.row->>'target_type'='ORDER' THEN r.row->>'target_id' ELSE item.order_id END
   FROM rows r LEFT JOIN public.items item ON item.tenant_id=r.tenant_id AND item.id=r.row->>'target_id'
   WHERE source_table='private.evidence_domain_links' AND r.row->>'target_type' IN ('ORDER','ORDER_ITEM')
 ), intake_rows AS MATERIALIZED (
  SELECT r.tenant_id,r.row,CASE WHEN source_table='public.intake_item' THEN r.id
    WHEN source_table='public.events' THEN r.row->'payload'->>'itemId' ELSE r.row->>'item_id' END AS item_id
   FROM rows r WHERE source_table IN ('public.intake_event','public.intake_item','public.intake_file','public.intake_suggestion','public.goods_receipt','public.tasks')
    OR source_table='public.events' AND event_scope='intake'
 ), intake_orders AS (
  -- Literal existing v_goods_out_ui_state_v1 joins, including old transition
  -- item/event/task references. An unresolved intake relation marks all finished
  -- orders as required by E.3.3 instead of inventing an order association.
  SELECT DISTINCT r.tenant_id,r.row AS source_row,orders.id AS order_id FROM intake_rows r
   JOIN public.intake_item original ON original.tenant_id=r.tenant_id AND original.id::text=r.item_id
   JOIN public.events handover ON handover.tenant_id=original.tenant_id
    AND original.id::text=(((handover.payload->'receipt')->'mailActor')->>'originalItemId')
   JOIN public.intake_event applied ON applied.tenant_id=handover.tenant_id AND applied.item_id=original.id
    AND applied.befehl_id=handover.client_event_id AND applied.von=handover.user_id::text
   JOIN public.orders orders ON orders.tenant_id=handover.tenant_id AND orders.id=handover.order_id
   JOIN public.tasks callback_task ON callback_task.tenant_id=handover.tenant_id AND callback_task.id::text=((handover.payload->'receipt')->>'taskId')
    AND callback_task.bezug_id=orders.id AND callback_task.art='rueckruf'
  UNION
  SELECT r.tenant_id,r.row,o.id FROM intake_rows r JOIN public.orders o ON o.tenant_id=r.tenant_id
   AND (o.id=r.row->>'order_id' OR o.id=r.row->>'auftrag_id' OR r.row->>'bezug_typ'='auftrag' AND o.id=r.row->>'bezug_id')
 ), keys AS (
  SELECT tenant_id,kind,source_id FROM base
  UNION SELECT tenant_id,'order',order_id FROM intake_orders
  UNION SELECT DISTINCT r.tenant_id,'order',o.id FROM intake_rows r JOIN public.orders o ON o.tenant_id=r.tenant_id AND o.station='fertig'
   WHERE NOT EXISTS(SELECT 1 FROM intake_orders matched WHERE matched.tenant_id=r.tenant_id AND matched.source_row=r.row)
  UNION SELECT r.tenant_id,k.kind,'*' FROM rows r CROSS JOIN LATERAL unnest(CASE
   WHEN source_table IN ('public.customers','public.customer_agreements') THEN ARRAY['orders','messages','money','complaints','quote_followups','quotes','tasks','company']
   WHEN source_table='public.orders' THEN ARRAY['orders','money']
   WHEN source_table='public.items' THEN ARRAY['orders']
   WHEN source_table='public.events' THEN CASE WHEN r.row->>'order_id' IS NOT NULL THEN ARRAY['money']
    WHEN r.event_scope='none' THEN ARRAY[]::text[]
    WHEN r.event_scope='customer' THEN ARRAY['orders','messages','money','complaints','quote_followups','quotes','tasks','company']
    WHEN r.event_scope='quote' THEN ARRAY['quotes','quote_followups']
    WHEN r.event_scope='intake' THEN ARRAY['messages','tasks','quotes'] ELSE ARRAY['money'] END
   WHEN source_table IN ('public.invoices','public.payments','public.customer_credit_entries','public.invoice_collections','public.invoice_collection_orders') THEN ARRAY['money']
   WHEN source_table='public.complaints' THEN ARRAY['complaints']
   WHEN source_table IN ('public.communication_threads','public.communication_messages') THEN ARRAY['money','messages']
   WHEN source_table IN ('public.intake_event','public.intake_item','public.intake_file','public.intake_suggestion','public.goods_receipt','public.tasks') THEN ARRAY['messages','tasks','quotes']
   WHEN source_table IN ('private.quotes','private.quote_positions') THEN ARRAY['quotes','quote_followups']
   ELSE ARRAY[]::text[] END) k(kind)
 )
 INSERT INTO private.today_source_v1(tenant_id,kind,source_id)
 SELECT DISTINCT tenant_id,kind,source_id FROM keys WHERE tenant_id IS NOT NULL AND source_id IS NOT NULL
 ORDER BY tenant_id,kind,source_id
 ON CONFLICT(tenant_id,kind,source_id) DO UPDATE SET source_seq=today_source_v1.source_seq+1;
END $$;
REVOKE ALL ON FUNCTION private.today_mark_rows_v1(text,jsonb) FROM PUBLIC,anon,authenticated;

-- One statement trigger per operation is required by PostgreSQL transition
-- tables. Each operation collects all keys, then takes them in the same order.
DO $install$
DECLARE relation text; schema_name text; table_name text; function_name text;
BEGIN
 FOREACH relation IN ARRAY ARRAY[
  'public.orders','public.items','public.events','public.invoices','public.payments','public.customer_credit_entries',
  'public.invoice_collections','public.invoice_collection_orders','public.complaints',
  'public.communication_threads','public.communication_messages','public.intake_event','public.intake_item',
  'public.intake_file','public.intake_suggestion','public.goods_receipt','public.tasks','public.shipments',
  'private.order_freezes','private.order_freeze_corrections','private.order_frozen_extra_work_lines',
  'private.order_item_extra_work','private.order_intake_receipts','private.order_task_assignment_state',
  'private.quote_conversion_receipts','private.order_station_evidence','private.evidence_domain_links',
  'private.quotes','private.quote_positions','public.customers','public.customer_agreements',
  'public.company_settings','public.catalog_services','public.feature_flags','public.tenant_features',
  'private.extra_work_hourly_rates','private.extra_work_catalog_positions','public.app_user_rights','public.app_users'
 ] LOOP
  schema_name:=split_part(relation,'.',1); table_name:=split_part(relation,'.',2);
  function_name:='today_mark_'||table_name||'_v1';
  EXECUTE format($function$
   CREATE FUNCTION private.%I() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $body$
   DECLARE changed jsonb;
   BEGIN
    IF TG_OP='INSERT' THEN SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO changed FROM today_new r;
    ELSIF TG_OP='DELETE' THEN SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO changed FROM today_old r;
    ELSIF TG_TABLE_NAME='app_users' THEN
     SELECT coalesce(jsonb_agg(row),'[]'::jsonb) INTO changed FROM (
      SELECT to_jsonb(n) AS row FROM today_new n FULL JOIN today_old o ON to_jsonb(o)->>'id'=to_jsonb(n)->>'id'
       WHERE (to_jsonb(n)->'full_name',to_jsonb(n)->'active',to_jsonb(n)->'role',to_jsonb(n)->'tenant_id')
        IS DISTINCT FROM (to_jsonb(o)->'full_name',to_jsonb(o)->'active',to_jsonb(o)->'role',to_jsonb(o)->'tenant_id')
      UNION ALL
      SELECT to_jsonb(o) FROM today_old o FULL JOIN today_new n ON to_jsonb(n)->>'id'=to_jsonb(o)->>'id'
       WHERE (to_jsonb(n)->'full_name',to_jsonb(n)->'active',to_jsonb(n)->'role',to_jsonb(n)->'tenant_id')
        IS DISTINCT FROM (to_jsonb(o)->'full_name',to_jsonb(o)->'active',to_jsonb(o)->'role',to_jsonb(o)->'tenant_id')
     ) differences WHERE row IS NOT NULL;
    ELSE SELECT coalesce(jsonb_agg(row),'[]'::jsonb) INTO changed FROM (
     SELECT to_jsonb(r) AS row FROM today_new r UNION ALL SELECT to_jsonb(r) FROM today_old r
    ) transitions;
    END IF;
    PERFORM private.today_mark_rows_v1(%L,changed);
    RETURN NULL;
   END $body$;
  $function$,function_name,relation);
  EXECUTE format('REVOKE ALL ON FUNCTION private.%I() FROM PUBLIC,anon,authenticated',function_name);
  EXECUTE format('CREATE TRIGGER today_mark_insert_v1 AFTER INSERT ON %I.%I REFERENCING NEW TABLE AS today_new FOR EACH STATEMENT EXECUTE FUNCTION private.%I()',schema_name,table_name,function_name);
  EXECUTE format('CREATE TRIGGER today_mark_update_v1 AFTER UPDATE ON %I.%I REFERENCING OLD TABLE AS today_old NEW TABLE AS today_new FOR EACH STATEMENT EXECUTE FUNCTION private.%I()',schema_name,table_name,function_name);
  EXECUTE format('CREATE TRIGGER today_mark_delete_v1 AFTER DELETE ON %I.%I REFERENCING OLD TABLE AS today_old FOR EACH STATEMENT EXECUTE FUNCTION private.%I()',schema_name,table_name,function_name);
 END LOOP;
END $install$;
