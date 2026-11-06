-- AP-EIN Teil 5: one incoming invoice for the canonical intake and original.
-- Original bytes remain in intake_file; invoices never copy their storage objects.
CREATE UNIQUE INDEX intake_file_invoice_reference_uidx
  ON public.intake_file (tenant_id, item_id, id);

CREATE TABLE public.supplier_invoice (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  nummer_intern text NOT NULL,
  item_id uuid NOT NULL UNIQUE,
  file_id uuid NOT NULL,
  lieferant_id text,
  nummer text,
  datum date,
  netto numeric(14,2),
  ust numeric(14,2),
  brutto numeric(14,2),
  faellig_am date,
  iban text,
  iban_geprueft boolean NOT NULL DEFAULT false,
  zahlstatus text NOT NULL,
  bezahlt_am date,
  nachweis_file_id uuid,
  verweis_id uuid,
  dublette_grund text,
  unklar_grund text,
  aufgabe_id uuid,
  ungueltig_grund text,
  erfasst_von uuid NOT NULL,
  erfasst_am timestamptz NOT NULL DEFAULT statement_timestamp(),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, nummer_intern),
  FOREIGN KEY (tenant_id, item_id) REFERENCES public.intake_item (tenant_id, id),
  FOREIGN KEY (tenant_id, item_id, file_id)
    REFERENCES public.intake_file (tenant_id, item_id, id),
  FOREIGN KEY (tenant_id, item_id, nachweis_file_id)
    REFERENCES public.intake_file (tenant_id, item_id, id),
  FOREIGN KEY (tenant_id, lieferant_id) REFERENCES public.customers (tenant_id, id),
  FOREIGN KEY (tenant_id, aufgabe_id) REFERENCES public.tasks (tenant_id, id),
  FOREIGN KEY (tenant_id, verweis_id) REFERENCES public.supplier_invoice (tenant_id, id),
  FOREIGN KEY (tenant_id, erfasst_von) REFERENCES public.app_users (tenant_id, id),
  CONSTRAINT supplier_invoice_status_chk
    CHECK (zahlstatus IN ('offen', 'bezahlt', 'unklar', 'doppelt', 'ungueltig')),
  CONSTRAINT supplier_invoice_paid_date_chk
    CHECK (zahlstatus <> 'bezahlt' OR bezahlt_am IS NOT NULL),
  CONSTRAINT supplier_invoice_duplicate_reference_chk
    CHECK (zahlstatus <> 'doppelt' OR verweis_id IS NOT NULL AND verweis_id <> id),
  CONSTRAINT supplier_invoice_unclear_reason_chk
    CHECK (zahlstatus <> 'unklar' OR unklar_grund IS NOT NULL AND char_length(btrim(unklar_grund)) BETWEEN 3 AND 200),
  CONSTRAINT supplier_invoice_invalid_reason_chk
    CHECK (zahlstatus <> 'ungueltig' OR ungueltig_grund IS NOT NULL AND char_length(btrim(ungueltig_grund)) BETWEEN 3 AND 200),
  CONSTRAINT supplier_invoice_duplicate_reason_chk
    CHECK (dublette_grund IS NULL OR char_length(btrim(dublette_grund)) BETWEEN 3 AND 200),
  CONSTRAINT supplier_invoice_fields_chk CHECK (
    zahlstatus IN ('unklar', 'ungueltig') OR (
      lieferant_id IS NOT NULL AND nummer IS NOT NULL AND btrim(nummer) <> ''
      AND datum IS NOT NULL AND netto IS NOT NULL AND ust IS NOT NULL
      AND brutto IS NOT NULL AND faellig_am IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX supplier_invoice_document_identity_uidx
  ON public.supplier_invoice (lieferant_id, nummer, datum, brutto)
  WHERE zahlstatus <> 'doppelt';
CREATE INDEX supplier_invoice_due_idx
  ON public.supplier_invoice (tenant_id, faellig_am, id) WHERE zahlstatus = 'offen';

ALTER TABLE public.supplier_invoice ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_invoice_tenant_isolation ON public.supplier_invoice
  FOR ALL TO service_role
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));
-- Supabase's default grants include destructive operations: revoke them explicitly.
REVOKE ALL ON public.supplier_invoice FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.supplier_invoice TO service_role;

