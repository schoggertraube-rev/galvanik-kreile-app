-- Decisions 13 and 14, P33: independent decision area; legacy incomplete invoice terms.
ALTER TABLE public.app_user_rights DROP CONSTRAINT app_user_rights_bereich_chk,
 ADD CONSTRAINT app_user_rights_bereich_chk CHECK (
  bereich IN ('auftraege','eingang','kunden','geld','kassieren','mails','entscheiden','einstellungen','logins','wartung'));
INSERT INTO public.app_user_rights(tenant_id,user_id,bereich)
 SELECT tenant_id,id,'entscheiden' FROM public.app_users WHERE active AND role='meister'
 ON CONFLICT(tenant_id,user_id,bereich) DO NOTHING;
ALTER TABLE public.customers DROP CONSTRAINT customers_invoice_terms_k1_chk,
 ADD CONSTRAINT customers_invoice_terms_k1_chk CHECK (
  (NOT ziel_freigeschaltet AND ziel_tage IS NULL AND skonto_prozent IS NULL AND skonto_tage IS NULL)
  OR (ziel_freigeschaltet AND ziel_tage BETWEEN 1 AND 90 AND skonto_prozent BETWEEN 0 AND 100
   AND skonto_tage BETWEEN 0 AND ziel_tage));

-- AP-EIN Teil 1, decision 12: replace customer writers in the existing contract.
-- Applied after the byte-bound _b2_kunde_k1.sql. No table or customer is deleted.
ALTER TABLE private.customer_create_receipts DROP CONSTRAINT customer_create_receipts_type_chk;
-- The explicitly authorised historical type conversion is transactional;
-- the immutable trigger is restored before this migration can commit.
ALTER TABLE private.customer_create_receipts DISABLE TRIGGER customer_create_receipts_update_immutable;
UPDATE private.customer_create_receipts SET customer_type = 'business' WHERE customer_type = 'institution';
ALTER TABLE private.customer_create_receipts ENABLE TRIGGER customer_create_receipts_update_immutable;
ALTER TABLE private.customer_create_receipts ADD CONSTRAINT customer_create_receipts_type_chk
  CHECK (customer_type IN ('business', 'privat', 'lieferant'));
ALTER TABLE private.customer_create_receipts ADD COLUMN customer_fields jsonb;

-- Preserve the previous note when the canonical column is empty. Conflicts need
-- an explicit data decision rather than silently discarding either note.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.customers WHERE notes IS NOT NULL AND internal_notes IS NOT NULL AND notes <> internal_notes) THEN
    RAISE EXCEPTION 'CUSTOMER_NOTE_MIGRATION_CONFLICT';
  END IF;
END $$;
UPDATE public.customers SET notes = internal_notes WHERE notes IS NULL AND internal_notes IS NOT NULL;

