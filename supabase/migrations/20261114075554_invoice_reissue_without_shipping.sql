-- S09 A09-7 / PL14Nov08:45. Same immutable cancellation and invoice events.
-- No new ledger, invoice kind, actor override, number source or document store.
DO $$
DECLARE name text; original text; extended text;
BEGIN
 FOREACH name IN ARRAY ARRAY['events_invoice_created_v1_contract_chk','events_invoice_created_v2_contract_chk','events_invoice_cancelled_v1_contract_chk'] LOOP
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT original FROM pg_constraint
   WHERE conrelid='public.events'::regclass AND conname=name;
  IF name='events_invoice_cancelled_v1_contract_chk' THEN
   extended:=replace(original,'(payload = jsonb_build_object(','((payload - ''reissue'') = jsonb_build_object(');
  ELSE
   extended:=replace(original,'payload - ''shippingCosts''::text','payload - ''shippingCosts''::text - ''reissue''::text');
  END IF;
  IF extended=original THEN RAISE EXCEPTION 'REISSUE_EVENT_SHAPE_SOURCE_CHANGED'; END IF;
  EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I',name);
  EXECUTE format('ALTER TABLE public.events ADD CONSTRAINT %I CHECK (%s) NOT VALID',name,extended);
 END LOOP;
END $$;

