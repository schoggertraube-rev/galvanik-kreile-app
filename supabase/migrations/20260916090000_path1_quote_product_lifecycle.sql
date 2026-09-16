-- PATH1 V5 P2: resumable, versioned tenant-bound quote drafts.
-- Existing quote positions remain append-only. The aggregate points at its
-- current revision through private.quotes.version; no second order writer is introduced.

ALTER TABLE private.quotes
  ADD COLUMN updated_by uuid,
  ADD COLUMN updated_at timestamptz;

UPDATE private.quotes
SET updated_by = created_by,
    updated_at = created_at
WHERE updated_by IS NULL OR updated_at IS NULL;

ALTER TABLE private.quotes
  ALTER COLUMN updated_by SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  ADD CONSTRAINT quotes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

-- The existing create command remains the only quote writer for a first
-- revision. Give its rows the same update provenance as an explicit edit.
CREATE FUNCTION private.populate_quote_update_metadata_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_by := coalesce(NEW.updated_by, NEW.created_by);
  NEW.updated_at := coalesce(NEW.updated_at, NEW.created_at, statement_timestamp());
  RETURN NEW;
END;
$$;

CREATE TRIGGER quote_populate_update_metadata_before_insert
  BEFORE INSERT ON private.quotes
  FOR EACH ROW EXECUTE FUNCTION private.populate_quote_update_metadata_v1();

ALTER TABLE private.quotes DROP CONSTRAINT quotes_state_chk;
ALTER TABLE private.quotes ADD CONSTRAINT quotes_state_chk CHECK (
  (status = 'draft' AND version >= 1 AND linked_order_id IS NULL AND converted_at IS NULL)
  OR (status = 'converted' AND version >= 2 AND linked_order_id IS NOT NULL AND converted_at IS NOT NULL)
);

ALTER TABLE private.quote_positions ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE private.quote_positions DROP CONSTRAINT quote_positions_quote_position_key;
ALTER TABLE private.quote_positions
  ADD CONSTRAINT quote_positions_quote_revision_position_key UNIQUE (tenant_id, quote_id, revision, position),
  ADD CONSTRAINT quote_positions_revision_chk CHECK (revision >= 1);

ALTER TABLE private.quote_conversion_requests DROP CONSTRAINT quote_conversion_requests_version_chk;
ALTER TABLE private.quote_conversion_requests
  ADD CONSTRAINT quote_conversion_requests_version_chk CHECK (expected_version >= 1);

-- The original lifecycle fixed a conversion receipt at version 2. A draft
-- may now be revised before its award, so the immutable receipt records the
-- resulting aggregate version without imposing that obsolete fixed value.
ALTER TABLE private.quote_conversion_receipts
  DROP CONSTRAINT quote_conversion_receipts_version_chk;
ALTER TABLE private.quote_conversion_receipts
  ADD CONSTRAINT quote_conversion_receipts_version_chk CHECK (quote_version >= 2);

