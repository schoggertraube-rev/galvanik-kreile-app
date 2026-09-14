-- D-UI-V5-001: tenant-bound customer creation with a database-side number
-- counter, immutable event/receipt and exact readback. No SELECT-max sequence.

CREATE TABLE private.customer_number_counters (
  tenant_id text NOT NULL,
  number_year integer NOT NULL,
  last_value bigint NOT NULL DEFAULT 0,
  CONSTRAINT customer_number_counters_pkey PRIMARY KEY (tenant_id, number_year),
  CONSTRAINT customer_number_counters_tenant_chk
    CHECK (tenant_id = btrim(tenant_id) AND length(tenant_id) BETWEEN 1 AND 50),
  CONSTRAINT customer_number_counters_year_chk CHECK (number_year BETWEEN 2000 AND 9999),
  CONSTRAINT customer_number_counters_value_chk CHECK (last_value >= 0)
);

CREATE FUNCTION private.allocate_customer_number(p_tenant_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_number_year integer;
  next_value bigint;
BEGIN
  IF p_tenant_id IS NULL
     OR p_tenant_id IS DISTINCT FROM btrim(p_tenant_id)
     OR length(p_tenant_id) NOT BETWEEN 1 AND 50
     OR p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
  THEN
    RAISE EXCEPTION 'CUSTOMER_NUMBER_TENANT_INVALID';
  END IF;

  v_number_year := extract(year FROM statement_timestamp() AT TIME ZONE 'Europe/Berlin')::integer;

  INSERT INTO private.customer_number_counters (tenant_id, number_year, last_value)
  VALUES (p_tenant_id, v_number_year, 1)
  ON CONFLICT (tenant_id, number_year)
  DO UPDATE SET last_value = private.customer_number_counters.last_value + 1
  RETURNING last_value INTO next_value;

  IF next_value < 1 THEN
    RAISE EXCEPTION 'CUSTOMER_NUMBER_INVALID';
  END IF;

  RETURN 'K-' || v_number_year::text || '-' || lpad(next_value::text, 4, '0');
END;
$$;

CREATE UNIQUE INDEX customers_tenant_customer_number_uidx
  ON public.customers (tenant_id, customer_number)
  WHERE customer_number IS NOT NULL;

CREATE TABLE private.customer_create_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  tenant_id text NOT NULL,
  customer_id text NOT NULL,
  customer_number text NOT NULL,
  actor_id uuid NOT NULL,
  client_event_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  intent_sha256 text NOT NULL,
  name text NOT NULL,
  customer_type text NOT NULL,
  company_name text,
  contact_person text,
  email text,
  phone text,
  city text,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT customer_create_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT customer_create_receipts_event_key UNIQUE (event_id),
  CONSTRAINT customer_create_receipts_client_key UNIQUE (tenant_id, actor_id, client_event_id),
  CONSTRAINT customer_create_receipts_event_fkey
    FOREIGN KEY (event_id) REFERENCES public.events (id) ON DELETE RESTRICT,
  CONSTRAINT customer_create_receipts_customer_fkey
    FOREIGN KEY (tenant_id, customer_id) REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT customer_create_receipts_actor_fkey
    FOREIGN KEY (actor_id) REFERENCES public.app_users (id) ON DELETE RESTRICT,
  CONSTRAINT customer_create_receipts_number_chk CHECK (customer_number ~ '^K-[0-9]{4}-[0-9]{4,}$'),
  CONSTRAINT customer_create_receipts_intent_chk CHECK (intent_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT customer_create_receipts_name_chk
    CHECK (name = btrim(name) AND length(name) BETWEEN 2 AND 160),
  CONSTRAINT customer_create_receipts_type_chk
    CHECK (customer_type IN ('business', 'privat', 'institution')),
  CONSTRAINT customer_create_receipts_company_chk
    CHECK (company_name IS NULL OR (company_name = btrim(company_name) AND length(company_name) BETWEEN 2 AND 160)),
  CONSTRAINT customer_create_receipts_contact_chk
    CHECK (contact_person IS NULL OR (contact_person = btrim(contact_person) AND length(contact_person) BETWEEN 1 AND 160)),
  CONSTRAINT customer_create_receipts_email_chk
    CHECK (email IS NULL OR (email = btrim(email) AND length(email) BETWEEN 3 AND 254)),
  CONSTRAINT customer_create_receipts_phone_chk
    CHECK (phone IS NULL OR (phone = btrim(phone) AND length(phone) BETWEEN 1 AND 80)),
  CONSTRAINT customer_create_receipts_city_chk
    CHECK (city IS NULL OR (city = btrim(city) AND length(city) BETWEEN 1 AND 120))
);

ALTER TABLE public.events
  ADD CONSTRAINT events_customer_created_v1_contract_chk
  CHECK (
    event_type <> 'CUSTOMER_CREATED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version = 1
      AND from_station IS NULL
      AND station IS NULL
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload->>'customerId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND payload->>'customerNumber' ~ '^K-[0-9]{4}-[0-9]{4,}$'
      AND payload->>'intentSha256' ~ '^[0-9a-f]{64}$'
      AND payload = jsonb_build_object(
        'customerId', payload->>'customerId',
        'customerNumber', payload->>'customerNumber',
        'intentSha256', payload->>'intentSha256'
      )
    ), false)
  ) NOT VALID;

