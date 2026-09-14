-- D-UI-V5-001 work unit 2: tenant-bound quote persistence and an atomic,
-- idempotent hand-off to the existing F1.1 order-intake receipt truth.

CREATE TABLE private.quote_number_counters (
  tenant_id text NOT NULL,
  number_year integer NOT NULL,
  last_value bigint NOT NULL DEFAULT 0,
  CONSTRAINT quote_number_counters_pkey PRIMARY KEY (tenant_id, number_year),
  CONSTRAINT quote_number_counters_tenant_chk
    CHECK (tenant_id = btrim(tenant_id) AND length(tenant_id) BETWEEN 1 AND 50),
  CONSTRAINT quote_number_counters_year_chk CHECK (number_year BETWEEN 2000 AND 9999),
  CONSTRAINT quote_number_counters_value_chk CHECK (last_value >= 0)
);

CREATE TABLE private.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  quote_number text NOT NULL,
  customer_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  currency text NOT NULL DEFAULT 'EUR',
  due_date date NOT NULL,
  note text,
  total_net_cents bigint NOT NULL,
  linked_order_id text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  converted_at timestamptz,
  CONSTRAINT quotes_pkey PRIMARY KEY (id),
  CONSTRAINT quotes_tenant_id_key UNIQUE (tenant_id, id),
  CONSTRAINT quotes_tenant_number_key UNIQUE (tenant_id, quote_number),
  CONSTRAINT quotes_customer_fkey
    FOREIGN KEY (tenant_id, customer_id) REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT quotes_order_fkey
    FOREIGN KEY (tenant_id, linked_order_id) REFERENCES public.orders (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT quotes_actor_fkey
    FOREIGN KEY (created_by) REFERENCES public.app_users (id) ON DELETE RESTRICT,
  CONSTRAINT quotes_number_chk CHECK (quote_number ~ '^KV-[0-9]{4}-[0-9]{4,}$'),
  CONSTRAINT quotes_state_chk CHECK (
    (status = 'draft' AND version = 1 AND linked_order_id IS NULL AND converted_at IS NULL)
    OR (status = 'converted' AND version = 2 AND linked_order_id IS NOT NULL AND converted_at IS NOT NULL)
  ),
  CONSTRAINT quotes_currency_chk CHECK (currency = 'EUR'),
  CONSTRAINT quotes_note_chk CHECK (note IS NULL OR (note = btrim(note) AND length(note) BETWEEN 1 AND 2000)),
  CONSTRAINT quotes_total_chk CHECK (total_net_cents BETWEEN 0 AND 999999999999)
);

CREATE TABLE private.quote_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  quote_id uuid NOT NULL,
  position integer NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL,
  material text,
  surface_requested text NOT NULL,
  unit_price_cents bigint NOT NULL,
  line_total_cents bigint GENERATED ALWAYS AS (quantity::bigint * unit_price_cents) STORED,
  CONSTRAINT quote_positions_pkey PRIMARY KEY (id),
  CONSTRAINT quote_positions_quote_position_key UNIQUE (tenant_id, quote_id, position),
  CONSTRAINT quote_positions_quote_fkey
    FOREIGN KEY (tenant_id, quote_id) REFERENCES private.quotes (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT quote_positions_position_chk CHECK (position BETWEEN 1 AND 20),
  CONSTRAINT quote_positions_name_chk CHECK (name = btrim(name) AND length(name) BETWEEN 2 AND 160),
  CONSTRAINT quote_positions_quantity_chk CHECK (quantity BETWEEN 1 AND 1000000),
  CONSTRAINT quote_positions_material_chk CHECK (material IS NULL OR (material = btrim(material) AND length(material) BETWEEN 1 AND 120)),
  CONSTRAINT quote_positions_surface_chk CHECK (surface_requested = btrim(surface_requested) AND length(surface_requested) BETWEEN 2 AND 160),
  CONSTRAINT quote_positions_price_chk CHECK (unit_price_cents BETWEEN 0 AND 999999999)
);