CREATE FUNCTION private.create_customer_v2(
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
REVOKE ALL ON FUNCTION private.create_customer_v2(text,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.create_customer_v2(text,uuid,uuid,text,jsonb) TO service_role;

CREATE FUNCTION private.update_customer_v1(
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
REVOKE ALL ON FUNCTION private.update_customer_v1(text,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.update_customer_v1(text,uuid,uuid,text,text,jsonb) TO service_role;

-- Updated customer state is proved by the latest immutable update event;
-- the original create receipt remains an immutable snapshot, not a second current profile.
CREATE UNIQUE INDEX events_customer_updated_version_uidx ON public.events(tenant_id,((payload->>'customerId')),aggregate_version) WHERE event_type='CUSTOMER_UPDATED_V1';
CREATE TRIGGER events_customer_updated_v1_update_immutable BEFORE UPDATE ON public.events FOR EACH ROW WHEN(OLD.event_type='CUSTOMER_UPDATED_V1' OR NEW.event_type='CUSTOMER_UPDATED_V1') EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_customer_updated_v1_delete_immutable BEFORE DELETE ON public.events FOR EACH ROW WHEN(OLD.event_type='CUSTOMER_UPDATED_V1') EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE OR REPLACE VIEW private.v_customer_create_receipts_v1 WITH (security_invoker=true) AS
SELECT receipt.id AS receipt_id,receipt.event_id,receipt.tenant_id,receipt.customer_id,
  receipt.customer_number,receipt.actor_id,receipt.client_event_id,receipt.correlation_id,
  receipt.intent_sha256,receipt.name,receipt.customer_type,receipt.company_name,
  receipt.contact_person,receipt.email,receipt.phone,receipt.street,receipt.zip_code,
  receipt.city,receipt.country,receipt.payment_preference,receipt.vat_id,receipt.notes,
  receipt.created_at AS recorded_at,
  (event.id IS NOT NULL AND customer.id IS NOT NULL AND actor.id IS NOT NULL
    AND event.tenant_id=receipt.tenant_id AND event.user_id=receipt.actor_id
    AND event.client_event_id=receipt.client_event_id AND event.correlation_id=receipt.correlation_id
    AND event.event_type='CUSTOMER_CREATED_V1' AND event.status='success'
    AND event.event_schema_version=1 AND event.aggregate_version=1
    AND event.payload->>'intentSha256'=receipt.intent_sha256
    AND event.payload->>'customerId'=receipt.customer_id
    AND event.payload->>'customerNumber'=receipt.customer_number
    AND customer.customer_number=receipt.customer_number
    AND CASE WHEN latest_update.id IS NOT NULL THEN
      latest_update.status='success' AND latest_update.user_id IS NOT NULL
      AND latest_update.client_event_id IS NOT NULL AND latest_update.correlation_id IS NOT NULL
      AND latest_update.event_schema_version=1 AND latest_update.aggregate_version>0
      AND latest_update.payload->>'intentSha256' ~ '^[0-9a-f]{64}$'
      AND jsonb_typeof(latest_update.payload->'fields')='object'
      AND to_jsonb(customer) @> (latest_update.payload->'fields')
      AND customer.name=CASE WHEN customer.type='privat' THEN concat_ws(' ',nullif(customer.first_name,''),nullif(customer.last_name,'')) ELSE customer.company_name END
    ELSE customer.name=receipt.name AND customer.type=receipt.customer_type
      AND CASE WHEN receipt.customer_fields IS NOT NULL THEN
        jsonb_typeof(receipt.customer_fields)='object'
        AND to_jsonb(customer) @> receipt.customer_fields
      ELSE
        customer.company_name IS NOT DISTINCT FROM receipt.company_name
        AND customer.email IS NOT DISTINCT FROM receipt.email AND customer.phone IS NOT DISTINCT FROM receipt.phone
        AND customer.street IS NOT DISTINCT FROM (SELECT s.street FROM private.kunde_split_street(receipt.street) s)
        AND customer.zip_code IS NOT DISTINCT FROM receipt.zip_code
        AND customer.country IS NOT DISTINCT FROM private.kunde_land_schluessel(receipt.country)
        AND customer.payment_preference IS NOT DISTINCT FROM CASE WHEN receipt.payment_preference ~ '^rechnung_[0-9]+$' THEN 'rechnung' ELSE receipt.payment_preference END
        AND customer.vat_id IS NOT DISTINCT FROM receipt.vat_id AND customer.notes IS NOT DISTINCT FROM receipt.notes
      END
    END) AS integrity_ok
FROM private.customer_create_receipts receipt
LEFT JOIN public.events event ON event.id=receipt.event_id AND event.tenant_id=receipt.tenant_id
LEFT JOIN public.customers customer ON customer.id=receipt.customer_id AND customer.tenant_id=receipt.tenant_id
LEFT JOIN LATERAL (
  SELECT update_event.* FROM public.events update_event
  WHERE update_event.tenant_id=receipt.tenant_id AND update_event.event_type='CUSTOMER_UPDATED_V1'
    AND update_event.payload->>'customerId'=receipt.customer_id
  ORDER BY update_event.aggregate_version DESC LIMIT 1
) latest_update ON true
LEFT JOIN public.app_users actor ON actor.id=receipt.actor_id AND actor.tenant_id=receipt.tenant_id
WHERE receipt.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'');
REVOKE ALL ON TABLE private.v_customer_create_receipts_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE private.v_customer_create_receipts_v1 TO service_role;

DO $$ DECLARE old_function regprocedure; BEGIN
  FOR old_function IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='private' AND p.proname IN ('create_customer_v1','update_customer_commercial_v1','update_customer_note_v1')
  LOOP EXECUTE format('DROP FUNCTION %s',old_function); END LOOP;
END $$;

-- Canonical customer fields in the existing search view; legacy contact column retired.
CREATE OR REPLACE VIEW private.v_order_intake_customers_v1
WITH (security_invoker = true)
AS
SELECT
  customer.id,
  customer.tenant_id,
  customer.customer_number,
  customer.name,
  customer.company_name,
  customer.type AS customer_type,
  NULL::text AS contact_person,
  customer.phone,
  customer.email,
  customer.street,
  customer.zip_code,
  customer.city,
  customer.country,
  customer.payment_preference,
  customer.vat_id,
  count(orders.id)::integer AS orders_count,
  lower(concat_ws(' ',
    customer.name,
    customer.company_name,
    customer.first_name, customer.last_name, concat_ws(' ',customer.last_name,customer.first_name),
    customer.phone,
    customer.email,
    customer.street,
    customer.zip_code,
    customer.city,
    customer.customer_number
  )) AS search_text,
  (
    customer.id = btrim(customer.id)
    AND length(customer.id) BETWEEN 1 AND 128
    AND customer.name = btrim(customer.name)
    AND length(customer.name) BETWEEN 2 AND 160
    AND NOT EXISTS (
      SELECT 1
      FROM public.orders corrupt_order
      WHERE corrupt_order.customer_id = customer.id
        AND corrupt_order.tenant_id IS DISTINCT FROM customer.tenant_id
    )
  ) AS integrity_ok,
  customer.salutation,customer.first_name,customer.last_name,customer.contact_role,customer.house_number,customer.handover_preference,
  customer.ziel_freigeschaltet,customer.ziel_tage,customer.auto_info,customer.vorrang
FROM public.customers customer
LEFT JOIN public.orders orders
  ON orders.customer_id = customer.id
 AND orders.tenant_id = customer.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND customer.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND coalesce(customer.source, '') NOT IN ('seed', 'test', 'demo', 'integration-test')
  AND coalesce(customer.name, '') NOT LIKE 'Capture%'
GROUP BY customer.id, customer.tenant_id, customer.customer_number,
  customer.name, customer.company_name, customer.type,
  customer.salutation,customer.first_name,customer.last_name,customer.contact_role,customer.house_number,customer.handover_preference,
  customer.ziel_freigeschaltet,customer.ziel_tage,customer.auto_info,customer.vorrang,
  customer.phone, customer.email, customer.street, customer.zip_code, customer.city,
  customer.country, customer.payment_preference, customer.vat_id;

COMMENT ON VIEW private.v_order_intake_customers_v1 IS
  'Tenant-bound F1 customer search across master-data fields; product data only.';

REVOKE ALL ON TABLE private.v_order_intake_customers_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_order_intake_customers_v1 TO service_role;

-- K1: existing invoice-term command stores the canonical preference; approval remains its only writer.
CREATE OR REPLACE FUNCTION private.enable_customer_invoice_terms_v1(
  p_tenant_id text, p_actor_id uuid, p_client_event_id uuid, p_customer_id text,
  p_target_days integer, p_cash_discount_percent numeric, p_cash_discount_days integer
)
RETURNS TABLE(result_code text, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_prior public.events%ROWTYPE;
  v_customer public.customers%ROWTYPE;
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
    OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_customer_id IS NULL
    OR p_target_days NOT BETWEEN 1 AND 90
    OR p_cash_discount_percent NOT BETWEEN 0 AND 100
    OR p_cash_discount_percent <> round(p_cash_discount_percent, 2)
    OR p_cash_discount_days NOT BETWEEN 0 AND p_target_days
    OR NOT EXISTS (SELECT 1 FROM public.app_users actor WHERE actor.id = p_actor_id AND actor.tenant_id = p_tenant_id AND actor.active)
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text, false; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('s1:customer-invoice-terms:' || p_tenant_id || ':' || p_actor_id || ':' || p_client_event_id, 0));
  SELECT event.* INTO v_prior FROM public.events event
  WHERE event.tenant_id = p_tenant_id AND event.user_id = p_actor_id
    AND event.client_event_id = p_client_event_id AND event.event_type = 'CUSTOMER_INVOICE_TERMS_ENABLED_V1';
  IF FOUND THEN
    IF v_prior.payload->>'customerId' = p_customer_id
      AND (v_prior.payload->>'targetDays')::integer = p_target_days
      AND (v_prior.payload->>'cashDiscountPercent')::numeric = p_cash_discount_percent
      AND (v_prior.payload->>'cashDiscountDays')::integer = p_cash_discount_days
    THEN RETURN QUERY SELECT 'OK'::text, true;
    ELSE RETURN QUERY SELECT 'CONFLICT'::text, true;
    END IF;
    RETURN;
  END IF;

  SELECT customer.* INTO v_customer FROM public.customers customer
  WHERE customer.tenant_id = p_tenant_id AND customer.id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, false; RETURN; END IF;
  IF v_customer.name IS NULL OR (v_customer.type = 'business' AND v_customer.last_name IS NULL) OR v_customer.phone IS NULL
    OR v_customer.email IS NULL OR v_customer.street IS NULL OR v_customer.zip_code IS NULL
    OR v_customer.city IS NULL OR v_customer.country IS NULL
  THEN RETURN QUERY SELECT 'INCOMPLETE'::text, false; RETURN; END IF;

  UPDATE public.customers
  SET ziel_freigeschaltet = true,
      ziel_tage = p_target_days,
      skonto_prozent = p_cash_discount_percent,
      skonto_tage = p_cash_discount_days,
      payment_preference = 'rechnung',
      updated_at = statement_timestamp()
  WHERE tenant_id = p_tenant_id AND id = p_customer_id;

  INSERT INTO public.events (
    id, tenant_id, event_type, description, payload, status, user_id,
    client_event_id, event_schema_version, correlation_id, aggregate_version, created_at
  ) VALUES (
    gen_random_uuid()::text, p_tenant_id, 'CUSTOMER_INVOICE_TERMS_ENABLED_V1', 'Rechnung auf Ziel freigeschaltet',
    jsonb_build_object('customerId', p_customer_id, 'targetDays', p_target_days,
      'cashDiscountPercent', p_cash_discount_percent, 'cashDiscountDays', p_cash_discount_days),
    'success', p_actor_id, p_client_event_id, 1, gen_random_uuid(), 1,
    statement_timestamp() AT TIME ZONE 'UTC'
  );
  RETURN QUERY SELECT 'OK'::text, false;
END;
$$;

-- Existing invoice-source projection reads the split canonical recipient, never retired contact_person/address.
CREATE OR REPLACE VIEW private.v_invoice_issue_source_v1
WITH (security_invoker = true)
AS
SELECT
  freeze_state.tenant_id,
  freeze_state.order_id,
  freeze_state.freeze_id,
  freeze_state.frozen_at,
  -- Berlin is the single legal service-date truth. The command must never
  -- derive a calendar day from the DB session time zone.
  (freeze_state.frozen_at AT TIME ZONE 'Europe/Berlin')::date AS service_date,
  freeze_state.order_version AS freeze_order_version,
  orders.version AS current_order_version,
  orders.order_number,
  orders.title AS order_title,
  orders.station,
  orders.status AS order_status,
  orders.customer_id,
  CASE WHEN customer.type='privat' THEN concat_ws(' ',CASE customer.salutation WHEN 'frau' THEN 'Frau' WHEN 'herr' THEN 'Herr' END,customer.first_name,customer.last_name) ELSE customer.name END AS customer_name,
  customer.company_name AS customer_company_name,
  CASE WHEN customer.type='business' AND nullif(concat_ws(' ',customer.first_name,customer.last_name),'') IS NOT NULL THEN 'z. Hd. ' || concat_ws(' ',CASE customer.salutation WHEN 'frau' THEN 'Frau' WHEN 'herr' THEN 'Herr' END,customer.first_name,customer.last_name) END AS customer_contact_person,
  CASE WHEN nullif(btrim(customer.street), '') IS NOT NULL
    THEN nullif(btrim(concat_ws(' ',customer.street,customer.house_number)), '') END AS customer_street,
  customer.zip_code AS customer_zip,
  customer.city AS customer_city,
  customer.country AS customer_country,
  company.company_name AS seller_company_name,
  company.street AS seller_street,
  company.zip AS seller_zip,
  company.city AS seller_city,
  company.country AS seller_country,
  company.tax_id AS seller_tax_id,
  company.iban AS seller_iban,
  company.bic AS seller_bic,
  company.bank_name AS seller_bank_name,
  company.invoice_vat_rate_basis_points,
  company.invoice_payment_term_days,
  coalesce(base_items.base_lines, '[]'::jsonb) AS base_lines,
  coalesce(base_items.base_line_count, 0) AS base_line_count,
  coalesce(base_items.base_net_amount_cents, 0) AS base_net_amount_cents,
  coalesce(extra_work.lines, '[]'::jsonb) AS extra_work_lines,
  freeze_state.line_count AS extra_work_line_count,
  freeze_state.total_amount_cents AS extra_work_net_amount_cents,
  company.config_count = 1
    AND nullif(btrim(company.company_name), '') IS NOT NULL
    AND nullif(btrim(company.street), '') IS NOT NULL
    AND nullif(btrim(company.zip), '') IS NOT NULL
    AND nullif(btrim(company.city), '') IS NOT NULL
    AND nullif(btrim(company.country), '') IS NOT NULL
    AND nullif(btrim(company.tax_id), '') IS NOT NULL
    AND nullif(btrim(company.iban), '') IS NOT NULL
    AND nullif(btrim(company.bic), '') IS NOT NULL
    AND nullif(btrim(company.bank_name), '') IS NOT NULL
    AND company.invoice_payment_term_days IS NOT NULL AS seller_config_complete,
  nullif(btrim(coalesce(customer.company_name, customer.name)), '') IS NOT NULL
    AND nullif(btrim(concat_ws(' ',customer.street,customer.house_number)), '') IS NOT NULL
    AND nullif(btrim(customer.zip_code), '') IS NOT NULL
    AND nullif(btrim(customer.city), '') IS NOT NULL
    AND nullif(btrim(customer.country), '') IS NOT NULL AS customer_config_complete,
  coalesce(base_items.base_line_count, 0) > 0
    AND coalesce(base_items.invalid_price_count, 0) = 0 AS base_prices_complete,
  NOT EXISTS (
    SELECT 1
    FROM public.invoices existing_invoice
    WHERE existing_invoice.tenant_id = freeze_state.tenant_id
      AND existing_invoice.order_id = freeze_state.order_id
      AND existing_invoice.contract_version = 1
      AND existing_invoice.status = 'issued'
  ) AS no_active_invoice,
  (
    freeze_state.active = true
    AND freeze_state.integrity_ok = true
    AND orders.id IS NOT NULL
    AND orders.station = 'fertig'
    AND customer.id IS NOT NULL
    AND company.config_count = 1
    AND nullif(btrim(company.company_name), '') IS NOT NULL
    AND nullif(btrim(company.street), '') IS NOT NULL
    AND nullif(btrim(company.zip), '') IS NOT NULL
    AND nullif(btrim(company.city), '') IS NOT NULL
    AND nullif(btrim(company.country), '') IS NOT NULL
    AND nullif(btrim(company.tax_id), '') IS NOT NULL
    AND nullif(btrim(company.iban), '') IS NOT NULL
    AND nullif(btrim(company.bic), '') IS NOT NULL
    AND nullif(btrim(company.bank_name), '') IS NOT NULL
    AND company.invoice_payment_term_days IS NOT NULL
    AND nullif(btrim(coalesce(customer.company_name, customer.name)), '') IS NOT NULL
    AND nullif(btrim(concat_ws(' ',customer.street,customer.house_number)), '') IS NOT NULL
    AND nullif(btrim(customer.zip_code), '') IS NOT NULL
    AND nullif(btrim(customer.city), '') IS NOT NULL
    AND nullif(btrim(customer.country), '') IS NOT NULL
    AND coalesce(base_items.base_line_count, 0) > 0
    AND coalesce(base_items.invalid_price_count, 0) = 0
  ) AS integrity_ok
FROM private.v_order_freeze_state_v1 freeze_state
JOIN public.orders orders
  ON orders.id = freeze_state.order_id
 AND orders.tenant_id = freeze_state.tenant_id
JOIN public.customers customer
  ON customer.id = orders.customer_id
 AND customer.tenant_id = orders.tenant_id
LEFT JOIN LATERAL (
  SELECT selected.*, count(*) OVER ()::integer AS config_count
  FROM public.company_settings selected
  WHERE selected.tenant_id = freeze_state.tenant_id
  ORDER BY selected.updated_at DESC, selected.id
  LIMIT 1
) company ON true
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS base_line_count,
    count(*) FILTER (WHERE item.preis_netto IS NULL OR item.preis_netto < 0)::integer
      AS invalid_price_count,
    coalesce(sum(round(item.preis_netto * 100)::bigint * item.quantity), 0)::bigint
      AS base_net_amount_cents,
    jsonb_agg(
      jsonb_build_object(
        'itemId', item.id,
        'name', item.name,
        'quantity', item.quantity,
        'unitNetAmountCents', round(item.preis_netto * 100)::bigint,
        'lineNetAmountCents', round(item.preis_netto * 100)::bigint * item.quantity
      ) ORDER BY item.id
    ) AS base_lines
  FROM public.items item
  WHERE item.tenant_id = freeze_state.tenant_id
    AND item.order_id = freeze_state.order_id
) base_items ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'itemId', line.item_id,
      'catalogPositionId', line.catalog_position_id,
      'catalogPositionName', line.catalog_position_name,
      'minutes', line.minutes,
      'hourlyRateCents', line.hourly_rate_cents,
      'amountCents', line.amount_cents
    ) ORDER BY line.item_id, line.catalog_position_name, line.catalog_position_id
  ) AS lines
  FROM private.order_frozen_extra_work_lines line
  WHERE line.tenant_id = freeze_state.tenant_id
    AND line.freeze_id = freeze_state.freeze_id
) extra_work ON true
WHERE freeze_state.active = true
  AND nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND freeze_state.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