CREATE UNIQUE INDEX events_s09_one_replacement_per_cancellation ON public.events
 (tenant_id,(payload#>>'{reissue,cancellationEventId}'))
 WHERE event_type IN ('INVOICE_CREATED_V1','INVOICE_CREATED_V2') AND payload ? 'reissue';
CREATE UNIQUE INDEX events_s09_reserved_replacement_key ON public.events
 (tenant_id,(payload#>>'{reissue,replacementClientEventId}'))
 WHERE event_type='INVOICE_CANCELLED_V1' AND payload ? 'reissue';

CREATE FUNCTION private.guard_invoice_reissue_event_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE intent jsonb:=NEW.payload->'reissue'; original public.invoices%ROWTYPE;
        cancellation public.events%ROWTYPE; manual record;
        uuid_pattern constant text:='^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
BEGIN
 IF jsonb_typeof(intent) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'REISSUE_INTENT_SHAPE_INVALID' USING ERRCODE='23514'; END IF;
 IF NEW.event_type='INVOICE_CANCELLED_V1' THEN
  IF intent IS DISTINCT FROM jsonb_build_object('handoverEventId',intent->'handoverEventId','replacementClientEventId',intent->'replacementClientEventId','originalPdfSha256',intent->'originalPdfSha256','orderVersion',intent->'orderVersion','confirmedBy',intent->'confirmedBy')
   OR COALESCE(intent->>'handoverEventId','') !~ uuid_pattern OR COALESCE(intent->>'replacementClientEventId','') !~ uuid_pattern
   OR COALESCE(intent->>'originalPdfSha256','') !~ '^[a-f0-9]{64}$'
   OR jsonb_typeof(intent->'orderVersion') IS DISTINCT FROM 'number'
   OR COALESCE(intent->>'orderVersion','') !~ '^[1-9][0-9]*$'
   OR intent->>'confirmedBy' IS DISTINCT FROM NEW.user_id::text
   OR intent->>'replacementClientEventId'=NEW.client_event_id::text THEN
   RAISE EXCEPTION 'REISSUE_CANCELLATION_INTENT_INVALID' USING ERRCODE='23514';
  END IF;
  SELECT * INTO original FROM public.invoices invoice WHERE invoice.tenant_id=NEW.tenant_id
   AND invoice.id::text=NEW.payload->>'invoiceId' AND invoice.order_id=NEW.order_id
   AND invoice.contract_version=1 AND invoice.belegart='auftrag' AND invoice.status='issued';
  IF original.id IS NULL OR original.pdf_sha256 IS DISTINCT FROM intent->>'originalPdfSha256'
   OR original.snapshot->>'schemaVersion' IS DISTINCT FROM '2'
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(original.snapshot->'lines') line WHERE line->>'type'='SHIPPING')
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(original.snapshot->'lines') line WHERE line->>'type'<>'SHIPPING') THEN
   RAISE EXCEPTION 'REISSUE_ORIGINAL_SOURCE_INVALID' USING ERRCODE='23514';
  END IF;
  SELECT * INTO manual FROM private.v_order_handover_manual_source_v1 source
   WHERE source.tenant_id=NEW.tenant_id AND source.order_id=NEW.order_id
    AND source.event_id=intent->>'handoverEventId' AND source.integrity_ok;
  IF NOT FOUND OR manual.order_version::text IS DISTINCT FROM intent->>'orderVersion'
   OR manual.current_order_version IS DISTINCT FROM manual.order_version
   OR manual.current_handover_mode IS DISTINCT FROM 'pickup'
   OR manual.payload#>>'{receipt,outcome}' IS DISTINCT FROM 'changed'
   OR manual.payload#>>'{receipt,handoverMode}' IS DISTINCT FROM 'pickup' THEN
   RAISE EXCEPTION 'REISSUE_PICKUP_SOURCE_INVALID' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM public.events prior WHERE prior.tenant_id=NEW.tenant_id AND prior.client_event_id::text=intent->>'replacementClientEventId') THEN
   RAISE EXCEPTION 'REISSUE_REPLACEMENT_KEY_USED' USING ERRCODE='23514';
  END IF;
 ELSE
  IF intent IS DISTINCT FROM jsonb_build_object('cancellationEventId',intent->'cancellationEventId','confirmedBy',intent->'confirmedBy','repairActorId',intent->'repairActorId')
   OR COALESCE(intent->>'cancellationEventId','') !~ uuid_pattern
   OR intent->>'repairActorId' IS DISTINCT FROM NEW.user_id::text THEN
   RAISE EXCEPTION 'REISSUE_REPLACEMENT_INTENT_INVALID' USING ERRCODE='23514';
  END IF;
  SELECT event.* INTO cancellation FROM public.events event JOIN private.v_invoice_receipt_v1 receipt
   ON receipt.tenant_id=event.tenant_id AND receipt.event_id=event.id AND receipt.integrity_ok
   WHERE event.tenant_id=NEW.tenant_id AND event.id=intent->>'cancellationEventId'
    AND event.order_id=NEW.order_id AND event.event_type='INVOICE_CANCELLED_V1' AND event.payload ? 'reissue';
  IF cancellation.id IS NULL OR cancellation.user_id::text IS DISTINCT FROM intent->>'confirmedBy'
   OR cancellation.payload#>>'{reissue,replacementClientEventId}' IS DISTINCT FROM NEW.client_event_id::text THEN
   RAISE EXCEPTION 'REISSUE_CANCELLATION_SOURCE_INVALID' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_invoice_reissue_event_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.guard_invoice_reissue_event_v1() TO service_role;
CREATE TRIGGER events_s09_reissue_intent_guard BEFORE INSERT ON public.events
 FOR EACH ROW WHEN (NEW.event_type IN ('INVOICE_CREATED_V1','INVOICE_CREATED_V2','INVOICE_CANCELLED_V1') AND NEW.payload ? 'reissue')
 EXECUTE FUNCTION private.guard_invoice_reissue_event_v1();

CREATE FUNCTION private.guard_invoice_reissue_original_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE issue public.events%ROWTYPE; cancellation public.events%ROWTYPE;
        original public.invoices%ROWTYPE; goods jsonb; current_order public.orders%ROWTYPE;
BEGIN
 SELECT * INTO issue FROM public.events event WHERE event.tenant_id=NEW.tenant_id AND event.id=NEW.issue_event_id;
 IF NOT (issue.payload ? 'reissue') THEN
  IF EXISTS(SELECT 1 FROM public.events event WHERE event.tenant_id=NEW.tenant_id AND event.event_type='INVOICE_CANCELLED_V1'
   AND event.payload#>>'{reissue,replacementClientEventId}'=NEW.client_event_id::text) THEN
   RAISE EXCEPTION 'REISSUE_QUALIFIED_COMMAND_REQUIRED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO cancellation FROM public.events event WHERE event.tenant_id=NEW.tenant_id AND event.id=issue.payload#>>'{reissue,cancellationEventId}' AND event.event_type='INVOICE_CANCELLED_V1';
 SELECT * INTO original FROM public.invoices invoice WHERE invoice.tenant_id=NEW.tenant_id AND invoice.id::text=cancellation.payload->>'invoiceId' AND invoice.cancel_event_id=cancellation.id AND invoice.status='cancelled';
 SELECT * INTO current_order FROM public.orders orders WHERE orders.tenant_id=NEW.tenant_id AND orders.id=NEW.order_id;
 SELECT jsonb_agg(line ORDER BY ordinal) INTO goods FROM jsonb_array_elements(original.snapshot->'lines') WITH ORDINALITY source(line,ordinal) WHERE line->>'type'<>'SHIPPING';
 IF original.id IS NULL OR issue.user_id IS DISTINCT FROM NEW.issued_by OR issue.client_event_id IS DISTINCT FROM NEW.client_event_id
  OR NEW.belegart IS DISTINCT FROM 'auftrag' OR NEW.ursprung_rechnung_id IS NOT NULL
  OR NEW.order_id IS DISTINCT FROM original.order_id OR NEW.customer_id IS DISTINCT FROM original.customer_id
  OR NEW.freeze_id IS DISTINCT FROM original.freeze_id OR NEW.order_version::text IS DISTINCT FROM cancellation.payload#>>'{reissue,orderVersion}'
  OR current_order.version IS DISTINCT FROM NEW.order_version OR current_order.handover_mode IS DISTINCT FROM 'pickup'
  OR original.pdf_sha256 IS DISTINCT FROM cancellation.payload#>>'{reissue,originalPdfSha256}'
  OR NEW.snapshot->'schemaVersion' IS DISTINCT FROM original.snapshot->'schemaVersion'
  OR NEW.snapshot->'seller' IS DISTINCT FROM original.snapshot->'seller'
  OR NEW.snapshot->'customer' IS DISTINCT FROM original.snapshot->'customer'
  OR (NEW.snapshot->'order'-'orderVersion') IS DISTINCT FROM (original.snapshot->'order'-'orderVersion')
  OR NEW.snapshot->'lines' IS DISTINCT FROM goods OR goods IS NULL
  OR NEW.service_date IS DISTINCT FROM original.service_date OR NEW.payment_term_days IS DISTINCT FROM original.payment_term_days
  OR NEW.due_date IS DISTINCT FROM ((NEW.issued_at AT TIME ZONE 'Europe/Berlin')::date+NEW.payment_term_days)
  OR NEW.payment_status IS DISTINCT FROM 'offen' OR NEW.payment_paid_amount_cents IS DISTINCT FROM 0
  OR NEW.payment_open_amount_cents IS DISTINCT FROM NEW.gross_amount_cents THEN
  RAISE EXCEPTION 'REISSUE_ORIGINAL_VALUES_CHANGED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_invoice_reissue_original_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.guard_invoice_reissue_original_v1() TO service_role;
CREATE TRIGGER invoices_s09_reissue_original_guard BEFORE INSERT ON public.invoices
 FOR EACH ROW WHEN (NEW.contract_version=1) EXECUTE FUNCTION private.guard_invoice_reissue_original_v1();
