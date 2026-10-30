-- A prepared quote conversion may have failed before the order event was
-- committed. Replaying the same immutable request must be able to finish that
-- order instead of stranding the draft behind its preparation record.
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
  IF NOT (
    (v_quote.status = 'draft' AND v_quote.version = v_request.expected_version AND v_quote.linked_order_id IS NULL)
    OR
    (v_replayed AND v_quote.status = 'converted' AND v_quote.version = v_request.expected_version + 1
      AND v_quote.linked_order_id IS NOT NULL)
  ) THEN RETURN QUERY SELECT 'CONFLICT', NULL::jsonb, false; RETURN; END IF;

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

COMMENT ON FUNCTION private.prepare_quote_conversion_v1(text, uuid, uuid, uuid, text, text, integer)
  IS 'Prepares or idempotently resumes one immutable quote-to-order conversion.';