-- Extend the existing task reader; retain all existing context kinds and columns.
CREATE OR REPLACE VIEW private.v_task_contexts_v1 WITH (security_invoker = true) AS
  SELECT customer.tenant_id::text AS tenant_id, 'kunde'::text AS kind,
    customer.id, customer.name AS label, customer.id AS customer_id,
    customer.type AS customer_type, NULL::text AS order_id, NULL::text AS channel,
    customer.phone, NULL::integer AS source_version
  FROM public.customers customer
  WHERE customer.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  UNION ALL
  SELECT orders.tenant_id, 'auftrag', orders.id, orders.order_number,
    orders.customer_id, customer.type, orders.id, NULL, customer.phone, NULL
  FROM public.orders orders
  JOIN public.customers customer ON customer.tenant_id = orders.tenant_id
    AND customer.id = orders.customer_id
  WHERE orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  UNION ALL
  SELECT quote.tenant_id, 'kv', quote.id::text, quote.quote_number,
    quote.customer_id, customer.type, NULL, NULL, customer.phone, NULL
  FROM private.quotes quote
  JOIN public.customers customer ON customer.tenant_id = quote.tenant_id
    AND customer.id = quote.customer_id
  WHERE quote.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  UNION ALL
  SELECT source.tenant_id, 'eingang', source.id::text,
    CASE WHEN source.kanal = 'notiz' THEN left(source.text, 120) ELSE source.betreff END,
    source.kunde_id, customer.type,
    CASE WHEN source.vorgang_art = 'auftrag' THEN source.vorgang_id END,
    source.kanal, customer.phone, source.version
  FROM public.intake_item source
  LEFT JOIN public.customers customer ON customer.tenant_id = source.tenant_id
    AND customer.id = source.kunde_id
  WHERE source.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  UNION ALL
  SELECT invoice.tenant_id, 'eingangsrechnung', invoice.id::text,
    invoice.nummer_intern, invoice.lieferant_id, customer.type, NULL,
    source.kanal, customer.phone, invoice.version
  FROM public.supplier_invoice invoice
  JOIN public.intake_item source ON source.tenant_id = invoice.tenant_id
    AND source.id = invoice.item_id
  LEFT JOIN public.customers customer ON customer.tenant_id = invoice.tenant_id
    AND customer.id = invoice.lieferant_id
  WHERE invoice.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

REVOKE ALL ON private.v_task_contexts_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.v_task_contexts_v1 TO service_role;