-- Quote events retain their append-only shape, but award and update events
-- carry the aggregate's actual revision. The original fixed 1 -> 2 check
-- would otherwise reject a valid award after a resumed draft edit.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_quote_v1_contract_chk;
ALTER TABLE public.events
  ADD CONSTRAINT events_quote_v1_contract_chk
  CHECK (
    event_type NOT IN ('QUOTE_CREATED_V1', 'QUOTE_UPDATED_V1', 'QUOTE_AWARDED_V1')
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND (
        (event_type = 'QUOTE_CREATED_V1' AND aggregate_version = 1)
        OR (event_type IN ('QUOTE_UPDATED_V1', 'QUOTE_AWARDED_V1') AND aggregate_version >= 2)
      )
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
        WHEN 'QUOTE_UPDATED_V1' THEN jsonb_build_object(
          'quoteId', payload->>'quoteId',
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

CREATE TABLE private.quote_update_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  tenant_id text NOT NULL,
  quote_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  client_event_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  intent_sha256 text NOT NULL,
  expected_version integer NOT NULL,
  aggregate_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT quote_update_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT quote_update_receipts_event_key UNIQUE (event_id),
  CONSTRAINT quote_update_receipts_client_key UNIQUE (tenant_id, actor_id, client_event_id),
  CONSTRAINT quote_update_receipts_quote_fkey FOREIGN KEY (tenant_id, quote_id) REFERENCES private.quotes (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT quote_update_receipts_actor_fkey FOREIGN KEY (actor_id) REFERENCES public.app_users (id) ON DELETE RESTRICT,
  CONSTRAINT quote_update_receipts_event_fkey FOREIGN KEY (event_id) REFERENCES public.events (id) ON DELETE RESTRICT,
  CONSTRAINT quote_update_receipts_intent_chk CHECK (intent_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT quote_update_receipts_versions_chk CHECK (expected_version >= 1 AND aggregate_version = expected_version + 1)
);

CREATE FUNCTION private.update_quote_v1(
  p_tenant_id text,
  p_actor_id uuid,
  p_client_event_id uuid,
  p_quote_id uuid,
  p_expected_version integer,
  p_intent_sha256 text,
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
  v_prior private.quote_update_receipts%ROWTYPE;
  v_quote private.quotes%ROWTYPE;
  v_next_version integer;
  v_total bigint;
  v_event_id text := gen_random_uuid()::text;
  v_receipt_id uuid := gen_random_uuid();
  v_correlation_id uuid := gen_random_uuid();
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
     OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_quote_id IS NULL
     OR p_expected_version IS NULL OR p_expected_version < 1
     OR p_intent_sha256 !~ '^[0-9a-f]{64}$'
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('path1:quote-update:' || p_tenant_id || ':' || p_quote_id::text, 0));
  SELECT * INTO v_prior FROM private.quote_update_receipts
   WHERE tenant_id = p_tenant_id AND actor_id = p_actor_id AND client_event_id = p_client_event_id;
  IF FOUND THEN
    IF v_prior.quote_id IS DISTINCT FROM p_quote_id OR v_prior.intent_sha256 IS DISTINCT FROM p_intent_sha256
       OR v_prior.expected_version IS DISTINCT FROM p_expected_version
    THEN RETURN QUERY SELECT 'CONFLICT', NULL::uuid, false;
    ELSE RETURN QUERY SELECT 'OK', v_prior.quote_id, true;
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id = p_actor_id AND tenant_id = p_tenant_id AND active IS TRUE)
     OR p_due_date IS NULL
     OR (p_note IS NOT NULL AND (p_note IS DISTINCT FROM btrim(p_note) OR length(p_note) NOT BETWEEN 1 AND 2000))
     OR jsonb_typeof(p_positions) <> 'array' OR jsonb_array_length(p_positions) NOT BETWEEN 1 AND 20
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_positions) WITH ORDINALITY AS entry(value, ordinal)
       WHERE jsonb_typeof(value) <> 'object'
          OR (SELECT count(*) FROM jsonb_object_keys(value)) <> 5
          OR NOT value ?& ARRAY['name','quantity','material','surfaceRequested','unitPriceCents']
          OR value->>'name' IS DISTINCT FROM btrim(value->>'name') OR length(value->>'name') NOT BETWEEN 2 AND 160
          OR coalesce(value->>'quantity','') !~ '^[1-9][0-9]{0,6}$' OR (value->>'quantity')::integer NOT BETWEEN 1 AND 1000000
          OR NOT (value->'material' = 'null'::jsonb OR (jsonb_typeof(value->'material') = 'string' AND value->>'material' = btrim(value->>'material') AND length(value->>'material') BETWEEN 1 AND 120))
          OR value->>'surfaceRequested' IS DISTINCT FROM btrim(value->>'surfaceRequested') OR length(value->>'surfaceRequested') NOT BETWEEN 2 AND 160
          OR coalesce(value->>'unitPriceCents','') !~ '^[0-9]{1,9}$'
     )
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN; END IF;

  SELECT * INTO v_quote FROM private.quotes WHERE tenant_id = p_tenant_id AND id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND', NULL::uuid, false; RETURN; END IF;
  IF v_quote.status <> 'draft' OR v_quote.version <> p_expected_version THEN
    RETURN QUERY SELECT 'CONFLICT', NULL::uuid, false; RETURN;
  END IF;

  SELECT sum((value->>'quantity')::bigint * (value->>'unitPriceCents')::bigint)
    INTO v_total FROM jsonb_array_elements(p_positions) entry(value);
  IF v_total IS NULL OR v_total NOT BETWEEN 0 AND 999999999999 THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN;
  END IF;
  v_next_version := p_expected_version + 1;

  INSERT INTO private.quote_positions (tenant_id, quote_id, revision, position, name, quantity, material, surface_requested, unit_price_cents)
  SELECT p_tenant_id, p_quote_id, v_next_version, ordinal::integer, value->>'name', (value->>'quantity')::integer,
    CASE WHEN value->'material' = 'null'::jsonb THEN NULL ELSE value->>'material' END,
    value->>'surfaceRequested', (value->>'unitPriceCents')::bigint
  FROM jsonb_array_elements(p_positions) WITH ORDINALITY AS entry(value, ordinal);

  UPDATE private.quotes SET due_date = p_due_date, note = p_note, total_net_cents = v_total,
    version = v_next_version, updated_by = p_actor_id, updated_at = statement_timestamp()
  WHERE tenant_id = p_tenant_id AND id = p_quote_id;

  INSERT INTO public.events (id, tenant_id, order_id, item_id, event_type, description, notes, payload,
    status, user_id, station, client_event_id, event_schema_version, correlation_id, aggregate_version, from_station, created_at)
  VALUES (v_event_id, p_tenant_id, NULL, NULL, 'QUOTE_UPDATED_V1', 'KV geändert', p_note,
    jsonb_build_object('quoteId', p_quote_id::text, 'intentSha256', p_intent_sha256), 'success', p_actor_id, NULL,
    p_client_event_id, 1, v_correlation_id, v_next_version, NULL, statement_timestamp() AT TIME ZONE 'UTC');
  INSERT INTO private.quote_update_receipts (id, event_id, tenant_id, quote_id, actor_id, client_event_id,
    correlation_id, intent_sha256, expected_version, aggregate_version)
  VALUES (v_receipt_id, v_event_id, p_tenant_id, p_quote_id, p_actor_id, p_client_event_id,
    v_correlation_id, p_intent_sha256, p_expected_version, v_next_version);
  RETURN QUERY SELECT 'OK', p_quote_id, false;
