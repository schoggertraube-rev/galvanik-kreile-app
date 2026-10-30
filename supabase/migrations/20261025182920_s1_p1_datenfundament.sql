-- Verkaufsstufe 1 / P1: one additive data foundation for company settings,
-- service catalogue, complete customers, invoice-ready intake lines and
-- reasoned promise-date changes. No seed or production data is introduced.

CREATE TABLE public.catalog_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  name text NOT NULL,
  surface text NOT NULL,
  unit text NOT NULL,
  net_price_cents integer NOT NULL,
  vat_rate_basis_points integer NOT NULL DEFAULT 1900,
  standard_lead_time_working_days integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT catalog_services_name_chk CHECK (name = btrim(name) AND length(name) BETWEEN 2 AND 160),
  CONSTRAINT catalog_services_surface_chk CHECK (surface = btrim(surface) AND length(surface) BETWEEN 2 AND 160),
  CONSTRAINT catalog_services_unit_chk CHECK (unit = btrim(unit) AND length(unit) BETWEEN 1 AND 40),
  CONSTRAINT catalog_services_price_chk CHECK (net_price_cents BETWEEN 0 AND 999999999),
  CONSTRAINT catalog_services_vat_chk CHECK (vat_rate_basis_points IN (0, 700, 1900)),
  CONSTRAINT catalog_services_lead_chk CHECK (standard_lead_time_working_days BETWEEN 0 AND 365),
  CONSTRAINT catalog_services_tenant_name_uidx UNIQUE (tenant_id, name, surface)
);

ALTER TABLE public.catalog_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_services_tenant_isolation ON public.catalog_services
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));
REVOKE ALL ON TABLE public.catalog_services FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.catalog_services TO service_role;

ALTER TABLE public.items
  ADD COLUMN catalog_service_id uuid REFERENCES public.catalog_services(id) ON DELETE RESTRICT,
  ADD COLUMN unit text,
  ADD COLUMN vat_rate_basis_points integer;

ALTER TABLE public.items
  ADD CONSTRAINT items_unit_chk CHECK (unit IS NULL OR (unit = btrim(unit) AND length(unit) BETWEEN 1 AND 40)),
  ADD CONSTRAINT items_vat_rate_chk CHECK (vat_rate_basis_points IS NULL OR vat_rate_basis_points IN (0, 700, 1900));

DROP VIEW private.v_order_intake_receipts_v1;
CREATE VIEW private.v_order_intake_receipts_v1 WITH (security_invoker = true) AS
SELECT receipt.id AS receipt_id, receipt.event_id, receipt.tenant_id, receipt.order_id,
  receipt.customer_id, receipt.actor_id, actor.full_name AS actor_display_name,
  receipt.client_event_id, receipt.correlation_id, receipt.intent_sha256, receipt.customer_mode,
  receipt.order_number, receipt.customer_display_name, receipt.due_date, receipt.note,
  receipt.items_snapshot, receipt.created_at AS recorded_at, orders.version AS current_order_version,
  orders.station AS current_station, orders.status AS current_status,
  (event.id IS NOT NULL AND orders.id IS NOT NULL AND customer.id IS NOT NULL AND actor.id IS NOT NULL
    AND event.user_id = receipt.actor_id AND event.client_event_id = receipt.client_event_id
    AND event.correlation_id = receipt.correlation_id AND event.event_type = 'ORDER_INTAKE_CREATED_V1'
    AND event.status = 'success' AND orders.customer_id = receipt.customer_id
    AND orders.order_number = receipt.order_number AND orders.promised_due_date::date = receipt.due_date
    AND jsonb_typeof(receipt.items_snapshot) = 'array' AND jsonb_array_length(receipt.items_snapshot) BETWEEN 1 AND 20
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(receipt.items_snapshot) snapshot(item)
      LEFT JOIN public.items line ON line.id = snapshot.item->>'id' AND line.order_id = receipt.order_id
        AND line.tenant_id = receipt.tenant_id AND line.customer_id = receipt.customer_id
      LEFT JOIN public.catalog_services service ON service.id = (snapshot.item->>'catalogServiceId')::uuid
        AND service.tenant_id = receipt.tenant_id
      WHERE line.id IS NULL OR service.id IS NULL
        OR line.catalog_service_id IS DISTINCT FROM service.id
        OR line.name IS DISTINCT FROM snapshot.item->>'name'
        OR line.quantity IS DISTINCT FROM (snapshot.item->>'quantity')::integer
        OR line.material IS DISTINCT FROM nullif(snapshot.item->>'material', '')
        OR line.surface_requested IS DISTINCT FROM snapshot.item->>'surfaceRequested'
        OR line.unit IS DISTINCT FROM snapshot.item->>'unit'
        OR round(line.preis_netto * 100)::integer IS DISTINCT FROM (snapshot.item->>'unitPriceCents')::integer
        OR line.vat_rate_basis_points IS DISTINCT FROM (snapshot.item->>'vatRateBasisPoints')::integer
    )) AS integrity_ok