-- 3.8 supplier mode is authorized by Geld; retain the single customer writer,
-- its validation, number allocation, receipts, events, tenant and actor checks.
CREATE OR REPLACE FUNCTION private.create_customer_v2(
  p_tenant_id text, p_actor_id uuid, p_client_event_id uuid, p_intent_sha256 text, p_fields jsonb
) RETURNS TABLE(result_code text, result_receipt_id uuid, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_prior private.customer_create_receipts%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_customer_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_receipt_id uuid := gen_random_uuid();
  v_correlation_id uuid := gen_random_uuid();
  v_customer_number text;
  v_name text;
  v_money boolean;
BEGIN
  IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
    OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_intent_sha256 IS NULL OR p_intent_sha256 !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object'
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_fields) key WHERE key <> ALL(ARRAY[
      'type','company_name','salutation','first_name','last_name','contact_role','phone','email','billing_email','website',
      'street','house_number','zip_code','city','country','payment_preference','vat_id','notes','handover_preference',
      'iban','zahlungsziel_tage','auto_info','vorrang','address_status']))
    OR NOT EXISTS (SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=p_tenant_id AND actor.id=p_actor_id AND actor.active)
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='eingang')
    AND NOT (p_fields->>'type'='lieferant' AND EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='geld'))
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text, NULL::uuid, false; RETURN; END IF;
  v_money := EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='geld');
  v_customer := jsonb_populate_record(NULL::public.customers, p_fields);
  IF NOT v_money AND (v_customer.type='lieferant' OR (v_customer.payment_preference IS NOT NULL AND v_customer.payment_preference <> 'vorkasse') OR v_customer.iban IS NOT NULL OR v_customer.zahlungsziel_tage IS NOT NULL)
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text, NULL::uuid, false; RETURN; END IF;
  IF coalesce(v_customer.vorrang,false) AND NOT EXISTS
    (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='entscheiden')
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text, NULL::uuid, false; RETURN; END IF;
  v_name := CASE WHEN v_customer.type='privat' THEN concat_ws(' ',nullif(v_customer.first_name,''),nullif(v_customer.last_name,'')) ELSE v_customer.company_name END;
  IF v_customer.type IS NULL OR v_customer.type NOT IN ('business','privat','lieferant') OR v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 160
    OR (v_customer.type <> 'lieferant' AND v_customer.phone IS NULL)
    OR v_customer.payment_preference='rechnung'
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('path1:customer-create:'||p_tenant_id||':'||p_actor_id||':'||p_client_event_id,0));
  SELECT * INTO v_prior FROM private.customer_create_receipts
    WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND client_event_id=p_client_event_id;
  IF FOUND THEN
    IF v_prior.intent_sha256 IS DISTINCT FROM p_intent_sha256 THEN RETURN QUERY SELECT 'CONFLICT'::text,NULL::uuid,false;
    ELSE RETURN QUERY SELECT 'OK'::text,v_prior.id,true; END IF;
    RETURN;
  END IF;
  v_customer_number := private.allocate_customer_number(p_tenant_id);
  INSERT INTO public.customers (
    id,tenant_id,customer_number,name,type,company_name,salutation,first_name,last_name,contact_role,phone,email,billing_email,
    website,street,house_number,zip_code,city,country,payment_preference,vat_id,notes,handover_preference,iban,zahlungsziel_tage,
    auto_info,vorrang,address_status,address_checked_at,source,source_ref,created_at,updated_at
  ) VALUES (
    v_customer_id::text,p_tenant_id,v_customer_number,v_name,v_customer.type,v_customer.company_name,v_customer.salutation,
    v_customer.first_name,v_customer.last_name,v_customer.contact_role,v_customer.phone,v_customer.email,v_customer.billing_email,
    v_customer.website,v_customer.street,v_customer.house_number,v_customer.zip_code,v_customer.city,v_customer.country,
    v_customer.payment_preference,v_customer.vat_id,v_customer.notes,v_customer.handover_preference,v_customer.iban,v_customer.zahlungsziel_tage,
    coalesce(v_customer.auto_info,true),false,v_customer.address_status,CASE WHEN v_customer.address_status IS NULL THEN NULL ELSE statement_timestamp() END,'PATH1_CUSTOMER_COMMAND',p_client_event_id::text,
    statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp()
  );
  INSERT INTO public.events (id,tenant_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,created_at)
  VALUES (v_event_id::text,p_tenant_id,'CUSTOMER_CREATED_V1','Kunde angelegt',
    jsonb_build_object('customerId',v_customer_id::text,'customerNumber',v_customer_number,'intentSha256',p_intent_sha256),
    'success',p_actor_id,p_client_event_id,1,v_correlation_id,1,statement_timestamp() AT TIME ZONE 'UTC');
  INSERT INTO private.customer_create_receipts (
    id,event_id,tenant_id,customer_id,customer_number,actor_id,client_event_id,correlation_id,intent_sha256,name,customer_type,
    company_name,contact_person,email,phone,street,zip_code,city,country,payment_preference,vat_id,notes,created_at,customer_fields
  ) VALUES (
    v_receipt_id,v_event_id::text,p_tenant_id,v_customer_id::text,v_customer_number,p_actor_id,p_client_event_id,v_correlation_id,p_intent_sha256,
    v_name,v_customer.type,v_customer.company_name,NULL,v_customer.email,v_customer.phone,v_customer.street,v_customer.zip_code,v_customer.city,
    v_customer.country,v_customer.payment_preference,v_customer.vat_id,v_customer.notes,statement_timestamp(),p_fields
  );
  RETURN QUERY SELECT 'OK'::text,v_receipt_id,false;
END $$;

