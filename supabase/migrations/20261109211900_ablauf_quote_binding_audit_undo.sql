-- Binding missing historical terms is part of the same conversion, not a follow-up action.
-- Only matching quote/edition audits are excluded; invoices, processing and all other guards remain.
CREATE OR REPLACE FUNCTION private.quote_conversion_undo_reason_v1(p_tenant text,p_quote uuid) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE q private.quotes%ROWTYPE; o public.orders%ROWTYPE;
BEGIN
 IF p_tenant IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id',true)),'') THEN RETURN 'Mandant ist nicht freigegeben'; END IF;
 SELECT * INTO q FROM private.quotes WHERE tenant_id=p_tenant AND id=p_quote;
 IF NOT FOUND OR q.status<>'converted' OR q.linked_order_id IS NULL THEN RETURN 'Kein aktueller Auftrag aus diesem KV'; END IF;
 SELECT * INTO o FROM public.orders WHERE tenant_id=p_tenant AND id=q.linked_order_id;
 IF NOT FOUND THEN RETURN 'Auftrag ist nicht verfügbar'; END IF;
 IF o.station NOT IN ('angenommen','wareneingang') OR o.status='storniert' THEN RETURN 'Auftrag ist nicht mehr in der Annahme'; END IF;
 IF o.version<>1 OR o.completed_date IS NOT NULL THEN RETURN 'Auftrag wurde nach der Anlage geändert'; END IF;
 IF EXISTS(SELECT 1 FROM public.items WHERE tenant_id=p_tenant AND order_id=o.id AND (coalesce(current_step,0)>0 OR coalesce(current_station_id,'angenommen') NOT IN ('angenommen','wareneingang'))) THEN RETURN 'Ein Teil wurde bereits bearbeitet'; END IF;
 IF EXISTS(SELECT 1 FROM public.invoices WHERE tenant_id=p_tenant AND order_id=o.id) THEN RETURN 'Eine Rechnung ist vorhanden'; END IF;
 IF EXISTS(SELECT 1 FROM public.shipments WHERE tenant_id=p_tenant AND order_id=o.id) THEN RETURN 'Ein Versand ist vorhanden'; END IF;
 IF EXISTS(SELECT 1 FROM public.events WHERE tenant_id=p_tenant AND order_id=o.id AND status='success' AND event_type NOT IN ('ORDER_INTAKE_CREATED_V1','GOODS_RECEIPT_SAVED_V1') AND NOT (event_type IN ('QUOTE_VAT_FROM_COMPANY_V1','QUOTE_MINUTES_FROM_TOTAL_V1') AND payload->>'quoteId'=q.id::text AND payload->>'edition'=q.fassung::text)) THEN RETURN 'Eine Folgehandlung wurde protokolliert'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.v_quote_conversion_receipts_v1 WHERE tenant_id=p_tenant AND quote_id=q.id AND order_id=o.id AND integrity_ok) THEN RETURN 'Umwandlungsbeleg ist nicht vollständig'; END IF;
 IF EXISTS(SELECT 1 FROM public.intake_event binding JOIN public.intake_item original ON original.tenant_id=binding.tenant_id AND original.id=binding.item_id
   WHERE binding.tenant_id=p_tenant AND binding.vorher->>'vorgang_art'='kv' AND binding.vorher->>'vorgang_id'=p_quote::text
     AND binding.nachher->>'vorgangId'=o.id AND (original.vorgang_art IS DISTINCT FROM 'auftrag' OR original.vorgang_id IS DISTINCT FROM o.id OR original.version<>(binding.vorher->>'version')::integer+1)) THEN RETURN 'Ein Original wurde nach der Zuordnung geändert'; END IF;
 RETURN NULL;
END; $fn$;
