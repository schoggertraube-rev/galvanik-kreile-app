-- U-250 / PL 08.11.16:03: compensate a pristine conversion without deleting its history.
CREATE UNIQUE INDEX events_quote_awarded_revision_uidx ON public.events(tenant_id,(payload->>'quoteId'),aggregate_version) WHERE event_type='QUOTE_AWARDED_V1';
DROP INDEX public.events_quote_awarded_uidx;
ALTER TABLE private.quote_conversion_requests ADD CONSTRAINT quote_conversion_requests_revision_key UNIQUE(tenant_id,quote_id,expected_version);
ALTER TABLE private.quote_conversion_requests DROP CONSTRAINT quote_conversion_requests_quote_key;
ALTER TABLE private.quote_conversion_receipts ADD CONSTRAINT quote_conversion_receipts_revision_key UNIQUE(tenant_id,quote_id,quote_version);
ALTER TABLE private.quote_conversion_receipts DROP CONSTRAINT quote_conversion_receipts_quote_key;

CREATE OR REPLACE FUNCTION private.prepare_quote_conversion_v1(
  p_tenant_id text,
  p_actor_id uuid,
  p_quote_id uuid,
  p_client_event_id uuid,
  p_intent_sha256 text,
  p_order_intent_sha256 text,
  p_expected_version integer
)
RETURNS TABLE(result_code text, order_input jsonb, replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quote private.quotes%ROWTYPE;
  v_request private.quote_conversion_requests%ROWTYPE;
  v_items jsonb;
  v_replayed boolean := false;
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
     OR p_actor_id IS NULL OR p_quote_id IS NULL OR p_client_event_id IS NULL
     OR p_intent_sha256 !~ '^[0-9a-f]{64}$'
     OR p_order_intent_sha256 !~ '^[0-9a-f]{64}$'
     OR p_expected_version IS NULL OR p_expected_version < 1 OR p_expected_version > 2147483647
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::jsonb, false; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('path1:quote-convert:' || p_tenant_id || ':' || p_quote_id::text, 0));
  SELECT * INTO v_request FROM private.quote_conversion_requests
   WHERE tenant_id = p_tenant_id AND actor_id = p_actor_id AND client_event_id = p_client_event_id;
  IF FOUND THEN
    IF v_request.quote_id IS DISTINCT FROM p_quote_id OR v_request.intent_sha256 IS DISTINCT FROM p_intent_sha256
       OR v_request.order_intent_sha256 IS DISTINCT FROM p_order_intent_sha256
       OR v_request.expected_version IS DISTINCT FROM p_expected_version
    THEN RETURN QUERY SELECT 'CONFLICT', NULL::jsonb, false; RETURN; END IF;
    v_replayed := true;
  ELSE
    IF EXISTS (SELECT 1 FROM private.quote_conversion_requests WHERE tenant_id = p_tenant_id AND quote_id = p_quote_id AND expected_version = p_expected_version) THEN
      RETURN QUERY SELECT 'CONFLICT', NULL::jsonb, false; RETURN;
    END IF;
    SELECT * INTO v_quote FROM private.quotes WHERE tenant_id = p_tenant_id AND id = p_quote_id FOR UPDATE;
    IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND', NULL::jsonb, false; RETURN; END IF;
    IF v_quote.status <> 'draft' OR v_quote.version <> p_expected_version THEN
      RETURN QUERY SELECT 'CONFLICT', NULL::jsonb, false; RETURN;
    END IF;
    INSERT INTO private.quote_conversion_requests (
      tenant_id, quote_id, actor_id, client_event_id, intent_sha256, order_intent_sha256, expected_version,
      event_id, award_client_event_id, receipt_id, correlation_id
    ) VALUES (
      p_tenant_id, p_quote_id, p_actor_id, p_client_event_id, p_intent_sha256, p_order_intent_sha256, p_expected_version,
      gen_random_uuid()::text, gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
    ) RETURNING * INTO v_request;
  END IF;

  SELECT * INTO v_quote FROM private.quotes WHERE tenant_id = p_tenant_id AND id = p_quote_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND', NULL::jsonb, false; RETURN; END IF;
  IF NOT (
    (v_quote.status = 'draft' AND v_quote.version = v_request.expected_version AND v_quote.linked_order_id IS NULL)
    OR
    (v_replayed AND v_quote.status = 'converted' AND v_quote.version = v_request.expected_version + 1
      AND v_quote.linked_order_id IS NOT NULL)
  ) THEN RETURN QUERY SELECT 'CONFLICT', NULL::jsonb, false; RETURN; END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'name', position.name, 'quantity', position.quantity, 'material', position.material,
    'surfaceRequested', position.surface_requested
  ) ORDER BY position.position) INTO v_items
  FROM private.quote_positions position
  WHERE position.tenant_id = p_tenant_id AND position.quote_id = p_quote_id AND position.revision = v_request.expected_version;
  IF jsonb_array_length(coalesce(v_items, '[]'::jsonb)) NOT BETWEEN 1 AND 20 THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::jsonb, false; RETURN;
  END IF;
  RETURN QUERY SELECT 'OK', jsonb_build_object(
    'clientEventId', p_client_event_id::text,
    'customer', jsonb_build_object('mode', 'EXISTING', 'customerId', v_quote.customer_id),
    'dueDate', to_char(v_quote.due_date, 'YYYY-MM-DD'), 'note', v_quote.note, 'items', v_items
  ), v_replayed;