CREATE TABLE private.quote_create_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  tenant_id text NOT NULL,
  quote_id uuid NOT NULL,
  customer_id text NOT NULL,
  actor_id uuid NOT NULL,
  client_event_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  intent_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT quote_create_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT quote_create_receipts_event_key UNIQUE (event_id),
  CONSTRAINT quote_create_receipts_client_key UNIQUE (tenant_id, actor_id, client_event_id),
  CONSTRAINT quote_create_receipts_quote_fkey
    FOREIGN KEY (tenant_id, quote_id) REFERENCES private.quotes (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT quote_create_receipts_customer_fkey
    FOREIGN KEY (tenant_id, customer_id) REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT quote_create_receipts_actor_fkey
    FOREIGN KEY (actor_id) REFERENCES public.app_users (id) ON DELETE RESTRICT,
  CONSTRAINT quote_create_receipts_event_fkey
    FOREIGN KEY (event_id) REFERENCES public.events (id) ON DELETE RESTRICT,
  CONSTRAINT quote_create_receipts_intent_chk CHECK (intent_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE private.quote_conversion_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  quote_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  client_event_id uuid NOT NULL,
  intent_sha256 text NOT NULL,
  expected_version integer NOT NULL,
  event_id text NOT NULL,
  award_client_event_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT quote_conversion_requests_pkey PRIMARY KEY (id),
  CONSTRAINT quote_conversion_requests_quote_key UNIQUE (tenant_id, quote_id),
  CONSTRAINT quote_conversion_requests_client_key UNIQUE (tenant_id, actor_id, client_event_id),
  CONSTRAINT quote_conversion_requests_event_key UNIQUE (event_id),
  CONSTRAINT quote_conversion_requests_award_client_key UNIQUE (tenant_id, award_client_event_id),
  CONSTRAINT quote_conversion_requests_receipt_key UNIQUE (receipt_id),
  CONSTRAINT quote_conversion_requests_correlation_key UNIQUE (tenant_id, correlation_id),
  CONSTRAINT quote_conversion_requests_quote_fkey
    FOREIGN KEY (tenant_id, quote_id) REFERENCES private.quotes (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT quote_conversion_requests_actor_fkey
    FOREIGN KEY (actor_id) REFERENCES public.app_users (id) ON DELETE RESTRICT,
  CONSTRAINT quote_conversion_requests_intent_chk CHECK (intent_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT quote_conversion_requests_version_chk CHECK (expected_version = 1)
);

CREATE TABLE private.quote_conversion_receipts (
  id uuid NOT NULL,
  event_id text NOT NULL,
  tenant_id text NOT NULL,
  quote_id uuid NOT NULL,
  customer_id text NOT NULL,
  order_id text NOT NULL,
  order_intake_receipt_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  client_event_id uuid NOT NULL,
  award_client_event_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  intent_sha256 text NOT NULL,
  quote_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT quote_conversion_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT quote_conversion_receipts_event_key UNIQUE (event_id),
  CONSTRAINT quote_conversion_receipts_quote_key UNIQUE (tenant_id, quote_id),
  CONSTRAINT quote_conversion_receipts_order_key UNIQUE (tenant_id, order_id),
  CONSTRAINT quote_conversion_receipts_client_key UNIQUE (tenant_id, actor_id, client_event_id),
  CONSTRAINT quote_conversion_receipts_award_client_key UNIQUE (tenant_id, award_client_event_id),
  CONSTRAINT quote_conversion_receipts_quote_fkey
    FOREIGN KEY (tenant_id, quote_id) REFERENCES private.quotes (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT quote_conversion_receipts_customer_fkey
    FOREIGN KEY (tenant_id, customer_id) REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT quote_conversion_receipts_order_fkey
    FOREIGN KEY (tenant_id, order_id) REFERENCES public.orders (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT quote_conversion_receipts_intake_fkey
    FOREIGN KEY (order_intake_receipt_id) REFERENCES private.order_intake_receipts (id) ON DELETE RESTRICT,
  CONSTRAINT quote_conversion_receipts_actor_fkey
    FOREIGN KEY (actor_id) REFERENCES public.app_users (id) ON DELETE RESTRICT,
  CONSTRAINT quote_conversion_receipts_event_fkey
    FOREIGN KEY (event_id) REFERENCES public.events (id) ON DELETE RESTRICT,
  CONSTRAINT quote_conversion_receipts_intent_chk CHECK (intent_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT quote_conversion_receipts_version_chk CHECK (quote_version = 2)
);

ALTER TABLE public.events
  ADD CONSTRAINT events_quote_v1_contract_chk
  CHECK (
    event_type NOT IN ('QUOTE_CREATED_V1', 'QUOTE_AWARDED_V1')
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version = CASE event_type WHEN 'QUOTE_CREATED_V1' THEN 1 ELSE 2 END
      AND from_station IS NULL
      AND station IS NULL
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload->>'quoteId' ~ '^[0-9a-f-]{36}$'
      AND payload->>'intentSha256' ~ '^[0-9a-f]{64}$'
      AND payload = CASE event_type
        WHEN 'QUOTE_CREATED_V1' THEN jsonb_build_object(
          'quoteId', payload->>'quoteId',
          'customerId', payload->>'customerId',
          'intentSha256', payload->>'intentSha256'
        )
        ELSE jsonb_build_object(
          'quoteId', payload->>'quoteId',
          'orderId', payload->>'orderId',
          'intentSha256', payload->>'intentSha256'
        )
      END
    ), false)
  ) NOT VALID;

CREATE UNIQUE INDEX events_quote_created_uidx
  ON public.events (tenant_id, ((payload->>'quoteId')))
  WHERE event_type = 'QUOTE_CREATED_V1';
CREATE UNIQUE INDEX events_quote_awarded_uidx
  ON public.events (tenant_id, ((payload->>'quoteId')))
  WHERE event_type = 'QUOTE_AWARDED_V1';

CREATE FUNCTION private.allocate_quote_number(p_tenant_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year integer;
  v_next bigint;
BEGIN
  IF p_tenant_id IS NULL
     OR p_tenant_id IS DISTINCT FROM btrim(p_tenant_id)
     OR length(p_tenant_id) NOT BETWEEN 1 AND 50
     OR p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
  THEN
    RAISE EXCEPTION 'QUOTE_TENANT_INVALID';
  END IF;
  v_year := extract(year FROM statement_timestamp() AT TIME ZONE 'Europe/Berlin')::integer;
  INSERT INTO private.quote_number_counters (tenant_id, number_year, last_value)
  VALUES (p_tenant_id, v_year, 1)
  ON CONFLICT (tenant_id, number_year)
  DO UPDATE SET last_value = private.quote_number_counters.last_value + 1
  RETURNING last_value INTO v_next;
  RETURN 'KV-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
END;
$$;

CREATE FUNCTION private.create_quote_v1(
  p_tenant_id text,
  p_actor_id uuid,
  p_client_event_id uuid,
  p_intent_sha256 text,
  p_customer_id text,
  p_due_date date,
  p_note text,
  p_positions jsonb
)
RETURNS TABLE(result_code text, result_quote_id uuid, replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prior private.quote_create_receipts%ROWTYPE;
  v_quote_id uuid := gen_random_uuid();
  v_event_id text := gen_random_uuid()::text;
  v_receipt_id uuid := gen_random_uuid();
  v_correlation_id uuid := gen_random_uuid();
  v_quote_number text;
  v_total bigint;
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
     OR p_actor_id IS NULL OR p_client_event_id IS NULL
     OR p_intent_sha256 !~ '^[0-9a-f]{64}$'
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('path1:quote-create:' || p_tenant_id || ':' || p_actor_id::text || ':' || p_client_event_id::text, 0));
  SELECT * INTO v_prior FROM private.quote_create_receipts
   WHERE tenant_id = p_tenant_id AND actor_id = p_actor_id AND client_event_id = p_client_event_id;
  IF FOUND THEN
    IF v_prior.intent_sha256 IS DISTINCT FROM p_intent_sha256 THEN
      RETURN QUERY SELECT 'CONFLICT', NULL::uuid, false;
    ELSE
      RETURN QUERY SELECT 'OK', v_prior.quote_id, true;
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id = p_actor_id AND tenant_id = p_tenant_id AND active IS TRUE)
     OR NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND tenant_id = p_tenant_id)
  THEN RETURN QUERY SELECT 'NOT_FOUND', NULL::uuid, false; RETURN; END IF;
  IF p_due_date IS NULL
     OR (p_note IS NOT NULL AND (p_note IS DISTINCT FROM btrim(p_note) OR length(p_note) NOT BETWEEN 1 AND 2000))
     OR jsonb_typeof(p_positions) <> 'array' OR jsonb_array_length(p_positions) NOT BETWEEN 1 AND 20
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_positions) WITH ORDINALITY AS entry(value, ordinal)
       WHERE jsonb_typeof(value) <> 'object'
          OR (SELECT count(*) FROM jsonb_object_keys(value)) <> 5
          OR NOT value ?& ARRAY['name','quantity','material','surfaceRequested','unitPriceCents']
          OR value->>'name' IS DISTINCT FROM btrim(value->>'name')
          OR length(value->>'name') NOT BETWEEN 2 AND 160
          OR coalesce(value->>'quantity','') !~ '^[1-9][0-9]{0,6}$'
          OR (value->>'quantity')::integer NOT BETWEEN 1 AND 1000000
          OR NOT (value->'material' = 'null'::jsonb OR (
            jsonb_typeof(value->'material') = 'string'
            AND value->>'material' = btrim(value->>'material')
            AND length(value->>'material') BETWEEN 1 AND 120
          ))
          OR value->>'surfaceRequested' IS DISTINCT FROM btrim(value->>'surfaceRequested')
          OR length(value->>'surfaceRequested') NOT BETWEEN 2 AND 160
          OR coalesce(value->>'unitPriceCents','') !~ '^[0-9]{1,9}$'
     )
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN; END IF;

  SELECT sum((value->>'quantity')::bigint * (value->>'unitPriceCents')::bigint)
    INTO v_total FROM jsonb_array_elements(p_positions) entry(value);
  IF v_total IS NULL OR v_total NOT BETWEEN 0 AND 999999999999 THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN;
  END IF;

  v_quote_number := private.allocate_quote_number(p_tenant_id);
  INSERT INTO private.quotes (
    id, tenant_id, quote_number, customer_id, status, version, currency,
    due_date, note, total_net_cents, created_by
  ) VALUES (
    v_quote_id, p_tenant_id, v_quote_number, p_customer_id, 'draft', 1, 'EUR',
    p_due_date, p_note, v_total, p_actor_id
  );
  INSERT INTO private.quote_positions (
    tenant_id, quote_id, position, name, quantity, material, surface_requested, unit_price_cents
  )
  SELECT p_tenant_id, v_quote_id, ordinal::integer, value->>'name', (value->>'quantity')::integer,
    CASE WHEN value->'material' = 'null'::jsonb THEN NULL ELSE value->>'material' END,
    value->>'surfaceRequested', (value->>'unitPriceCents')::bigint
  FROM jsonb_array_elements(p_positions) WITH ORDINALITY AS entry(value, ordinal);
  INSERT INTO public.events (
    id, tenant_id, order_id, item_id, event_type, description, notes, payload,
    status, user_id, station, client_event_id, event_schema_version,
    correlation_id, aggregate_version, from_station, created_at
  ) VALUES (
    v_event_id, p_tenant_id, NULL, NULL, 'QUOTE_CREATED_V1', 'KV angelegt', p_note,
    jsonb_build_object('quoteId', v_quote_id::text, 'customerId', p_customer_id, 'intentSha256', p_intent_sha256),
    'success', p_actor_id, NULL, p_client_event_id, 1, v_correlation_id, 1, NULL,
    statement_timestamp() AT TIME ZONE 'UTC'
  );
  INSERT INTO private.quote_create_receipts (
    id, event_id, tenant_id, quote_id, customer_id, actor_id,
    client_event_id, correlation_id, intent_sha256
  ) VALUES (
    v_receipt_id, v_event_id, p_tenant_id, v_quote_id, p_customer_id, p_actor_id,
    p_client_event_id, v_correlation_id, p_intent_sha256
  );
  RETURN QUERY SELECT 'OK', v_quote_id, false;
END;
$$;

CREATE FUNCTION private.prepare_quote_conversion_v1(
  p_tenant_id text,
  p_actor_id uuid,
  p_quote_id uuid,
  p_client_event_id uuid,
  p_intent_sha256 text,
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
     OR p_expected_version IS NULL OR p_expected_version < 1 OR p_expected_version > 2147483647
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::jsonb, false; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('path1:quote-convert:' || p_tenant_id || ':' || p_quote_id::text, 0));
  SELECT * INTO v_request FROM private.quote_conversion_requests
   WHERE tenant_id = p_tenant_id AND actor_id = p_actor_id AND client_event_id = p_client_event_id;
  IF FOUND THEN
    IF v_request.quote_id IS DISTINCT FROM p_quote_id OR v_request.intent_sha256 IS DISTINCT FROM p_intent_sha256
       OR v_request.expected_version IS DISTINCT FROM p_expected_version
    THEN RETURN QUERY SELECT 'CONFLICT', NULL::jsonb, false; RETURN; END IF;
    v_replayed := true;
  ELSE
    IF EXISTS (SELECT 1 FROM private.quote_conversion_requests WHERE tenant_id = p_tenant_id AND quote_id = p_quote_id) THEN
      RETURN QUERY SELECT 'CONFLICT', NULL::jsonb, false; RETURN;
    END IF;
    SELECT * INTO v_quote FROM private.quotes WHERE tenant_id = p_tenant_id AND id = p_quote_id FOR UPDATE;
    IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND', NULL::jsonb, false; RETURN; END IF;
    IF v_quote.status <> 'draft' OR v_quote.version <> p_expected_version THEN
      RETURN QUERY SELECT 'CONFLICT', NULL::jsonb, false; RETURN;
    END IF;
    INSERT INTO private.quote_conversion_requests (
      tenant_id, quote_id, actor_id, client_event_id, intent_sha256, expected_version,
      event_id, award_client_event_id, receipt_id, correlation_id
    ) VALUES (
      p_tenant_id, p_quote_id, p_actor_id, p_client_event_id, p_intent_sha256, p_expected_version,
      gen_random_uuid()::text, gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
    ) RETURNING * INTO v_request;
  END IF;

  SELECT * INTO v_quote FROM private.quotes WHERE tenant_id = p_tenant_id AND id = p_quote_id;
  SELECT jsonb_agg(jsonb_build_object(
    'name', position.name,
    'quantity', position.quantity,
    'material', position.material,
    'surfaceRequested', position.surface_requested
  ) ORDER BY position.position) INTO v_items
  FROM private.quote_positions position
  WHERE position.tenant_id = p_tenant_id AND position.quote_id = p_quote_id;

  RETURN QUERY SELECT 'OK', jsonb_build_object(
    'clientEventId', p_client_event_id::text,
    'customer', jsonb_build_object('mode', 'EXISTING', 'customerId', v_quote.customer_id),
    'dueDate', to_char(v_quote.due_date, 'YYYY-MM-DD'),
    'note', v_quote.note,
    'items', v_items
  ), v_replayed;
END;
$$;

CREATE FUNCTION private.finalize_quote_conversion_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request private.quote_conversion_requests%ROWTYPE;
  v_quote private.quotes%ROWTYPE;
  v_quote_items jsonb;
  v_order_items jsonb;
BEGIN
  SELECT * INTO v_request FROM private.quote_conversion_requests
   WHERE tenant_id = NEW.tenant_id AND actor_id = NEW.actor_id AND client_event_id = NEW.client_event_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_quote FROM private.quotes
   WHERE tenant_id = NEW.tenant_id AND id = v_request.quote_id FOR UPDATE;
  IF NOT FOUND OR v_quote.status <> 'draft' OR v_quote.version <> v_request.expected_version
     OR NEW.customer_mode <> 'EXISTING' OR NEW.customer_id IS DISTINCT FROM v_quote.customer_id
     OR NEW.due_date IS DISTINCT FROM v_quote.due_date OR NEW.note IS DISTINCT FROM v_quote.note
  THEN RAISE EXCEPTION 'QUOTE_CONVERSION_ORDER_MISMATCH'; END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'name', position.name, 'quantity', position.quantity, 'material', position.material,
    'surfaceRequested', position.surface_requested
  ) ORDER BY position.position) INTO v_quote_items
  FROM private.quote_positions position
  WHERE position.tenant_id = NEW.tenant_id AND position.quote_id = v_request.quote_id;
  SELECT jsonb_agg(jsonb_build_object(
    'name', item->>'name', 'quantity', (item->>'quantity')::integer,
    'material', CASE WHEN item->'material' = 'null'::jsonb THEN NULL ELSE item->>'material' END,
    'surfaceRequested', item->>'surfaceRequested'
  ) ORDER BY (item->>'position')::integer) INTO v_order_items
  FROM jsonb_array_elements(NEW.items_snapshot) entry(item);
  IF v_quote_items IS DISTINCT FROM v_order_items THEN
    RAISE EXCEPTION 'QUOTE_CONVERSION_ITEMS_MISMATCH';
  END IF;

  UPDATE private.quotes SET
    status = 'converted', version = 2, linked_order_id = NEW.order_id,
    converted_at = statement_timestamp()
  WHERE tenant_id = NEW.tenant_id AND id = v_request.quote_id;
  INSERT INTO public.events (
    id, tenant_id, order_id, item_id, event_type, description, notes, payload,
    status, user_id, station, client_event_id, event_schema_version,
    correlation_id, aggregate_version, from_station, created_at
  ) VALUES (
    v_request.event_id, NEW.tenant_id, NULL, NULL, 'QUOTE_AWARDED_V1', 'KV beauftragt', NULL,
    jsonb_build_object('quoteId', v_request.quote_id::text, 'orderId', NEW.order_id, 'intentSha256', v_request.intent_sha256),
    'success', NEW.actor_id, NULL, v_request.award_client_event_id, 1, v_request.correlation_id, 2, NULL,
    statement_timestamp() AT TIME ZONE 'UTC'
  );
  INSERT INTO private.quote_conversion_receipts (
    id, event_id, tenant_id, quote_id, customer_id, order_id, order_intake_receipt_id,
    actor_id, client_event_id, award_client_event_id, correlation_id, intent_sha256, quote_version
  ) VALUES (
    v_request.receipt_id, v_request.event_id, NEW.tenant_id, v_request.quote_id, NEW.customer_id,
    NEW.order_id, NEW.id, NEW.actor_id, NEW.client_event_id, v_request.award_client_event_id, v_request.correlation_id,
    v_request.intent_sha256, 2
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_intake_receipt_finalize_quote
  AFTER INSERT ON private.order_intake_receipts
  FOR EACH ROW EXECUTE FUNCTION private.finalize_quote_conversion_v1();

CREATE TRIGGER quote_events_update_immutable
  BEFORE UPDATE ON public.events FOR EACH ROW
  WHEN (OLD.event_type IN ('QUOTE_CREATED_V1','QUOTE_AWARDED_V1') OR NEW.event_type IN ('QUOTE_CREATED_V1','QUOTE_AWARDED_V1'))
  EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER quote_events_delete_immutable
  BEFORE DELETE ON public.events FOR EACH ROW
  WHEN (OLD.event_type IN ('QUOTE_CREATED_V1','QUOTE_AWARDED_V1'))
  EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER quote_positions_update_immutable BEFORE UPDATE ON private.quote_positions FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER quote_positions_delete_immutable BEFORE DELETE ON private.quote_positions FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER quote_create_receipts_update_immutable BEFORE UPDATE ON private.quote_create_receipts FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER quote_create_receipts_delete_immutable BEFORE DELETE ON private.quote_create_receipts FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER quote_conversion_requests_update_immutable BEFORE UPDATE ON private.quote_conversion_requests FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER quote_conversion_requests_delete_immutable BEFORE DELETE ON private.quote_conversion_requests FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER quote_conversion_receipts_update_immutable BEFORE UPDATE ON private.quote_conversion_receipts FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER quote_conversion_receipts_delete_immutable BEFORE DELETE ON private.quote_conversion_receipts FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE VIEW private.v_quotes_v1
WITH (security_invoker = true)
AS
SELECT
  quote.id AS quote_id,
  quote.tenant_id,
  quote.quote_number,
  quote.customer_id,
  customer.customer_number,
  coalesce(nullif(customer.company_name, ''), customer.name) AS customer_display_name,
  quote.status,
  quote.version,
  quote.currency,
  quote.due_date,
  quote.note,
  quote.total_net_cents,
  quote.linked_order_id,
  quote.created_by,
  creator.full_name AS actor_display_name,
  quote.created_at,
  quote.converted_at,
  positions.positions,
  (
    customer.id IS NOT NULL AND creator.id IS NOT NULL
    AND positions.position_count BETWEEN 1 AND 20
    AND positions.calculated_total = quote.total_net_cents
    AND ((quote.status = 'draft' AND quote.version = 1 AND quote.linked_order_id IS NULL)
      OR (quote.status = 'converted' AND quote.version = 2 AND quote.linked_order_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM private.quote_conversion_receipts receipt
          WHERE receipt.tenant_id = quote.tenant_id AND receipt.quote_id = quote.id
            AND receipt.order_id = quote.linked_order_id AND receipt.quote_version = quote.version)))
  ) AS integrity_ok