-- AP-EIN 1: existing customer summary and global search readers.
CREATE OR REPLACE VIEW private.v_customer_summary_v1 WITH (security_invoker = true) AS
SELECT customer.id, customer.tenant_id, customer.customer_number, customer.name, customer.company_name,
  customer.type, NULL::text AS contact_person, customer.email, customer.phone, customer.street, concat_ws(' ',customer.street,customer.house_number) AS address,
  customer.zip_code, customer.city, customer.country, customer.payment_preference, customer.vat_id,
  customer.classification, customer.notes AS internal_notes, customer.tags, customer.created_at, customer.updated_at,
  count(order_row.id)::integer AS order_count,
  count(order_row.id) FILTER (WHERE order_row.status IN ('angenommen','galvanik','fertig'))::integer AS ware_im_haus_count,
  count(order_row.id) FILTER (WHERE order_row.status IN ('angenommen','galvanik','fertig')) > 0 AS ware_im_haus,
  coalesce(jsonb_agg(jsonb_build_object('id', order_row.id, 'orderNumber', order_row.order_number,
    'title', order_row.title, 'station', order_row.station, 'status', order_row.status,
    'version', order_row.version, 'dueAt', order_row.due_date)
    ORDER BY order_row.created_at DESC, order_row.id) FILTER (WHERE order_row.id IS NOT NULL), '[]'::jsonb) AS orders,
  (customer.id = btrim(customer.id) AND length(customer.id) BETWEEN 1 AND 128
    AND customer.name = btrim(customer.name) AND length(customer.name) BETWEEN 1 AND 200
    AND coalesce(bool_and(order_row.tenant_integrity_ok), true)) AS integrity_ok