END;
$$;

COMMENT ON FUNCTION private.prepare_quote_conversion_v1(text, uuid, uuid, uuid, text, text, integer)
  IS 'Prepares or idempotently resumes one immutable quote-to-order conversion.';

CREATE OR REPLACE VIEW private.v_quote_conversion_receipts_v1 WITH (security_invoker = true) AS
SELECT receipt.id AS receipt_id, receipt.event_id, receipt.tenant_id, receipt.quote_id,
  receipt.customer_id, receipt.order_id, receipt.order_intake_event_id, receipt.actor_id,
  receipt.client_event_id, receipt.award_client_event_id, receipt.correlation_id, receipt.intent_sha256,
  receipt.quote_version, receipt.created_at AS recorded_at,
  (event.id IS NOT NULL AND quote.id IS NOT NULL AND intake_event.id IS NOT NULL AND order_row.id IS NOT NULL
    AND quote.customer_id = receipt.customer_id
    AND ((quote.status='converted' AND quote.version=receipt.quote_version AND quote.linked_order_id=receipt.order_id)
      OR (order_row.status='storniert' AND order_row.ware='storniert' AND EXISTS(
        SELECT 1 FROM public.events reversed WHERE reversed.tenant_id=receipt.tenant_id
          AND reversed.event_type='QUOTE_CONVERSION_REVERSED_V04' AND reversed.status='success'
          AND reversed.user_id IS NOT NULL AND reversed.event_schema_version=1
          AND reversed.payload->>'quoteId'=receipt.quote_id::text
          AND reversed.payload->>'orderId'=receipt.order_id
          AND reversed.payload->>'convertedVersion'=receipt.quote_version::text)))
    AND order_row.customer_id = receipt.customer_id
    AND intake_event.order_id = receipt.order_id AND intake_event.user_id = receipt.actor_id
    AND intake_event.client_event_id = receipt.client_event_id
    AND intake_event.event_type = 'ORDER_INTAKE_CREATED_V1'
    AND intake_event.status = 'success' AND intake_event.station = 'wareneingang'
    AND intake_event.event_schema_version = 1 AND intake_event.aggregate_version = 1
    AND intake_event.payload = jsonb_build_object(
      'intentSha256', receipt.order_intent_sha256,
      'handoverMode', order_row.handover_mode,
      'paymentMode', order_row.payment_mode
    )
    AND event.event_type = 'QUOTE_AWARDED_V1' AND event.user_id = receipt.actor_id
    AND event.client_event_id = receipt.award_client_event_id AND event.correlation_id = receipt.correlation_id
    AND event.aggregate_version = receipt.quote_version
    AND event.payload = jsonb_build_object('quoteId', receipt.quote_id::text,
      'orderId', receipt.order_id, 'intentSha256', receipt.intent_sha256)) AS integrity_ok
FROM private.quote_conversion_receipts receipt
LEFT JOIN public.events event ON event.tenant_id = receipt.tenant_id AND event.id = receipt.event_id
LEFT JOIN private.quotes quote ON quote.tenant_id = receipt.tenant_id AND quote.id = receipt.quote_id
LEFT JOIN public.orders order_row ON order_row.tenant_id = receipt.tenant_id AND order_row.id = receipt.order_id
LEFT JOIN public.events intake_event ON intake_event.tenant_id = receipt.tenant_id AND intake_event.id = receipt.order_intake_event_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_quote_conversion_receipts_v1
  IS 'Atomic quote-to-order receipt readback for the complete order-intake event contract.';

REVOKE ALL ON TABLE private.v_quote_conversion_receipts_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_quote_conversion_receipts_v1 TO service_role;

