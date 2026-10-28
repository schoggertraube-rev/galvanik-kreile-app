-- K23: store intake classification and quote validity as first-class fields.
-- Historic rows remain NULL because these choices cannot be inferred honestly.

ALTER TABLE public.orders
  ADD COLUMN intake_term_status text,
  ADD COLUMN intake_source text,
  ADD CONSTRAINT orders_intake_term_status_chk CHECK (
    intake_term_status IS NULL OR intake_term_status IN ('wunsch', 'bestaetigt', 'verschoben')
  ),
  ADD CONSTRAINT orders_intake_source_chk CHECK (
    intake_source IS NULL OR intake_source IN ('persoenlich', 'versand', 'abholung_firma', 'anfrage_mail', 'anfrage_telefon')
  );

ALTER TABLE private.order_intake_receipts
  ADD COLUMN intake_term_status text,
  ADD COLUMN intake_source text,
  ADD CONSTRAINT order_intake_receipts_term_status_chk CHECK (
    intake_term_status IS NULL OR intake_term_status IN ('wunsch', 'bestaetigt', 'verschoben')
  ),
  ADD CONSTRAINT order_intake_receipts_source_chk CHECK (
    intake_source IS NULL OR intake_source IN ('persoenlich', 'versand', 'abholung_firma', 'anfrage_mail', 'anfrage_telefon')
  );

ALTER TABLE private.quotes
  ADD COLUMN valid_until date,
  ADD COLUMN intake_term_status text,
  ADD COLUMN intake_source text,
  ADD CONSTRAINT quotes_intake_metadata_chk CHECK (
    (valid_until IS NULL AND intake_term_status IS NULL AND intake_source IS NULL)
    OR (
      valid_until IS NOT NULL
      AND intake_term_status IN ('wunsch', 'bestaetigt', 'verschoben')
      AND intake_source IN ('persoenlich', 'versand', 'abholung_firma', 'anfrage_mail', 'anfrage_telefon')
    )
  );

COMMENT ON COLUMN public.orders.intake_term_status IS 'Terminstatus selected at intake: wunsch, bestaetigt, or verschoben.';
COMMENT ON COLUMN public.orders.intake_source IS 'How the intake arrived; independent from technical source lineage.';
COMMENT ON COLUMN private.quotes.valid_until IS 'Date through which the quotation remains valid.';

CREATE OR REPLACE VIEW private.v_order_intake_receipts_v1
WITH (security_invoker = true) AS
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
    AND CASE
      WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(receipt.items_snapshot) item WHERE item ? 'catalogServiceId')
      THEN orders.promised_due_date::date = receipt.due_date
      ELSE orders.promised_due_date IS NULL AND orders.due_date::date = receipt.due_date
    END
    AND (receipt.intake_term_status IS NULL OR receipt.intake_term_status = orders.intake_term_status)
    AND (receipt.intake_source IS NULL OR receipt.intake_source = orders.intake_source)
    AND (
      NOT (event.payload ? 'handoverMode')
      OR (
        event.payload->>'handoverMode' = orders.handover_mode
        AND event.payload->>'paymentMode' = orders.payment_mode
      )
    )
    AND jsonb_typeof(receipt.items_snapshot) = 'array' AND jsonb_array_length(receipt.items_snapshot) BETWEEN 1 AND 20
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(receipt.items_snapshot) snapshot(item)
      LEFT JOIN public.items line ON line.id = snapshot.item->>'id' AND line.order_id = receipt.order_id
        AND line.tenant_id = receipt.tenant_id AND line.customer_id = receipt.customer_id
      LEFT JOIN public.catalog_services service ON service.id = CASE
        WHEN snapshot.item->>'catalogServiceId' IS NOT NULL THEN (snapshot.item->>'catalogServiceId')::uuid
        ELSE NULL
      END AND service.tenant_id = receipt.tenant_id
      WHERE line.id IS NULL
        OR line.name IS DISTINCT FROM snapshot.item->>'name'
        OR line.quantity IS DISTINCT FROM (snapshot.item->>'quantity')::integer
        OR line.material IS DISTINCT FROM nullif(snapshot.item->>'material', '')
        OR line.surface_requested IS DISTINCT FROM snapshot.item->>'surfaceRequested'
        OR line.execution_requested IS DISTINCT FROM coalesce(snapshot.item->>'executionRequested', 'offen')
        OR CASE
          WHEN snapshot.item->>'catalogServiceId' IS NOT NULL THEN
            service.id IS NULL
            OR line.catalog_service_id IS DISTINCT FROM service.id
            OR line.unit IS DISTINCT FROM snapshot.item->>'unit'
            OR round(line.preis_netto * 100)::integer IS DISTINCT FROM (snapshot.item->>'unitPriceCents')::integer
            OR line.vat_rate_basis_points IS DISTINCT FROM (snapshot.item->>'vatRateBasisPoints')::integer
          ELSE
            line.catalog_service_id IS NOT NULL
            OR line.unit IS NOT NULL
            OR line.vat_rate_basis_points IS NOT NULL
            OR NOT (
              line.preis_netto IS NULL
              OR EXISTS (
                SELECT 1
                FROM public.events price_event
                CROSS JOIN LATERAL jsonb_array_elements(price_event.payload->'prices') price(entry)
                JOIN public.app_users price_actor
                  ON price_actor.id = price_event.user_id AND price_actor.tenant_id = price_event.tenant_id
                WHERE price_event.tenant_id = receipt.tenant_id
                  AND price_event.order_id = receipt.order_id
                  AND price_event.event_type = 'ORDER_INVOICE_PRICES_SET_V1'
                  AND price_event.event_schema_version = 1
                  AND price_event.status = 'success'
                  AND price_event.aggregate_version <= orders.version
                  AND price_event.payload ? 'requestHash'
                  AND jsonb_typeof(price_event.payload->'prices') = 'array'
                  AND price.entry->>'itemId' = line.id
                  AND coalesce(price.entry->>'unitPriceCents', '') ~ '^[1-9][0-9]{0,8}$'
                  AND (price.entry->>'unitPriceCents')::integer = round(line.preis_netto * 100)::integer
              )
            )
        END
    )) AS integrity_ok,
  orders.handover_mode,
  orders.payment_mode,
  receipt.intake_term_status,
  receipt.intake_source
