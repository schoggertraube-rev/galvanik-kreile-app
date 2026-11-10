-- Preserve pre-existing KV undo after adding the automatic intake print queue.
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
 -- Initial unprocessed sheets belong to intake, not a later business action.
 IF EXISTS(SELECT 1 FROM public.events e WHERE e.tenant_id=p_tenant AND e.order_id=o.id AND e.status='success'
  AND e.event_type NOT IN ('ORDER_INTAKE_CREATED_V1','GOODS_RECEIPT_SAVED_V1')
  AND NOT (e.event_type IN ('QUOTE_VAT_FROM_COMPANY_V1','QUOTE_MINUTES_FROM_TOTAL_V1') AND e.payload->>'quoteId'=q.id::text AND e.payload->>'edition'=q.fassung::text)
  AND NOT (e.event_type='ORDER_PRINT_JOBS_QUEUED_V1' AND e.event_schema_version=1 AND e.aggregate_version=1
   AND e.payload->>'orderId'=o.id AND e.payload->>'orderVersion'='1'
   AND EXISTS(SELECT 1 FROM public.events intake WHERE intake.tenant_id=p_tenant AND intake.order_id=o.id AND intake.event_type='ORDER_INTAKE_CREATED_V1' AND intake.status='success' AND intake.client_event_id=e.client_event_id AND intake.user_id=e.user_id)
   AND jsonb_typeof(e.payload->'jobIds')='array'
   AND (SELECT count(*) FROM public.print_jobs j WHERE j.tenant_id=p_tenant AND j.order_id=o.id AND j.request_key=e.client_event_id)=jsonb_array_length(e.payload->'jobIds')
   AND jsonb_array_length(e.payload->'jobIds')=(SELECT count(*)+1 FROM public.items i WHERE i.tenant_id=p_tenant AND i.order_id=o.id)
   AND NOT EXISTS(SELECT 1 FROM public.print_jobs j WHERE j.tenant_id=p_tenant AND j.order_id=o.id
     AND (j.request_key<>e.client_event_id OR j.status<>'wartet' OR j.attempts<>0 OR j.content_version<>1 OR NOT e.payload->'jobIds' ? j.id::text)))) THEN RETURN 'Eine Folgehandlung wurde protokolliert'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.v_quote_conversion_receipts_v1 WHERE tenant_id=p_tenant AND quote_id=q.id AND order_id=o.id AND integrity_ok) THEN RETURN 'Umwandlungsbeleg ist nicht vollständig'; END IF;
 IF EXISTS(SELECT 1 FROM public.intake_event binding JOIN public.intake_item original ON original.tenant_id=binding.tenant_id AND original.id=binding.item_id
   WHERE binding.tenant_id=p_tenant AND binding.vorher->>'vorgang_art'='kv' AND binding.vorher->>'vorgang_id'=p_quote::text
     AND binding.nachher->>'vorgangId'=o.id AND (original.vorgang_art IS DISTINCT FROM 'auftrag' OR original.vorgang_id IS DISTINCT FROM o.id OR original.version<>(binding.vorher->>'version')::integer+1)) THEN RETURN 'Ein Original wurde nach der Zuordnung geändert'; END IF;
 RETURN NULL;
END; $fn$;