END;
$$;

CREATE OR REPLACE FUNCTION private.finalize_quote_conversion_from_order_event_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request private.quote_conversion_requests%ROWTYPE;
  v_quote private.quotes%ROWTYPE;
  v_converted_version integer;
BEGIN
  SELECT * INTO v_request FROM private.quote_conversion_requests
   WHERE tenant_id = NEW.tenant_id AND actor_id = NEW.user_id AND client_event_id = NEW.client_event_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.event_type <> 'ORDER_INTAKE_CREATED_V1' OR NEW.order_id IS NULL OR NEW.status <> 'success'
     OR NEW.station <> 'wareneingang' OR NEW.event_schema_version <> 1 OR NEW.aggregate_version <> 1
     OR NEW.payload IS DISTINCT FROM jsonb_build_object('intentSha256', v_request.order_intent_sha256)
  THEN RAISE EXCEPTION 'QUOTE_CONVERSION_ORDER_EVENT_MISMATCH'; END IF;
  SELECT * INTO v_quote FROM private.quotes WHERE tenant_id = NEW.tenant_id AND id = v_request.quote_id FOR UPDATE;
  IF NOT FOUND OR v_quote.status <> 'draft' OR v_quote.version <> v_request.expected_version
  THEN RAISE EXCEPTION 'QUOTE_CONVERSION_STATE_MISMATCH'; END IF;
  v_converted_version := v_request.expected_version + 1;
  -- A conversion is a new aggregate version as well. Preserve the last draft
  -- position set as a new immutable revision so canonical readback never
  -- falls back to an older state.
  INSERT INTO private.quote_positions (
    tenant_id, quote_id, revision, position, name, quantity, material, surface_requested, unit_price_cents
  )
  SELECT tenant_id, quote_id, v_converted_version, position, name, quantity, material, surface_requested, unit_price_cents
  FROM private.quote_positions
  WHERE tenant_id = NEW.tenant_id AND quote_id = v_request.quote_id AND revision = v_request.expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'QUOTE_CONVERSION_POSITIONS_MISSING'; END IF;
  UPDATE private.quotes SET status = 'converted', version = v_converted_version, linked_order_id = NEW.order_id,
    converted_at = statement_timestamp(), updated_by = NEW.user_id, updated_at = statement_timestamp()
  WHERE tenant_id = NEW.tenant_id AND id = v_request.quote_id;
  INSERT INTO public.events (id, tenant_id, order_id, item_id, event_type, description, notes, payload,
    status, user_id, station, client_event_id, event_schema_version, correlation_id, aggregate_version, from_station, created_at)
  VALUES (v_request.event_id, NEW.tenant_id, NULL, NULL, 'QUOTE_AWARDED_V1', 'KV beauftragt', NULL,
    jsonb_build_object('quoteId', v_request.quote_id::text, 'orderId', NEW.order_id, 'intentSha256', v_request.intent_sha256),
    'success', NEW.user_id, NULL, v_request.award_client_event_id, 1, v_request.correlation_id, v_converted_version, NULL,
    statement_timestamp() AT TIME ZONE 'UTC');
  INSERT INTO private.quote_conversion_receipts (id, event_id, tenant_id, quote_id, customer_id, order_id, order_intake_event_id,
    order_intent_sha256, actor_id, client_event_id, award_client_event_id, correlation_id, intent_sha256, quote_version)
  VALUES (v_request.receipt_id, v_request.event_id, NEW.tenant_id, v_request.quote_id, v_quote.customer_id,
    NEW.order_id, NEW.id, v_request.order_intent_sha256, NEW.user_id, NEW.client_event_id,
    v_request.award_client_event_id, v_request.correlation_id, v_request.intent_sha256, v_converted_version);
  RETURN NEW;