CREATE OR REPLACE FUNCTION private.protect_goods_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF OLD.status<>'entwurf' AND NEW.status='entwurf' THEN RAISE EXCEPTION 'GOODS_RECEIPT_STATE_REGRESSION' USING ERRCODE='23514'; END IF;
 IF ROW(NEW.id,NEW.tenant_id,NEW.client_key,NEW.modus,NEW.kv_id,NEW.kv_fassung,NEW.lagerort)
   IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.client_key,OLD.modus,OLD.kv_id,OLD.kv_fassung,OLD.lagerort)
   OR (OLD.item_id IS NOT NULL AND NEW.item_id IS DISTINCT FROM OLD.item_id)
 THEN RAISE EXCEPTION 'GOODS_RECEIPT_IDENTITY_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NEW.auftrag_id IS DISTINCT FROM OLD.auftrag_id AND NOT (
   OLD.auftrag_id IS NULL AND OLD.kv_id IS NOT NULL AND NEW.auftrag_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM private.quotes q WHERE q.tenant_id=NEW.tenant_id AND q.id=NEW.kv_id AND q.linked_order_id=NEW.auftrag_id)
   OR OLD.auftrag_id IS NOT NULL AND NEW.auftrag_id IS NULL AND OLD.kv_id IS NOT NULL
     AND EXISTS(SELECT 1 FROM public.events reversed JOIN public.orders cancelled ON cancelled.tenant_id=reversed.tenant_id AND cancelled.id=OLD.auftrag_id
       WHERE reversed.tenant_id=OLD.tenant_id AND reversed.event_type='QUOTE_CONVERSION_REVERSED_V04'
         AND reversed.status='success' AND reversed.user_id IS NOT NULL
         AND reversed.payload->>'quoteId'=OLD.kv_id::text AND reversed.payload->>'orderId'=OLD.auftrag_id
         AND reversed.payload->'receiptIds' ? OLD.id::text AND cancelled.status='storniert' AND cancelled.ware='storniert')
 ) THEN RAISE EXCEPTION 'GOODS_RECEIPT_ORDER_BINDING_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $fn$;



-- A read-only reason is repeated under row locks by the compensating command.
CREATE FUNCTION private.quote_conversion_undo_reason_v1(p_tenant text,p_quote uuid) RETURNS text
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
 IF EXISTS(SELECT 1 FROM public.events WHERE tenant_id=p_tenant AND order_id=o.id AND status='success' AND event_type NOT IN ('ORDER_INTAKE_CREATED_V1','GOODS_RECEIPT_SAVED_V1')) THEN RETURN 'Eine Folgehandlung wurde protokolliert'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.v_quote_conversion_receipts_v1 WHERE tenant_id=p_tenant AND quote_id=q.id AND order_id=o.id AND integrity_ok) THEN RETURN 'Umwandlungsbeleg ist nicht vollständig'; END IF;
 IF EXISTS(SELECT 1 FROM public.intake_event binding JOIN public.intake_item original ON original.tenant_id=binding.tenant_id AND original.id=binding.item_id
   WHERE binding.tenant_id=p_tenant AND binding.vorher->>'vorgang_art'='kv' AND binding.vorher->>'vorgang_id'=p_quote::text
     AND binding.nachher->>'vorgangId'=o.id AND (original.vorgang_art IS DISTINCT FROM 'auftrag' OR original.vorgang_id IS DISTINCT FROM o.id OR original.version<>(binding.vorher->>'version')::integer+1)) THEN RETURN 'Ein Original wurde nach der Zuordnung geändert'; END IF;
 RETURN NULL;
END; $fn$;

CREATE FUNCTION private.reverse_quote_conversion_v1(p_tenant text,p_actor uuid,p_quote uuid,p_expected integer,p_client uuid,p_hash text,p_reason text)
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
 INSERT INTO private.quote_positions(tenant_id,quote_id,revision,position,name,quantity,material,surface_requested,unit_price_cents,zeilen_gesamt_cents,unit,aufwand_min)
 SELECT tenant_id,quote_id,q.version+1,position,name,quantity,material,surface_requested,unit_price_cents,zeilen_gesamt_cents,unit,aufwand_min FROM private.quote_positions WHERE tenant_id=p_tenant AND quote_id=q.id AND revision=q.version;
 UPDATE private.quotes SET status='draft',version=q.version+1,linked_order_id=NULL,converted_at=NULL,updated_by=p_actor,updated_at=statement_timestamp() WHERE tenant_id=p_tenant AND id=q.id AND version=q.version;
 RETURN QUERY SELECT 'OK',o.id,false,NULL::text;
END; $fn$;
REVOKE ALL ON FUNCTION private.quote_conversion_undo_reason_v1(text,uuid),private.reverse_quote_conversion_v1(text,uuid,uuid,integer,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.quote_conversion_undo_reason_v1(text,uuid),private.reverse_quote_conversion_v1(text,uuid,uuid,integer,uuid,text,text) TO service_role;