FROM private.order_intake_receipts receipt
LEFT JOIN public.events event ON event.id = receipt.event_id AND event.tenant_id = receipt.tenant_id
LEFT JOIN public.orders orders ON orders.id = receipt.order_id AND orders.tenant_id = receipt.tenant_id
LEFT JOIN public.customers customer ON customer.id = receipt.customer_id AND customer.tenant_id = receipt.tenant_id
LEFT JOIN public.app_users actor ON actor.id = receipt.actor_id AND actor.tenant_id = receipt.tenant_id
WHERE receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');
REVOKE ALL ON TABLE private.v_order_intake_receipts_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_order_intake_receipts_v1 TO service_role;

ALTER TABLE public.customers ADD COLUMN vat_id text;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_payment_preference_s1_chk
    CHECK (payment_preference IN ('vorkasse', 'bar') OR payment_preference ~ '^rechnung_[1-9][0-9]{0,2}$') NOT VALID,
  ADD CONSTRAINT customers_vat_id_s1_chk
    CHECK (vat_id IS NULL OR (vat_id = btrim(vat_id) AND length(vat_id) BETWEEN 4 AND 40)) NOT VALID;

ALTER TABLE private.customer_create_receipts
  ADD COLUMN street text,
  ADD COLUMN zip_code text,
  ADD COLUMN country text,
  ADD COLUMN payment_preference text,
  ADD COLUMN vat_id text;

DROP VIEW private.v_customer_create_receipts_v1;
DROP FUNCTION private.create_customer_v1(text, uuid, uuid, text, text, text, text, text, text, text, text);