FROM private.quotes quote
LEFT JOIN public.customers customer ON customer.tenant_id = quote.tenant_id AND customer.id = quote.customer_id
LEFT JOIN public.app_users creator ON creator.tenant_id = quote.tenant_id AND creator.id = quote.created_by
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS position_count,
    coalesce(sum(position.line_total_cents), 0)::bigint AS calculated_total,
    jsonb_agg(jsonb_build_object(
      'id', position.id::text, 'position', position.position, 'name', position.name,
      'quantity', position.quantity, 'material', position.material,
      'surfaceRequested', position.surface_requested, 'unitPriceCents', position.unit_price_cents,
      'lineTotalCents', position.line_total_cents
    ) ORDER BY position.position) AS positions
  FROM private.quote_positions position
  WHERE position.tenant_id = quote.tenant_id AND position.quote_id = quote.id
) positions ON true
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND quote.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_quote_create_receipts_v1
WITH (security_invoker = true)
AS
SELECT receipt.id AS receipt_id, receipt.event_id, receipt.tenant_id, receipt.quote_id,
  receipt.customer_id, receipt.actor_id, receipt.client_event_id, receipt.correlation_id,
  receipt.intent_sha256, receipt.created_at AS recorded_at,
  (event.id IS NOT NULL AND quote.id IS NOT NULL AND event.event_type = 'QUOTE_CREATED_V1'
   AND event.user_id = receipt.actor_id AND event.client_event_id = receipt.client_event_id
   AND event.correlation_id = receipt.correlation_id AND event.aggregate_version = 1
   AND event.payload = jsonb_build_object('quoteId', receipt.quote_id::text,
     'customerId', receipt.customer_id, 'intentSha256', receipt.intent_sha256)) AS integrity_ok