CREATE UNIQUE INDEX events_customer_created_customer_uidx
  ON public.events (tenant_id, ((payload->>'customerId')))
  WHERE event_type = 'CUSTOMER_CREATED_V1';

CREATE UNIQUE INDEX events_customer_created_correlation_uidx
  ON public.events (tenant_id, correlation_id)
  WHERE event_type = 'CUSTOMER_CREATED_V1';

CREATE TRIGGER events_customer_created_v1_update_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'CUSTOMER_CREATED_V1' OR NEW.event_type = 'CUSTOMER_CREATED_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_customer_created_v1_delete_immutable
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'CUSTOMER_CREATED_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER customer_create_receipts_update_immutable
  BEFORE UPDATE ON private.customer_create_receipts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER customer_create_receipts_delete_immutable
  BEFORE DELETE ON private.customer_create_receipts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER customer_create_receipts_truncate_immutable
  BEFORE TRUNCATE ON private.customer_create_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE VIEW private.v_customer_create_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  receipt.id AS receipt_id,
  receipt.event_id,
  receipt.tenant_id,
  receipt.customer_id,
  receipt.customer_number,
  receipt.actor_id,
  actor.full_name AS actor_display_name,
  receipt.client_event_id,
  receipt.correlation_id,
  receipt.intent_sha256,
  receipt.name,
  receipt.customer_type,
  receipt.company_name,
  receipt.contact_person,
  receipt.email,
  receipt.phone,
  receipt.city,
  receipt.created_at AS recorded_at,
  (
    event.id IS NOT NULL
    AND customer.id IS NOT NULL
    AND actor.id IS NOT NULL
    AND event.tenant_id = receipt.tenant_id
    AND event.order_id IS NULL
    AND event.item_id IS NULL
    AND event.user_id = receipt.actor_id
    AND event.client_event_id = receipt.client_event_id
    AND event.correlation_id = receipt.correlation_id
    AND event.event_type = 'CUSTOMER_CREATED_V1'
    AND event.event_schema_version = 1
    AND event.aggregate_version = 1
    AND event.from_station IS NULL
    AND event.station IS NULL
    AND event.status = 'success'
    AND event.payload = jsonb_build_object(
      'customerId', receipt.customer_id,
      'customerNumber', receipt.customer_number,
      'intentSha256', receipt.intent_sha256
    )
    AND receipt.created_at >= event.created_at AT TIME ZONE 'UTC'
    AND customer.customer_number = receipt.customer_number
    AND customer.name = receipt.name
    AND customer.type = receipt.customer_type
    AND customer.company_name IS NOT DISTINCT FROM receipt.company_name
    AND customer.contact_person IS NOT DISTINCT FROM receipt.contact_person
    AND customer.email IS NOT DISTINCT FROM receipt.email
    AND customer.phone IS NOT DISTINCT FROM receipt.phone
    AND customer.city IS NOT DISTINCT FROM receipt.city
  ) AS integrity_ok
FROM private.customer_create_receipts receipt
LEFT JOIN public.events event
  ON event.id = receipt.event_id
 AND event.tenant_id = receipt.tenant_id
LEFT JOIN public.customers customer
  ON customer.id = receipt.customer_id
 AND customer.tenant_id = receipt.tenant_id
LEFT JOIN public.app_users actor
  ON actor.id = receipt.actor_id
 AND actor.tenant_id = receipt.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON TABLE private.customer_number_counters IS
  'Tenant/year customer number counter; allocated with an atomic upsert, never SELECT-max.';
COMMENT ON TABLE private.customer_create_receipts IS
  'Append-only CUSTOMER_CREATED_V1 receipts with idempotency intent.';
COMMENT ON VIEW private.v_customer_create_receipts_v1 IS
  'Tenant-bound immutable customer creation receipt and persisted customer integrity readback.';

REVOKE ALL ON TABLE private.customer_number_counters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.customer_create_receipts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.v_customer_create_receipts_v1 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.allocate_customer_number(text) FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE private.customer_number_counters TO service_role;
GRANT SELECT, INSERT ON TABLE private.customer_create_receipts TO service_role;
GRANT SELECT ON TABLE private.v_customer_create_receipts_v1 TO service_role;
GRANT EXECUTE ON FUNCTION private.allocate_customer_number(text) TO service_role;
