-- Qualify print columns against the existing order_id output parameter.
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
 UPDATE public.print_jobs pj SET status='storniert' WHERE pj.tenant_id=p_tenant AND pj.order_id=o.id AND pj.status='wartet' AND pj.attempts=0;
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