CREATE OR REPLACE FUNCTION private.reverse_quote_conversion_v1(p_tenant text,p_actor uuid,p_quote uuid,p_expected integer,p_client uuid,p_hash text,p_reason text)
RETURNS TABLE(result_code text,order_id text,replayed boolean,message text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE q private.quotes%ROWTYPE; o public.orders%ROWTYPE; prior public.events%ROWTYPE; blocked text; receipt_ids jsonb; original record;
 event_id text:=gen_random_uuid()::text; correlation uuid:=gen_random_uuid();
BEGIN
 IF p_tenant IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id',true)),'') OR p_actor IS NULL OR p_client IS NULL
   OR p_quote IS NULL OR p_expected IS NULL OR p_expected<1 OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 4000
   OR NOT EXISTS(SELECT 1 FROM public.app_users WHERE tenant_id=p_tenant AND id=p_actor AND active) THEN
  RETURN QUERY SELECT 'VALIDATION_ERROR',NULL::text,false,'Rücknahme braucht einen aktiven Akteur und einen Grund';RETURN;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('path1:quote-convert:'||p_tenant||':'||p_quote::text,0));
 SELECT * INTO prior FROM public.events WHERE tenant_id=p_tenant AND user_id=p_actor AND client_event_id=p_client;
 IF FOUND THEN
  IF prior.event_type<>'QUOTE_CONVERSION_REVERSED_V04' OR prior.payload->>'intentSha256' IS DISTINCT FROM p_hash THEN
   RETURN QUERY SELECT 'CONFLICT',NULL::text,false,'Kennung wurde für andere Angaben verwendet';
  ELSE RETURN QUERY SELECT 'OK',prior.payload->>'orderId',true,NULL::text; END IF;RETURN;
 END IF;
 SELECT * INTO q FROM private.quotes WHERE tenant_id=p_tenant AND id=p_quote FOR UPDATE;
 IF NOT FOUND OR q.version<>p_expected THEN RETURN QUERY SELECT 'CONFLICT',NULL::text,false,'KV wurde inzwischen geändert';RETURN; END IF;
 SELECT * INTO o FROM public.orders WHERE tenant_id=p_tenant AND id=q.linked_order_id FOR UPDATE;
 PERFORM id FROM public.items WHERE tenant_id=p_tenant AND public.items.order_id=o.id ORDER BY id FOR UPDATE;
 PERFORM id FROM public.goods_receipt WHERE tenant_id=p_tenant AND kv_id=q.id AND auftrag_id=o.id ORDER BY id FOR UPDATE;
 blocked:=private.quote_conversion_undo_reason_v1(p_tenant,p_quote);
 IF blocked IS NOT NULL THEN RETURN QUERY SELECT 'CONFLICT',NULL::text,false,blocked;RETURN; END IF;
 SELECT coalesce(jsonb_agg(id::text),'[]'::jsonb) INTO receipt_ids FROM public.goods_receipt WHERE tenant_id=p_tenant AND kv_id=q.id AND auftrag_id=o.id;
 IF jsonb_array_length(receipt_ids)=0 THEN RETURN QUERY SELECT 'CONFLICT',NULL::text,false,'Warenbeleg fehlt';RETURN; END IF;
 UPDATE public.orders SET status='storniert',ware='storniert',version=version+1 WHERE tenant_id=p_tenant AND id=o.id AND version=1;
 -- Keep original sheets, cancel only the verified untouched intake queue atomically.
 UPDATE public.print_jobs SET status='storniert' WHERE tenant_id=p_tenant AND order_id=o.id AND status='wartet' AND attempts=0;
 UPDATE public.orders SET print_symbol_active=false WHERE tenant_id=p_tenant AND id=o.id;
 INSERT INTO public.events(id,tenant_id,event_type,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,status,description,notes,payload)
 VALUES(event_id,p_tenant,'QUOTE_CONVERSION_REVERSED_V04',p_actor,p_client,1,correlation,q.version+1,'success','KV-Umwandlung zurückgenommen',p_reason,
   jsonb_build_object('quoteId',q.id::text,'orderId',o.id,'convertedVersion',q.version,'receiptIds',receipt_ids,'intentSha256',p_hash,'reason',p_reason));
 INSERT INTO public.events(id,tenant_id,order_id,event_type,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,status,description,notes,payload)
 VALUES(gen_random_uuid()::text,p_tenant,o.id,'ORDER_CANCELLED_V1',p_actor,gen_random_uuid(),1,correlation,2,'success','Auftrag aus KV zurückgenommen',p_reason,
   jsonb_build_object('quoteId',q.id::text,'undoEventId',event_id,'reason',p_reason));
 UPDATE public.goods_receipt SET auftrag_id=NULL,mengen=(SELECT jsonb_agg(value-'teil_id') FROM jsonb_array_elements(mengen)),version=version+1,geaendert_am=statement_timestamp()
 WHERE tenant_id=p_tenant AND kv_id=q.id AND auftrag_id=o.id;
 FOR original IN SELECT DISTINCT ON(source.id) source.*,binding.vorher AS binding_before FROM public.intake_item source JOIN public.intake_event binding ON binding.tenant_id=source.tenant_id AND binding.item_id=source.id
   WHERE source.tenant_id=p_tenant AND source.vorgang_art='auftrag' AND source.vorgang_id=o.id
    AND binding.vorher->>'vorgang_art'='kv' AND binding.vorher->>'vorgang_id'=q.id::text AND binding.nachher->>'vorgangId'=o.id
   ORDER BY source.id,binding.zeit DESC,binding.id DESC
 LOOP
  UPDATE public.intake_item SET vorgang_art='kv',vorgang_id=q.id::text,einsatz=coalesce(original.binding_before->>'einsatz','offen'),version=version+1,
    geaendert_von=p_actor,geaendert_am=statement_timestamp(),updated_at=statement_timestamp() WHERE tenant_id=p_tenant AND id=original.id AND version=original.version;
  INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher) VALUES(p_tenant,original.id,'einsatz',p_client,p_actor,to_jsonb(original),
    jsonb_build_object('action','kv.umwandlung_zurueckgenommen','quoteId',q.id,'orderId',o.id));
 END LOOP;
 INSERT INTO private.quote_positions(tenant_id,quote_id,revision,position,name,quantity,material,surface_requested,unit_price_cents,zeilen_gesamt_cents,unit,aufwand_min,vat_rate_basis_points)
 SELECT tenant_id,quote_id,q.version+1,position,name,quantity,material,surface_requested,unit_price_cents,zeilen_gesamt_cents,unit,aufwand_min,vat_rate_basis_points FROM private.quote_positions WHERE tenant_id=p_tenant AND quote_id=q.id AND revision=q.version;
 UPDATE private.quotes SET status='draft',version=q.version+1,linked_order_id=NULL,converted_at=NULL,updated_by=p_actor,updated_at=statement_timestamp() WHERE tenant_id=p_tenant AND id=q.id AND version=q.version;
 RETURN QUERY SELECT 'OK',o.id,false,NULL::text;
END; $fn$;