-- 3.8 writes a previously empty supplier IBAN through the same customer update
-- command. Geld alone cannot edit a regular customer or turn one into a supplier.
CREATE OR REPLACE FUNCTION private.update_customer_v1(
  p_tenant_id text,p_actor_id uuid,p_client_event_id uuid,p_customer_id text,p_intent_sha256 text,p_fields jsonb
) RETURNS TABLE(result_code text,replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_prior public.events%ROWTYPE;
  v_before public.customers%ROWTYPE;
  v_after public.customers%ROWTYPE;
  v_money boolean;
  v_name text;
  v_version integer;
BEGIN
  IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id',true)),'')
    OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_customer_id IS NULL OR p_intent_sha256 IS NULL OR p_intent_sha256 !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object'
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_fields) key WHERE key <> ALL(ARRAY[
      'type','company_name','salutation','first_name','last_name','contact_role','phone','email','billing_email','website',
      'street','house_number','zip_code','city','country','payment_preference','vat_id','notes','handover_preference',
      'iban','zahlungsziel_tage','auto_info','vorrang','address_status']))
    OR NOT EXISTS (SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=p_tenant_id AND actor.id=p_actor_id AND actor.active)
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='kunden')
    AND NOT (p_fields->>'type'='lieferant'
      AND EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='geld')
      AND EXISTS (SELECT 1 FROM public.customers WHERE tenant_id=p_tenant_id AND id=p_customer_id AND type='lieferant'))
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
  v_money := EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='geld');
  PERFORM pg_advisory_xact_lock(hashtextextended('s1:customer-update:'||p_tenant_id||':'||p_actor_id||':'||p_client_event_id,0));
  SELECT * INTO v_prior FROM public.events WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND client_event_id=p_client_event_id AND event_type='CUSTOMER_UPDATED_V1';
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_prior.payload->>'intentSha256'=p_intent_sha256 AND v_prior.payload->>'customerId'=p_customer_id THEN 'OK' ELSE 'CONFLICT' END,true; RETURN;
  END IF;
  SELECT * INTO v_before FROM public.customers WHERE tenant_id=p_tenant_id AND id=p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text,false; RETURN; END IF;
  v_after := jsonb_populate_record(v_before,p_fields);
  IF NOT v_money AND (v_before.type='lieferant' OR v_after.type='lieferant'
    OR v_before.payment_preference IS DISTINCT FROM v_after.payment_preference
    OR v_before.iban IS DISTINCT FROM v_after.iban OR v_before.zahlungsziel_tage IS DISTINCT FROM v_after.zahlungsziel_tage)
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
  IF v_before.vorrang IS DISTINCT FROM v_after.vorrang AND NOT EXISTS
    (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='entscheiden')
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
  IF v_after.payment_preference='rechnung' AND NOT v_before.ziel_freigeschaltet
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
  v_name := CASE WHEN v_after.type='privat' THEN concat_ws(' ',nullif(v_after.first_name,''),nullif(v_after.last_name,'')) ELSE v_after.company_name END;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 160 THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
  UPDATE public.customers SET
    name=v_name,type=v_after.type,company_name=v_after.company_name,salutation=v_after.salutation,first_name=v_after.first_name,
    last_name=v_after.last_name,contact_role=v_after.contact_role,phone=v_after.phone,email=v_after.email,billing_email=v_after.billing_email,
    website=v_after.website,street=v_after.street,house_number=v_after.house_number,zip_code=v_after.zip_code,city=v_after.city,country=v_after.country,
    payment_preference=v_after.payment_preference,vat_id=v_after.vat_id,notes=v_after.notes,handover_preference=v_after.handover_preference,
    iban=v_after.iban,zahlungsziel_tage=v_after.zahlungsziel_tage,auto_info=v_after.auto_info,vorrang=v_after.vorrang,address_status=v_after.address_status,
    address_checked_at=CASE WHEN (v_before.country,v_before.zip_code,v_before.city,v_before.street,v_before.house_number)
      IS DISTINCT FROM (v_after.country,v_after.zip_code,v_after.city,v_after.street,v_after.house_number)
      THEN CASE WHEN v_after.address_status IS NULL THEN NULL ELSE statement_timestamp() END ELSE v_before.address_checked_at END,
    customer_number=coalesce(v_before.customer_number,private.allocate_customer_number(p_tenant_id)),updated_at=statement_timestamp()
  WHERE tenant_id=p_tenant_id AND id=p_customer_id;
  SELECT coalesce(max(event.aggregate_version),0)+1 INTO v_version FROM public.events event
    WHERE event.tenant_id=p_tenant_id AND event.event_type='CUSTOMER_UPDATED_V1' AND event.payload->>'customerId'=p_customer_id;
  INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,created_at)
  VALUES(gen_random_uuid()::text,p_tenant_id,'CUSTOMER_UPDATED_V1','Kunde gespeichert',
    jsonb_build_object('customerId',p_customer_id,'intentSha256',p_intent_sha256,'fields',p_fields),'success',p_actor_id,p_client_event_id,1,gen_random_uuid(),v_version,statement_timestamp() AT TIME ZONE 'UTC');
  RETURN QUERY SELECT 'OK'::text,false;
END $$;