FROM private.quote_create_receipts receipt
LEFT JOIN public.events event ON event.tenant_id = receipt.tenant_id AND event.id = receipt.event_id
LEFT JOIN private.quotes quote ON quote.tenant_id = receipt.tenant_id AND quote.id = receipt.quote_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_quote_conversion_receipts_v1
WITH (security_invoker = true)
AS
SELECT receipt.id AS receipt_id, receipt.event_id, receipt.tenant_id, receipt.quote_id,
  receipt.customer_id, receipt.order_id, receipt.order_intake_receipt_id, receipt.actor_id,
  receipt.client_event_id, receipt.award_client_event_id, receipt.correlation_id, receipt.intent_sha256,
  receipt.quote_version, receipt.created_at AS recorded_at,
  (event.id IS NOT NULL AND quote.id IS NOT NULL AND intake.id IS NOT NULL
   AND quote.status = 'converted' AND quote.version = receipt.quote_version
   AND quote.linked_order_id = receipt.order_id AND quote.customer_id = receipt.customer_id
   AND intake.order_id = receipt.order_id AND intake.customer_id = receipt.customer_id
   AND intake.actor_id = receipt.actor_id AND intake.client_event_id = receipt.client_event_id
   AND event.event_type = 'QUOTE_AWARDED_V1' AND event.user_id = receipt.actor_id
   AND event.client_event_id = receipt.award_client_event_id AND event.correlation_id = receipt.correlation_id
   AND event.aggregate_version = 2
   AND event.payload = jsonb_build_object('quoteId', receipt.quote_id::text,
     'orderId', receipt.order_id, 'intentSha256', receipt.intent_sha256)) AS integrity_ok
