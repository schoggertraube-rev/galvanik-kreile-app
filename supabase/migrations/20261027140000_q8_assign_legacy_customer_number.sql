-- Q8: completing a legacy customer assigns the canonical customer number once.

CREATE OR REPLACE FUNCTION private.update_customer_commercial_v1(
  p_tenant_id text, p_actor_id uuid, p_client_event_id uuid, p_customer_id text,
  p_name text, p_company_name text, p_contact_person text, p_email text, p_phone text,
  p_street text, p_zip_code text, p_city text, p_country text, p_payment_preference text, p_vat_id text
)
RETURNS TABLE(result_code text, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_prior public.events%ROWTYPE;
  v_correlation uuid := gen_random_uuid();
  v_customer_number text;
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
    OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_customer_id IS NULL
    OR p_name IS DISTINCT FROM btrim(p_name) OR length(p_name) NOT BETWEEN 2 AND 160
    OR (p_company_name IS NOT NULL AND (p_company_name IS DISTINCT FROM btrim(p_company_name) OR length(p_company_name) NOT BETWEEN 2 AND 160))
    OR p_contact_person IS NULL OR p_contact_person IS DISTINCT FROM btrim(p_contact_person) OR length(p_contact_person) NOT BETWEEN 1 AND 160
    OR p_email IS NULL OR p_email IS DISTINCT FROM btrim(p_email) OR length(p_email) NOT BETWEEN 3 AND 254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR p_phone IS NULL OR p_phone IS DISTINCT FROM btrim(p_phone) OR length(p_phone) NOT BETWEEN 1 AND 80
    OR p_street IS DISTINCT FROM btrim(p_street) OR length(p_street) NOT BETWEEN 2 AND 160
    OR p_zip_code IS DISTINCT FROM btrim(p_zip_code) OR length(p_zip_code) NOT BETWEEN 2 AND 20
    OR p_city IS DISTINCT FROM btrim(p_city) OR length(p_city) NOT BETWEEN 1 AND 120
    OR p_country IS DISTINCT FROM btrim(p_country) OR length(p_country) NOT BETWEEN 2 AND 120
    OR NOT (p_payment_preference IN ('vorkasse', 'bar') OR p_payment_preference ~ '^rechnung_[1-9][0-9]{0,2}$')
    OR (p_vat_id IS NOT NULL AND (p_vat_id IS DISTINCT FROM btrim(p_vat_id) OR length(p_vat_id) NOT BETWEEN 4 AND 40))
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text, false; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('s1:customer-update:' || p_tenant_id || ':' || p_actor_id || ':' || p_client_event_id, 0));
  SELECT event.* INTO v_prior FROM public.events event WHERE event.tenant_id = p_tenant_id
    AND event.user_id = p_actor_id AND event.client_event_id = p_client_event_id AND event.event_type = 'CUSTOMER_COMMERCIAL_UPDATED_V1';
  IF FOUND THEN RETURN QUERY SELECT 'OK'::text, true; RETURN; END IF;

  SELECT customer.customer_number INTO v_customer_number
  FROM public.customers customer
  WHERE customer.id = p_customer_id AND customer.tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, false; RETURN; END IF;
  IF v_customer_number IS NULL THEN
    v_customer_number := private.allocate_customer_number(p_tenant_id);
  END IF;

  UPDATE public.customers SET customer_number = v_customer_number,
    name = p_name, company_name = p_company_name,
    contact_person = p_contact_person, email = p_email, phone = p_phone,
    street = p_street, zip_code = p_zip_code, city = p_city, country = p_country,
    payment_preference = p_payment_preference, vat_id = p_vat_id, updated_at = statement_timestamp()
  WHERE id = p_customer_id AND tenant_id = p_tenant_id;

  INSERT INTO public.events (id, tenant_id, event_type, description, payload, status, user_id,
    client_event_id, event_schema_version, correlation_id, aggregate_version, created_at)
  VALUES (gen_random_uuid()::text, p_tenant_id, 'CUSTOMER_COMMERCIAL_UPDATED_V1', 'Kundenstammdaten aktualisiert',
    jsonb_build_object('customerId', p_customer_id, 'customerNumber', v_customer_number), 'success', p_actor_id, p_client_event_id, 1,
    v_correlation, 1, statement_timestamp() AT TIME ZONE 'UTC');
  RETURN QUERY SELECT 'OK'::text, false;
END;
$$;

REVOKE ALL ON FUNCTION private.update_customer_commercial_v1(text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.update_customer_commercial_v1(text, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text) TO service_role;