CREATE FUNCTION private.create_customer_v1(
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
    OR p_street IS DISTINCT FROM btrim(p_street) OR length(p_street) NOT BETWEEN 2 AND 160
    OR p_zip_code IS DISTINCT FROM btrim(p_zip_code) OR length(p_zip_code) NOT BETWEEN 2 AND 20
    OR p_city IS DISTINCT FROM btrim(p_city) OR length(p_city) NOT BETWEEN 1 AND 120
    OR p_country IS DISTINCT FROM btrim(p_country) OR length(p_country) NOT BETWEEN 2 AND 120
    OR NOT (p_payment_preference IN ('vorkasse', 'bar') OR p_payment_preference ~ '^rechnung_[1-9][0-9]{0,2}$')
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
    jsonb_build_object('customerId', v_customer_id::text, 'customerNumber', v_customer_number, 'intentSha256', p_intent_sha256),
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

CREATE VIEW private.v_customer_create_receipts_v1 WITH (security_invoker = true) AS
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
    AND customer.street = receipt.street AND customer.zip_code = receipt.zip_code
    AND customer.city = receipt.city AND customer.country = receipt.country
    AND customer.payment_preference = receipt.payment_preference
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

CREATE FUNCTION private.update_customer_commercial_v1(
  p_tenant_id text, p_actor_id uuid, p_client_event_id uuid, p_customer_id text,
  p_street text, p_zip_code text, p_city text, p_country text, p_payment_preference text, p_vat_id text
)
RETURNS TABLE(result_code text, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_prior public.events%ROWTYPE; v_correlation uuid := gen_random_uuid();
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
    OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_customer_id IS NULL
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
  UPDATE public.customers SET street = p_street, zip_code = p_zip_code, city = p_city,
    country = p_country, payment_preference = p_payment_preference, vat_id = p_vat_id,
    updated_at = statement_timestamp()
   WHERE id = p_customer_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, false; RETURN; END IF;
  INSERT INTO public.events (id, tenant_id, event_type, description, payload, status, user_id,
    client_event_id, event_schema_version, correlation_id, aggregate_version, created_at)
  VALUES (gen_random_uuid()::text, p_tenant_id, 'CUSTOMER_COMMERCIAL_UPDATED_V1', 'Kundenstammdaten aktualisiert',
    jsonb_build_object('customerId', p_customer_id), 'success', p_actor_id, p_client_event_id, 1,
    v_correlation, 1, statement_timestamp() AT TIME ZONE 'UTC');
  RETURN QUERY SELECT 'OK'::text, false;
END;
$$;
REVOKE ALL ON FUNCTION private.update_customer_commercial_v1(text, uuid, uuid, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.update_customer_commercial_v1(text, uuid, uuid, text, text, text, text, text, text, text) TO service_role;

DROP VIEW private.v_customer_summary_v1;
CREATE VIEW private.v_customer_summary_v1 WITH (security_invoker = true) AS
SELECT customer.id, customer.tenant_id, customer.customer_number, customer.name, customer.company_name,
  customer.type, customer.contact_person, customer.email, customer.phone, customer.street, customer.address,
  customer.zip_code, customer.city, customer.country, customer.payment_preference, customer.vat_id,
  customer.classification, customer.internal_notes, customer.tags, customer.created_at, customer.updated_at,
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
  customer.type, customer.contact_person, customer.email, customer.phone, customer.street, customer.address,
  customer.zip_code, customer.city, customer.country, customer.payment_preference, customer.vat_id,
  customer.classification, customer.internal_notes, customer.tags, customer.created_at, customer.updated_at;
REVOKE ALL ON TABLE private.v_customer_summary_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_customer_summary_v1 TO service_role;

CREATE FUNCTION private.update_order_promised_due_date_v1(
  p_tenant_id text, p_actor_id uuid, p_client_event_id uuid, p_order_id text, p_due_date date, p_reason text
)
RETURNS TABLE(result_code text, result_version integer, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_version integer; v_prior public.events%ROWTYPE;
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
    OR p_due_date IS NULL OR p_reason IS DISTINCT FROM btrim(p_reason) OR length(p_reason) NOT BETWEEN 3 AND 500
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::integer, false; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('s1:promise:' || p_tenant_id || ':' || p_actor_id || ':' || p_client_event_id, 0));
  SELECT event.* INTO v_prior FROM public.events event WHERE event.tenant_id = p_tenant_id AND event.user_id = p_actor_id
    AND event.client_event_id = p_client_event_id AND event.event_type = 'ORDER_PROMISED_DUE_DATE_CHANGED_V1';
  IF FOUND THEN RETURN QUERY SELECT 'OK'::text, v_prior.aggregate_version, true; RETURN; END IF;
  UPDATE public.orders SET promised_due_date = p_due_date, due_date = p_due_date, version = version + 1
    WHERE id = p_order_id AND tenant_id = p_tenant_id RETURNING version INTO v_version;
  IF v_version IS NULL THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::integer, false; RETURN; END IF;
  INSERT INTO public.events (id, tenant_id, order_id, event_type, description, notes, payload, status, user_id,
    client_event_id, event_schema_version, correlation_id, aggregate_version, created_at)
  VALUES (gen_random_uuid()::text, p_tenant_id, p_order_id, 'ORDER_PROMISED_DUE_DATE_CHANGED_V1',
    'Liefertermin geändert', p_reason, jsonb_build_object('promisedDueDate', p_due_date), 'success', p_actor_id,
    p_client_event_id, 1, gen_random_uuid(), v_version, statement_timestamp() AT TIME ZONE 'UTC');
  RETURN QUERY SELECT 'OK'::text, v_version, false;
END;
$$;
REVOKE ALL ON FUNCTION private.update_order_promised_due_date_v1(text, uuid, uuid, text, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.update_order_promised_due_date_v1(text, uuid, uuid, text, date, text) TO service_role;

COMMENT ON TABLE public.catalog_services IS 'S1/P1 tenant-bound service catalogue consumed through the katalog module facade.';