FROM private.order_intake_receipts receipt
LEFT JOIN public.events event ON event.id = receipt.event_id AND event.tenant_id = receipt.tenant_id
LEFT JOIN public.orders orders ON orders.id = receipt.order_id AND orders.tenant_id = receipt.tenant_id
LEFT JOIN public.customers customer ON customer.id = receipt.customer_id AND customer.tenant_id = receipt.tenant_id
LEFT JOIN public.app_users actor ON actor.id = receipt.actor_id AND actor.tenant_id = receipt.tenant_id
WHERE receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

DROP FUNCTION private.create_quote_v1(text, uuid, uuid, text, text, date, text, jsonb);

CREATE FUNCTION private.create_quote_v1(
  p_tenant_id text,
  p_actor_id uuid,
  p_client_event_id uuid,
  p_intent_sha256 text,
  p_customer_id text,
  p_due_date date,
  p_valid_until date,
  p_intake_term_status text,
  p_intake_source text,
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
     OR NOT (
       (p_valid_until IS NULL AND p_intake_term_status IS NULL AND p_intake_source IS NULL)
       OR (p_valid_until IS NOT NULL
         AND p_intake_term_status IN ('wunsch', 'bestaetigt', 'verschoben')
         AND p_intake_source IN ('persoenlich', 'versand', 'abholung_firma', 'anfrage_mail', 'anfrage_telefon'))
     )
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
    due_date, valid_until, intake_term_status, intake_source, note, total_net_cents, created_by
  ) VALUES (
    v_quote_id, p_tenant_id, v_quote_number, p_customer_id, 'draft', 1, 'EUR',
    p_due_date, p_valid_until, p_intake_term_status, p_intake_source, p_note, v_total, p_actor_id
  );
  INSERT INTO private.quote_positions (
    tenant_id, quote_id, revision, position, name, quantity, material, surface_requested, unit_price_cents
  )
  SELECT p_tenant_id, v_quote_id, 1, ordinal::integer, value->>'name', (value->>'quantity')::integer,
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

DROP VIEW private.v_open_quotes_v1;

CREATE OR REPLACE VIEW private.v_quotes_v1 WITH (security_invoker = true) AS
SELECT quote.id AS quote_id, quote.tenant_id, quote.quote_number, quote.customer_id, customer.customer_number,
  coalesce(nullif(customer.company_name, ''), customer.name) AS customer_display_name, quote.status, quote.version,
  quote.currency, quote.due_date, quote.note, quote.total_net_cents, quote.linked_order_id, quote.created_by,
  creator.full_name AS actor_display_name, quote.created_at, quote.updated_at, quote.converted_at, positions.positions,
  (customer.id IS NOT NULL AND creator.id IS NOT NULL AND positions.position_count BETWEEN 1 AND 20
    AND positions.calculated_total = quote.total_net_cents
    AND ((quote.valid_until IS NULL AND quote.intake_term_status IS NULL AND quote.intake_source IS NULL)
      OR (quote.valid_until IS NOT NULL
        AND quote.intake_term_status IN ('wunsch', 'bestaetigt', 'verschoben')
        AND quote.intake_source IN ('persoenlich', 'versand', 'abholung_firma', 'anfrage_mail', 'anfrage_telefon')))
    AND ((quote.status = 'draft' AND quote.version >= 1 AND quote.linked_order_id IS NULL)
      OR (quote.status = 'converted' AND quote.version >= 2 AND quote.linked_order_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM private.quote_conversion_receipts receipt WHERE receipt.tenant_id = quote.tenant_id
          AND receipt.quote_id = quote.id AND receipt.order_id = quote.linked_order_id AND receipt.quote_version = quote.version)))) AS integrity_ok,
  quote.valid_until,
  quote.intake_term_status,
  quote.intake_source
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

REVOKE ALL ON FUNCTION private.create_quote_v1(text, uuid, uuid, text, text, date, date, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.v_open_quotes_v1 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.create_quote_v1(text, uuid, uuid, text, text, date, date, text, text, text, jsonb)
  TO service_role;
GRANT SELECT ON TABLE private.v_quotes_v1, private.v_open_quotes_v1 TO service_role;