FROM private.quote_conversion_receipts receipt
LEFT JOIN public.events event ON event.tenant_id = receipt.tenant_id AND event.id = receipt.event_id
LEFT JOIN private.quotes quote ON quote.tenant_id = receipt.tenant_id AND quote.id = receipt.quote_id
LEFT JOIN private.order_intake_receipts intake ON intake.id = receipt.order_intake_receipt_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON TABLE private.quotes IS 'Tenant-bound persistent quote aggregate; one immutable customer and position source.';
COMMENT ON TABLE private.quote_conversion_requests IS 'Append-only idempotency intent; it is not an award until F1.1 receipt finalization.';
COMMENT ON VIEW private.v_quotes_v1 IS 'Tenant-bound quote state and position readback with calculated-total integrity.';
COMMENT ON VIEW private.v_quote_create_receipts_v1 IS 'Immutable QUOTE_CREATED_V1 receipt readback.';
COMMENT ON VIEW private.v_quote_conversion_receipts_v1 IS 'Atomic quote-to-existing-F1.1-order receipt readback.';

REVOKE ALL ON TABLE private.quote_number_counters, private.quotes, private.quote_positions,
  private.quote_create_receipts, private.quote_conversion_requests, private.quote_conversion_receipts
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.v_quotes_v1, private.v_quote_create_receipts_v1,
  private.v_quote_conversion_receipts_v1 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.allocate_quote_number(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.create_quote_v1(text, uuid, uuid, text, text, date, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prepare_quote_conversion_v1(text, uuid, uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_quotes_v1, private.v_quote_create_receipts_v1,
  private.v_quote_conversion_receipts_v1 TO service_role;
GRANT EXECUTE ON FUNCTION private.create_quote_v1(text, uuid, uuid, text, text, date, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION private.prepare_quote_conversion_v1(text, uuid, uuid, uuid, text, integer) TO service_role;
