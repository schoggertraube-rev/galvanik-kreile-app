-- P1b: a prospect may be created with name and phone only. Orders still
-- require the complete customer master data enforced by the intake command.

CREATE OR REPLACE FUNCTION private.create_customer_v1(
  p_tenant_id text, p_actor_id uuid, p_client_event_id uuid, p_intent_sha256 text,
  p_name text, p_customer_type text, p_company_name text, p_contact_person text,
  p_email text, p_phone text, p_street text, p_zip_code text, p_city text,
  p_country text, p_payment_preference text, p_vat_id text
)
RETURNS TABLE(result_code text, result_receipt_id uuid, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_prior private.customer_create_receipts%ROWTYPE;
  v_customer_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_receipt_id uuid := gen_random_uuid();
  v_correlation_id uuid := gen_random_uuid();
  v_customer_number text;
BEGIN
  IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM btrim(p_tenant_id)
    OR length(p_tenant_id) NOT BETWEEN 1 AND 50
    OR p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
    OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_intent_sha256 !~ '^[0-9a-f]{64}$'
    OR p_name IS DISTINCT FROM btrim(p_name) OR length(p_name) NOT BETWEEN 2 AND 160
    OR p_customer_type NOT IN ('business', 'privat', 'institution')
    OR p_phone IS NULL OR p_phone IS DISTINCT FROM btrim(p_phone) OR length(p_phone) NOT BETWEEN 1 AND 80
    OR (p_company_name IS NOT NULL AND (p_company_name IS DISTINCT FROM btrim(p_company_name) OR length(p_company_name) NOT BETWEEN 2 AND 160))
    OR (p_contact_person IS NOT NULL AND (p_contact_person IS DISTINCT FROM btrim(p_contact_person) OR length(p_contact_person) NOT BETWEEN 1 AND 160))
    OR (p_email IS NOT NULL AND (p_email IS DISTINCT FROM btrim(p_email) OR length(p_email) NOT BETWEEN 3 AND 254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
    OR (p_street IS NOT NULL AND (p_street IS DISTINCT FROM btrim(p_street) OR length(p_street) NOT BETWEEN 2 AND 160))
    OR (p_zip_code IS NOT NULL AND (p_zip_code IS DISTINCT FROM btrim(p_zip_code) OR length(p_zip_code) NOT BETWEEN 2 AND 20))
    OR (p_city IS NOT NULL AND (p_city IS DISTINCT FROM btrim(p_city) OR length(p_city) NOT BETWEEN 1 AND 120))
    OR (p_country IS NOT NULL AND (p_country IS DISTINCT FROM btrim(p_country) OR length(p_country) NOT BETWEEN 2 AND 120))
    OR (p_payment_preference IS NOT NULL AND NOT (p_payment_preference IN ('vorkasse', 'bar') OR p_payment_preference ~ '^rechnung_[1-9][0-9]{0,2}$'))
    OR (p_vat_id IS NOT NULL AND (p_vat_id IS DISTINCT FROM btrim(p_vat_id) OR length(p_vat_id) NOT BETWEEN 4 AND 40))
    OR NOT EXISTS (SELECT 1 FROM public.app_users actor WHERE actor.id = p_actor_id AND actor.tenant_id = p_tenant_id AND actor.active)
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('path1:customer-create:' || p_tenant_id || ':' || p_actor_id || ':' || p_client_event_id, 0));
  SELECT receipt.* INTO v_prior FROM private.customer_create_receipts receipt
   WHERE receipt.tenant_id = p_tenant_id AND receipt.actor_id = p_actor_id AND receipt.client_event_id = p_client_event_id LIMIT 2;
  IF FOUND THEN
    IF v_prior.intent_sha256 IS DISTINCT FROM p_intent_sha256 THEN RETURN QUERY SELECT 'CONFLICT'::text, NULL::uuid, false;
    ELSE RETURN QUERY SELECT 'OK'::text, v_prior.id, true; END IF;
    RETURN;
  END IF;

  v_customer_number := private.allocate_customer_number(p_tenant_id);
  INSERT INTO public.customers (
    id, tenant_id, customer_number, name, type, company_name, contact_person, email, phone,
    street, zip_code, city, country, payment_preference, vat_id, source, source_ref, created_at, updated_at
  ) VALUES (
    v_customer_id::text, p_tenant_id, v_customer_number, p_name, p_customer_type, p_company_name,
    p_contact_person, p_email, p_phone, p_street, p_zip_code, p_city, p_country,
    p_payment_preference, p_vat_id, 'PATH1_CUSTOMER_COMMAND', p_client_event_id::text,
    statement_timestamp() AT TIME ZONE 'UTC', statement_timestamp()
  );
  INSERT INTO public.events (
    id, tenant_id, event_type, description, payload, status, user_id, client_event_id,
    event_schema_version, correlation_id, aggregate_version, created_at
  ) VALUES (
    v_event_id::text, p_tenant_id, 'CUSTOMER_CREATED_V1', 'Kunde angelegt',
    jsonb_build_object('customerId', v_customer_id::text, 'customerNumber', v_customer_number,
      'intentSha256', p_intent_sha256, 'completeForOrder',
      p_contact_person IS NOT NULL AND p_email IS NOT NULL AND p_street IS NOT NULL
        AND p_zip_code IS NOT NULL AND p_city IS NOT NULL AND p_country IS NOT NULL
        AND p_payment_preference IS NOT NULL),
    'success', p_actor_id, p_client_event_id, 1, v_correlation_id, 1, statement_timestamp() AT TIME ZONE 'UTC'
  );
  INSERT INTO private.customer_create_receipts (
    id, event_id, tenant_id, customer_id, customer_number, actor_id, client_event_id,
    correlation_id, intent_sha256, name, customer_type, company_name, contact_person,
    email, phone, street, zip_code, city, country, payment_preference, vat_id, created_at
  ) VALUES (
    v_receipt_id, v_event_id::text, p_tenant_id, v_customer_id::text, v_customer_number,
    p_actor_id, p_client_event_id, v_correlation_id, p_intent_sha256, p_name, p_customer_type,
    p_company_name, p_contact_person, p_email, p_phone, p_street, p_zip_code, p_city,
    p_country, p_payment_preference, p_vat_id, statement_timestamp()
  );
  RETURN QUERY SELECT 'OK'::text, v_receipt_id, false;
END;
$$;

CREATE OR REPLACE VIEW private.v_customer_create_receipts_v1 WITH (security_invoker = true) AS
SELECT receipt.id AS receipt_id, receipt.event_id, receipt.tenant_id, receipt.customer_id,
  receipt.customer_number, receipt.actor_id, receipt.client_event_id, receipt.correlation_id,
  receipt.intent_sha256, receipt.name, receipt.customer_type, receipt.company_name,
  receipt.contact_person, receipt.email, receipt.phone, receipt.street, receipt.zip_code,
  receipt.city, receipt.country, receipt.payment_preference, receipt.vat_id,
  receipt.created_at AS recorded_at,
  (event.id IS NOT NULL AND customer.id IS NOT NULL AND actor.id IS NOT NULL
    AND event.tenant_id = receipt.tenant_id AND event.user_id = receipt.actor_id
    AND event.client_event_id = receipt.client_event_id AND event.correlation_id = receipt.correlation_id
    AND event.event_type = 'CUSTOMER_CREATED_V1' AND event.status = 'success'
    AND customer.customer_number = receipt.customer_number AND customer.name = receipt.name
    AND customer.type = receipt.customer_type AND customer.company_name IS NOT DISTINCT FROM receipt.company_name
    AND customer.contact_person IS NOT DISTINCT FROM receipt.contact_person
    AND customer.email IS NOT DISTINCT FROM receipt.email AND customer.phone IS NOT DISTINCT FROM receipt.phone
    AND customer.street IS NOT DISTINCT FROM receipt.street AND customer.zip_code IS NOT DISTINCT FROM receipt.zip_code
    AND customer.city IS NOT DISTINCT FROM receipt.city AND customer.country IS NOT DISTINCT FROM receipt.country
    AND customer.payment_preference IS NOT DISTINCT FROM receipt.payment_preference
    AND customer.vat_id IS NOT DISTINCT FROM receipt.vat_id) AS integrity_ok
FROM private.customer_create_receipts receipt
LEFT JOIN public.events event ON event.id = receipt.event_id AND event.tenant_id = receipt.tenant_id
LEFT JOIN public.customers customer ON customer.id = receipt.customer_id AND customer.tenant_id = receipt.tenant_id
LEFT JOIN public.app_users actor ON actor.id = receipt.actor_id AND actor.tenant_id = receipt.tenant_id
WHERE receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

REVOKE ALL ON FUNCTION private.create_customer_v1(text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.create_customer_v1(text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) TO service_role;
REVOKE ALL ON TABLE private.v_customer_create_receipts_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_customer_create_receipts_v1 TO service_role;
