-- PL22.11.11:36 K5/K6/K7: keep authentication off the derived row locks,
-- observe actual source-sequence changes, and persist the background shadow
-- interval/claim in the existing settings and derived tenant row.
-- Existing RLS, trigger inventory, source mapping and grants remain unchanged.
ALTER TABLE public.company_settings ADD COLUMN today_shadow_interval_ms integer NOT NULL DEFAULT 60000
 CHECK(today_shadow_interval_ms>0);
ALTER TABLE private.today_tenant_v1 ADD COLUMN shadow_checked_at timestamptz;

CREATE OR REPLACE FUNCTION private.today_mark_rows_v1(source_table text, changed jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
DECLARE created_tenants text[]; marked_rows bigint;
BEGIN
 -- Authentication/session events classified as irrelevant never acquire E.
 -- Retain the existing explicit order link if one is actually present.
 IF source_table='public.events' THEN
  SELECT coalesce(jsonb_agg(row),'[]'::jsonb) INTO changed
  FROM jsonb_array_elements(changed) row
  WHERE row->>'order_id' IS NOT NULL OR private.today_event_scope_v1(row->>'event_type')<>'none';
 END IF;
 IF jsonb_array_length(changed)=0 THEN RETURN; END IF;
 created_tenants:=private.today_lock_tenants_v1(ARRAY(SELECT DISTINCT row->>'tenant_id' FROM jsonb_array_elements(changed) row WHERE row->>'tenant_id' IS NOT NULL ORDER BY row->>'tenant_id'));
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
 ON CONFLICT(tenant_id) DO UPDATE SET tenant_seq=today_tenant_v1.tenant_seq+CASE WHEN EXCLUDED.tenant_id=ANY(created_tenants) THEN 0 ELSE 1 END;

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
 GET DIAGNOSTICS marked_rows=ROW_COUNT;
 -- Transaction-local technical observation only. Native savepoint/transaction
 -- rollback also rolls this flag back; no actor or command result is inferred.
 IF marked_rows>0 THEN PERFORM set_config('app.today_source_changed','1',true); END IF;
END $$;
REVOKE ALL ON FUNCTION private.today_mark_rows_v1(text,jsonb) FROM PUBLIC,anon,authenticated;