END;
$$;

-- Conversion reads exactly the aggregate revision that was locked by the
-- prepare command. Older append-only position revisions can never leak into
-- the F1.1 input.
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
    IF EXISTS (SELECT 1 FROM private.quote_conversion_requests WHERE tenant_id = p_tenant_id AND quote_id = p_quote_id) THEN
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
  IF (NOT v_replayed AND (v_quote.version <> v_request.expected_version OR v_quote.status <> 'draft'))
     OR (v_replayed AND (v_quote.status <> 'converted' OR v_quote.version <> v_request.expected_version + 1
       OR v_quote.linked_order_id IS NULL))
  THEN RETURN QUERY SELECT 'CONFLICT', NULL::jsonb, false; RETURN; END IF;
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

DROP VIEW private.v_quotes_v1;
CREATE VIEW private.v_quotes_v1 WITH (security_invoker = true) AS
SELECT quote.id AS quote_id, quote.tenant_id, quote.quote_number, quote.customer_id, customer.customer_number,
  coalesce(nullif(customer.company_name, ''), customer.name) AS customer_display_name, quote.status, quote.version,
  quote.currency, quote.due_date, quote.note, quote.total_net_cents, quote.linked_order_id, quote.created_by,
  creator.full_name AS actor_display_name, quote.created_at, quote.updated_at, quote.converted_at, positions.positions,
  (customer.id IS NOT NULL AND creator.id IS NOT NULL AND positions.position_count BETWEEN 1 AND 20
    AND positions.calculated_total = quote.total_net_cents
    AND ((quote.status = 'draft' AND quote.version >= 1 AND quote.linked_order_id IS NULL)
      OR (quote.status = 'converted' AND quote.version >= 2 AND quote.linked_order_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM private.quote_conversion_receipts receipt WHERE receipt.tenant_id = quote.tenant_id
          AND receipt.quote_id = quote.id AND receipt.order_id = quote.linked_order_id AND receipt.quote_version = quote.version)))) AS integrity_ok
FROM private.quotes quote
LEFT JOIN public.customers customer ON customer.tenant_id = quote.tenant_id AND customer.id = quote.customer_id
LEFT JOIN public.app_users creator ON creator.tenant_id = quote.tenant_id AND creator.id = quote.created_by
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS position_count, coalesce(sum(position.line_total_cents), 0)::bigint AS calculated_total,
    jsonb_agg(jsonb_build_object('id', position.id::text, 'position', position.position, 'name', position.name,
      'quantity', position.quantity, 'material', position.material, 'surfaceRequested', position.surface_requested,
      'unitPriceCents', position.unit_price_cents, 'lineTotalCents', position.line_total_cents) ORDER BY position.position) AS positions
  FROM private.quote_positions position
  WHERE position.tenant_id = quote.tenant_id AND position.quote_id = quote.id AND position.revision = quote.version
) positions ON true
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND quote.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_open_quotes_v1 WITH (security_invoker = true) AS
SELECT * FROM private.v_quotes_v1 WHERE status = 'draft';

CREATE VIEW private.v_quote_update_receipts_v1 WITH (security_invoker = true) AS
SELECT receipt.id AS receipt_id, receipt.event_id, receipt.tenant_id, receipt.quote_id, receipt.actor_id,
  receipt.client_event_id, receipt.correlation_id, receipt.intent_sha256, receipt.expected_version,
  receipt.aggregate_version, receipt.created_at AS recorded_at,
  (event.id IS NOT NULL AND quote.id IS NOT NULL AND event.event_type = 'QUOTE_UPDATED_V1'
    AND event.user_id = receipt.actor_id AND event.client_event_id = receipt.client_event_id
    AND event.correlation_id = receipt.correlation_id AND event.aggregate_version = receipt.aggregate_version
    AND event.payload = jsonb_build_object('quoteId', receipt.quote_id::text, 'intentSha256', receipt.intent_sha256)
    AND quote.version >= receipt.aggregate_version) AS integrity_ok