FROM public.customers customer
LEFT JOIN private.v_operational_station_queue_v1 order_row ON order_row.customer_id = customer.id AND order_row.tenant_id = customer.tenant_id
WHERE customer.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND coalesce(customer.source, '') NOT IN ('seed','test','demo','integration-test')
  AND coalesce(customer.name, '') NOT LIKE 'Capture%'
GROUP BY customer.id, customer.tenant_id, customer.customer_number, customer.name, customer.company_name,
  customer.type, NULL::text, customer.email, customer.phone, customer.street, customer.house_number,
  customer.zip_code, customer.city, customer.country, customer.payment_preference, customer.vat_id,
  customer.classification, customer.notes, customer.tags, customer.created_at, customer.updated_at;

CREATE OR REPLACE VIEW private.v_card_search_documents_v1
WITH (security_invoker = true)
AS
WITH order_documents AS (
  SELECT
    'ORDER'::text AS document_type,
    orders.id AS record_id,
    orders.tenant_id,
    orders.order_number AS title,
    customer.name AS subtitle,
    orders.status,
    lower(concat_ws(
      ' ',
      orders.order_number,
      orders.title,
      orders.task,
      orders.status,
      orders.station,
      customer.name,
      customer.company_name,
      intake.note,
      intake_positions.position_text,
      live_positions.position_text
    )) AS search_document,
    (
      customer.id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.items corrupt_item
        WHERE corrupt_item.order_id = orders.id
          AND (
            corrupt_item.tenant_id IS DISTINCT FROM orders.tenant_id
            OR corrupt_item.customer_id IS DISTINCT FROM orders.customer_id
          )
      )
    ) AS integrity_ok
  FROM public.orders orders
  LEFT JOIN public.customers customer
    ON customer.id = orders.customer_id
   AND customer.tenant_id = orders.tenant_id
  LEFT JOIN LATERAL (
    SELECT receipt.note, receipt.items_snapshot
    FROM private.order_intake_receipts receipt
    WHERE receipt.order_id = orders.id
      AND receipt.tenant_id = orders.tenant_id
    ORDER BY receipt.created_at DESC, receipt.id
    LIMIT 1
  ) intake ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(
      concat_ws(
        ' ',
        snapshot.item->>'position',
        snapshot.item->>'name',
        snapshot.item->>'quantity',
        snapshot.item->>'material',
        snapshot.item->>'surfaceRequested'
      ),
      ' ' ORDER BY snapshot.ordinality
    ) AS position_text
    FROM jsonb_array_elements(coalesce(intake.items_snapshot, '[]'::jsonb))
      WITH ORDINALITY AS snapshot(item, ordinality)
  ) intake_positions ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(
      concat_ws(
        ' ',
        item.name,
        item.quantity,
        item.material,
        item.surface_requested,
        item.internal_notes,
        array_to_string(item.repair_types, ' ')
      ),
      ' ' ORDER BY item.created_at, item.id
    ) AS position_text
    FROM public.items item
    WHERE item.order_id = orders.id
      AND item.tenant_id = orders.tenant_id
      AND item.customer_id = orders.customer_id
  ) live_positions ON true
  WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
    AND orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND coalesce(orders.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
    AND coalesce(orders.order_number, '') NOT ILIKE 'A-SEED-%'
    AND coalesce(orders.order_number, '') NOT ILIKE '%TEST%'
),
customer_documents AS (
  SELECT
    'CUSTOMER'::text AS document_type,
    customer.id AS record_id,
    customer.tenant_id,
    customer.name AS title,
    coalesce(customer.company_name, customer.city, customer.customer_number) AS subtitle,
    NULL::text AS status,
    lower(concat_ws(
      ' ',
      customer.customer_number,
      customer.name,
      customer.company_name,
      customer.first_name,
      customer.last_name,
      customer.contact_role,
      customer.city,
      customer.phone,
      customer.email,
      customer.notes,
      customer.behavior_notes,
      customer_orders.order_text
    )) AS search_document,
    NOT EXISTS (
      SELECT 1
      FROM public.orders corrupt_order
      WHERE corrupt_order.customer_id = customer.id
        AND corrupt_order.tenant_id IS DISTINCT FROM customer.tenant_id
    ) AS integrity_ok
  FROM public.customers customer
  LEFT JOIN LATERAL (
    SELECT string_agg(
      concat_ws(' ', orders.order_number, orders.title, orders.task, orders.status),
      ' ' ORDER BY orders.created_at, orders.id
    ) AS order_text
    FROM public.orders orders
    WHERE orders.customer_id = customer.id
      AND orders.tenant_id = customer.tenant_id
      AND coalesce(orders.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
  ) customer_orders ON true
  WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
    AND customer.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND coalesce(customer.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
    AND coalesce(customer.name, '') NOT LIKE 'Capture%'
)
SELECT * FROM order_documents
UNION ALL
SELECT * FROM customer_documents;
