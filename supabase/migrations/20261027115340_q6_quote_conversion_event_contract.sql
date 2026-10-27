-- Q5 made handover and payment mode part of the immutable order-intake event.
-- Quote finalization must verify that complete event contract against the
-- persisted order instead of comparing it with the obsolete one-field payload.
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
  v_handover_mode text;
  v_payment_mode text;
BEGIN
  SELECT * INTO v_request FROM private.quote_conversion_requests
   WHERE tenant_id = NEW.tenant_id AND actor_id = NEW.user_id AND client_event_id = NEW.client_event_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.event_type <> 'ORDER_INTAKE_CREATED_V1' OR NEW.order_id IS NULL OR NEW.status <> 'success'
     OR NEW.station <> 'wareneingang' OR NEW.event_schema_version <> 1 OR NEW.aggregate_version <> 1
  THEN RAISE EXCEPTION 'QUOTE_CONVERSION_ORDER_EVENT_MISMATCH'; END IF;

  SELECT orders.handover_mode, orders.payment_mode
    INTO v_handover_mode, v_payment_mode
  FROM public.orders
  WHERE orders.tenant_id = NEW.tenant_id AND orders.id = NEW.order_id;
  IF NOT FOUND OR NEW.payload IS DISTINCT FROM jsonb_build_object(
    'intentSha256', v_request.order_intent_sha256,
    'handoverMode', v_handover_mode,
    'paymentMode', v_payment_mode
  ) THEN RAISE EXCEPTION 'QUOTE_CONVERSION_ORDER_EVENT_MISMATCH'; END IF;

  SELECT * INTO v_quote FROM private.quotes WHERE tenant_id = NEW.tenant_id AND id = v_request.quote_id FOR UPDATE;
  IF NOT FOUND OR v_quote.status <> 'draft' OR v_quote.version <> v_request.expected_version
  THEN RAISE EXCEPTION 'QUOTE_CONVERSION_STATE_MISMATCH'; END IF;
  v_converted_version := v_request.expected_version + 1;

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

COMMENT ON FUNCTION private.finalize_quote_conversion_from_order_event_v1()
  IS 'Finalizes quote conversion only from the complete persisted order-intake event contract.';