FROM private.quote_update_receipts receipt
LEFT JOIN public.events event ON event.tenant_id = receipt.tenant_id AND event.id = receipt.event_id
LEFT JOIN private.quotes quote ON quote.tenant_id = receipt.tenant_id AND quote.id = receipt.quote_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

DROP VIEW private.v_quote_conversion_receipts_v1;
CREATE VIEW private.v_quote_conversion_receipts_v1 WITH (security_invoker = true) AS
SELECT receipt.id AS receipt_id, receipt.event_id, receipt.tenant_id, receipt.quote_id,
  receipt.customer_id, receipt.order_id, receipt.order_intake_event_id, receipt.actor_id,
  receipt.client_event_id, receipt.award_client_event_id, receipt.correlation_id, receipt.intent_sha256,
  receipt.quote_version, receipt.created_at AS recorded_at,
  (event.id IS NOT NULL AND quote.id IS NOT NULL AND intake_event.id IS NOT NULL
    AND quote.status = 'converted' AND quote.version = receipt.quote_version
    AND quote.linked_order_id = receipt.order_id AND quote.customer_id = receipt.customer_id
    AND intake_event.order_id = receipt.order_id AND intake_event.user_id = receipt.actor_id
    AND intake_event.client_event_id = receipt.client_event_id
    AND intake_event.event_type = 'ORDER_INTAKE_CREATED_V1'
    AND intake_event.status = 'success' AND intake_event.station = 'wareneingang'
    AND intake_event.event_schema_version = 1 AND intake_event.aggregate_version = 1
    AND intake_event.payload = jsonb_build_object('intentSha256', receipt.order_intent_sha256)
    AND event.event_type = 'QUOTE_AWARDED_V1' AND event.user_id = receipt.actor_id
    AND event.client_event_id = receipt.award_client_event_id AND event.correlation_id = receipt.correlation_id
    AND event.aggregate_version = receipt.quote_version
    AND event.payload = jsonb_build_object('quoteId', receipt.quote_id::text,
      'orderId', receipt.order_id, 'intentSha256', receipt.intent_sha256)) AS integrity_ok
FROM private.quote_conversion_receipts receipt
LEFT JOIN public.events event ON event.tenant_id = receipt.tenant_id AND event.id = receipt.event_id
LEFT JOIN private.quotes quote ON quote.tenant_id = receipt.tenant_id AND quote.id = receipt.quote_id
LEFT JOIN public.events intake_event ON intake_event.tenant_id = receipt.tenant_id AND intake_event.id = receipt.order_intake_event_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE TRIGGER quote_update_receipts_update_immutable BEFORE UPDATE ON private.quote_update_receipts FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER quote_update_receipts_delete_immutable BEFORE DELETE ON private.quote_update_receipts FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

DROP TRIGGER quote_events_update_immutable ON public.events;
DROP TRIGGER quote_events_delete_immutable ON public.events;
CREATE TRIGGER quote_events_update_immutable BEFORE UPDATE ON public.events FOR EACH ROW
  WHEN (OLD.event_type IN ('QUOTE_CREATED_V1','QUOTE_UPDATED_V1','QUOTE_AWARDED_V1') OR NEW.event_type IN ('QUOTE_CREATED_V1','QUOTE_UPDATED_V1','QUOTE_AWARDED_V1'))
  EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER quote_events_delete_immutable BEFORE DELETE ON public.events FOR EACH ROW
  WHEN (OLD.event_type IN ('QUOTE_CREATED_V1','QUOTE_UPDATED_V1','QUOTE_AWARDED_V1'))
  EXECUTE FUNCTION public.prevent_audit_mutation();

REVOKE ALL ON TABLE private.quote_update_receipts, private.v_open_quotes_v1, private.v_quote_update_receipts_v1 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.update_quote_v1(text, uuid, uuid, uuid, integer, text, date, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.populate_quote_update_metadata_v1() FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_quotes_v1, private.v_open_quotes_v1, private.v_quote_update_receipts_v1,
  private.v_quote_conversion_receipts_v1 TO service_role;
GRANT EXECUTE ON FUNCTION private.update_quote_v1(text, uuid, uuid, uuid, integer, text, date, text, jsonb) TO service_role;
