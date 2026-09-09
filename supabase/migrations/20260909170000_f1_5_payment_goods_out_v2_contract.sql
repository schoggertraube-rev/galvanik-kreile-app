-- F1.5-C additive V2 owner addendum: Rechnung goods-out before invoice issuance.
-- V1 remains untouched; V2 carries no derived payment status or amount.

ALTER TABLE public.events
  ADD CONSTRAINT events_order_picked_up_v2_contract_chk
  CHECK (
    event_type <> 'ORDER_PICKED_UP_V2'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND correlation_id IS NOT NULL
      AND event_schema_version = 2
      AND aggregate_version > 0
      AND status = 'success'
      AND from_station = 'fertig'
      AND station = 'abgeholt'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'orderId', payload->'orderId',
        'mode', payload->'mode',
        'orderVersion', payload->'orderVersion',
        'paymentMode', payload->'paymentMode',
        'invoiceState', payload->'invoiceState',
        'gateAllowed', payload->'gateAllowed'
      )
      AND jsonb_typeof(payload->'orderId') = 'string'
      AND payload->>'orderId' = order_id
      AND payload->>'mode' IN ('versand', 'abholung')
      AND payload->>'paymentMode' = 'rechnung'
      AND payload->>'invoiceState' = 'not_issued'
      AND jsonb_typeof(payload->'gateAllowed') = 'boolean'
      AND payload->>'gateAllowed' = 'true'
      AND jsonb_typeof(payload->'orderVersion') = 'number'
      AND (payload->>'orderVersion') ~ '^[0-9]+$'
      AND (payload->>'orderVersion')::numeric = aggregate_version
      AND (payload->>'orderVersion')::numeric > 0
    ), false)
  ) NOT VALID,
  ADD CONSTRAINT events_invoice_created_v2_contract_chk
  CHECK (
    event_type <> 'INVOICE_CREATED_V2'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND correlation_id IS NOT NULL
      AND event_schema_version = 2
      AND aggregate_version = 1
      AND from_station = 'abgeholt'
      AND station = 'abgeholt'
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'invoiceId', payload->'invoiceId',
        'freezeId', payload->'freezeId',
        'invoiceNumber', payload->'invoiceNumber',
        'orderVersion', payload->'orderVersion',
        'netAmountCents', payload->'netAmountCents',
        'vatRateBasisPoints', payload->'vatRateBasisPoints',
        'vatAmountCents', payload->'vatAmountCents',
        'grossAmountCents', payload->'grossAmountCents',
        'pdfSha256', payload->'pdfSha256',
        'invoiceVersion', payload->'invoiceVersion',
        'invoiceSourceState', payload->'invoiceSourceState'
      )
      AND coalesce(payload->>'invoiceId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(payload->>'freezeId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(payload->>'invoiceNumber', '') ~ '^R-[0-9]{4}-[0-9]{4,}$'
      AND coalesce(payload->>'pdfSha256', '') ~ '^[a-f0-9]{64}$'
      AND payload->>'invoiceSourceState' = 'after_goods_out'
      AND jsonb_typeof(payload->'netAmountCents') = 'number'
      AND jsonb_typeof(payload->'orderVersion') = 'number'
      AND jsonb_typeof(payload->'vatRateBasisPoints') = 'number'
      AND jsonb_typeof(payload->'vatAmountCents') = 'number'
      AND jsonb_typeof(payload->'grossAmountCents') = 'number'
      AND jsonb_typeof(payload->'invoiceVersion') = 'number'
      AND (payload->>'netAmountCents')::integer >= 0
      AND (payload->>'orderVersion')::numeric = trunc((payload->>'orderVersion')::numeric)
      AND (payload->>'orderVersion')::integer > 0
      AND (payload->>'vatRateBasisPoints')::integer IN (700, 1900)
      AND (payload->>'vatAmountCents')::integer = round(
        (payload->>'netAmountCents')::numeric * (payload->>'vatRateBasisPoints')::numeric / 10000
      )::integer
      AND (payload->>'grossAmountCents')::integer
        = (payload->>'netAmountCents')::integer + (payload->>'vatAmountCents')::integer
      AND (payload->>'invoiceVersion')::integer = 1
    ), false)
  ) NOT VALID;

CREATE FUNCTION private.validate_f15_v2_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  matching_goods_out_count integer;
BEGIN
  IF NEW.event_type NOT IN ('ORDER_PICKED_UP_V2', 'INVOICE_CREATED_V2') THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM public.orders orders
  WHERE orders.tenant_id = NEW.tenant_id
    AND orders.id = NEW.order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'F15_V2_ORDER_MISSING' USING ERRCODE = '23514';
  END IF;

  IF NEW.event_type = 'ORDER_PICKED_UP_V2' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.orders orders
      WHERE orders.tenant_id = NEW.tenant_id
        AND orders.id = NEW.order_id
        AND orders.payment_mode = 'rechnung'
        AND orders.version = NEW.aggregate_version
        AND orders.station = 'abgeholt'
        AND orders.current_station = 'abgeholt'
        AND orders.current_station_id = 'abgeholt'
        AND orders.status = 'abgeholt'
    ) OR EXISTS (
      SELECT 1
      FROM public.invoices invoice
      WHERE invoice.tenant_id = NEW.tenant_id
        AND invoice.order_id = NEW.order_id
        AND invoice.status = 'issued'
        AND invoice.issued_at <= NEW.created_at
    ) THEN
      RAISE EXCEPTION 'F15_GOODS_OUT_V2_SOURCE_INVALID' USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT count(*)::integer
    INTO matching_goods_out_count
    FROM public.events goods_out
    WHERE goods_out.tenant_id = NEW.tenant_id
      AND goods_out.order_id = NEW.order_id
      AND goods_out.event_type = 'ORDER_PICKED_UP_V2'
      AND goods_out.event_schema_version = 2
      AND goods_out.status = 'success'
      AND goods_out.from_station = 'fertig'
      AND goods_out.station = 'abgeholt'
      AND goods_out.aggregate_version = (NEW.payload->>'orderVersion')::integer
      AND goods_out.payload->>'orderId' = NEW.order_id
      AND goods_out.payload->>'paymentMode' = 'rechnung'
      AND goods_out.payload->>'invoiceState' = 'not_issued'
      AND goods_out.created_at <= NEW.created_at
      AND NOT EXISTS (
        SELECT 1
        FROM public.invoices prior_invoice
        WHERE prior_invoice.tenant_id = goods_out.tenant_id
          AND prior_invoice.order_id = goods_out.order_id
          AND prior_invoice.status = 'issued'
          AND prior_invoice.issued_at <= goods_out.created_at
      );
    IF matching_goods_out_count <> 1 THEN
      RAISE EXCEPTION 'F15_INVOICE_CREATED_V2_SOURCE_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_f15_v2_event_insert() FROM PUBLIC;

CREATE TRIGGER events_f15_v2_insert_guard
  BEFORE INSERT ON public.events
  FOR EACH ROW
  WHEN (NEW.event_type IN ('ORDER_PICKED_UP_V2', 'INVOICE_CREATED_V2'))
  EXECUTE FUNCTION private.validate_f15_v2_event_insert();

CREATE UNIQUE INDEX events_goods_out_client_event_v2_uidx
  ON public.events (tenant_id, client_event_id)
  WHERE event_type IN ('ORDER_PICKED_UP_V1', 'ORDER_PICKED_UP_V2');
CREATE UNIQUE INDEX events_goods_out_order_version_v2_uidx
  ON public.events (tenant_id, order_id, aggregate_version)
  WHERE event_type = 'ORDER_PICKED_UP_V2';
CREATE UNIQUE INDEX events_invoice_lifecycle_client_event_v2_uidx
  ON public.events (tenant_id, client_event_id)
  WHERE event_type IN ('INVOICE_CREATED_V1', 'INVOICE_CREATED_V2', 'INVOICE_CANCELLED_V1');
CREATE UNIQUE INDEX events_invoice_lifecycle_version_v2_uidx
  ON public.events (tenant_id, (payload->>'invoiceId'), aggregate_version)
  WHERE event_type IN ('INVOICE_CREATED_V1', 'INVOICE_CREATED_V2', 'INVOICE_CANCELLED_V1');

CREATE TRIGGER events_f15_v2_update_guard
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type IN ('ORDER_PICKED_UP_V2', 'INVOICE_CREATED_V2')
        OR NEW.event_type IN ('ORDER_PICKED_UP_V2', 'INVOICE_CREATED_V2'))
  EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_f15_v2_delete_guard
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type IN ('ORDER_PICKED_UP_V2', 'INVOICE_CREATED_V2'))
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE VIEW private.v_goods_out_receipt_v2
WITH (security_invoker = true)
AS
SELECT
  event.id AS event_id,
  event.tenant_id,
  event.order_id,
  event.client_event_id,
  event.correlation_id,
  event.aggregate_version AS order_version,
  event.user_id AS actor_id,
  to_char(event.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
  event.payload->>'mode' AS mode,
  event.payload->>'invoiceState' AS invoice_state,
  (
    actor.id IS NOT NULL
    AND orders.id IS NOT NULL
    AND orders.payment_mode = 'rechnung'
    AND orders.version = event.aggregate_version
    AND orders.station = 'abgeholt'
    AND orders.current_station = 'abgeholt'
    AND orders.current_station_id = 'abgeholt'
    AND orders.status = 'abgeholt'
    AND event.payload->>'orderId' = event.order_id
    AND event.payload->>'paymentMode' = orders.payment_mode
    AND event.payload->>'invoiceState' = 'not_issued'
    AND (event.payload->>'orderVersion')::integer = orders.version
    AND NOT EXISTS (
      SELECT 1
      FROM public.invoices invoice_at_goods_out
      WHERE invoice_at_goods_out.tenant_id = event.tenant_id
        AND invoice_at_goods_out.order_id = event.order_id
        AND invoice_at_goods_out.status = 'issued'
        AND invoice_at_goods_out.issued_at <= event.created_at
    )
  ) AS integrity_ok
FROM public.events event
JOIN public.app_users actor
  ON actor.id = event.user_id AND actor.tenant_id = event.tenant_id
JOIN public.orders orders
  ON orders.id = event.order_id AND orders.tenant_id = event.tenant_id
WHERE event.event_type = 'ORDER_PICKED_UP_V2'
  AND event.event_schema_version = 2
  AND event.status = 'success'
  AND nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND event.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_invoice_issue_source_v2
WITH (security_invoker = true)
AS
SELECT
  source.*,
  coalesce(eligibility.post_goods_out_invoice_eligible, false) AS post_goods_out_invoice_eligible,
  (
    source.integrity_ok
    OR coalesce(eligibility.post_goods_out_invoice_eligible, false)
  ) AS effective_integrity_ok
FROM private.v_invoice_issue_source_v1 source
LEFT JOIN LATERAL (
  SELECT
    count(*) = 1
    AND bool_and(receipt.integrity_ok)
    AND orders.payment_mode = 'rechnung'
    AND orders.station = 'abgeholt'
    AND orders.status = 'abgeholt'
    AND freeze_state.active = true
    AND freeze_state.integrity_ok = true
    AND source.seller_config_complete
    AND source.customer_config_complete
    AND source.base_prices_complete AS post_goods_out_invoice_eligible
  FROM public.orders orders
  JOIN private.v_order_freeze_state_v1 freeze_state
    ON freeze_state.tenant_id = orders.tenant_id
   AND freeze_state.order_id = orders.id
   AND freeze_state.freeze_id = source.freeze_id
  JOIN private.v_goods_out_receipt_v2 receipt
    ON receipt.tenant_id = orders.tenant_id
   AND receipt.order_id = orders.id
   AND receipt.order_version = orders.version
  WHERE orders.tenant_id = source.tenant_id
    AND orders.id = source.order_id
  GROUP BY orders.payment_mode, orders.station, orders.status,
    freeze_state.active, freeze_state.integrity_ok
) eligibility ON true;

CREATE VIEW private.v_invoice_created_receipt_v2
WITH (security_invoker = true)
AS
SELECT
  event.id AS event_id,
  event.tenant_id,
  event.order_id,
  event.event_type,
  event.client_event_id,
  event.correlation_id,
  event.event_schema_version,
  event.aggregate_version,
  event.user_id AS actor_id,
  to_char(event.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
  invoice.id AS invoice_id,
  invoice.invoice_number,
  invoice.order_version,
  (event.payload->>'orderVersion')::integer AS intent_expected_version,
  invoice.status AS current_status,
  invoice.aggregate_version AS current_version,
  invoice.net_amount_cents,
  invoice.vat_rate_basis_points,
  invoice.vat_amount_cents,
  invoice.gross_amount_cents,
  invoice.service_date,
  invoice.due_date,
  invoice.pdf_ref,
  invoice.pdf_sha256,
  invoice.cancel_reason,
  invoice.pdf_sha256 AS original_pdf_sha256,
  (
    actor.id IS NOT NULL
    AND event.order_id = invoice.order_id
    AND invoice.id::text = event.payload->>'invoiceId'
    AND invoice.invoice_number = event.payload->>'invoiceNumber'
    AND invoice.order_version = (invoice.snapshot->'order'->>'orderVersion')::integer
    AND invoice.order_id = invoice.snapshot->'order'->>'orderId'
    AND invoice.freeze_id::text = invoice.snapshot->'order'->>'freezeId'
    AND invoice.snapshot->>'serviceDate' = to_char(invoice.service_date, 'YYYY-MM-DD')
    AND invoice.snapshot->>'issuedAt'
      = to_char(invoice.issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    AND invoice.net_amount_cents = (invoice.snapshot->'totals'->>'netAmountCents')::integer
    AND invoice.vat_rate_basis_points = (invoice.snapshot->'totals'->>'vatRateBasisPoints')::integer
    AND invoice.vat_amount_cents = (invoice.snapshot->'totals'->>'vatAmountCents')::integer
    AND invoice.gross_amount_cents = (invoice.snapshot->'totals'->>'grossAmountCents')::integer
    AND invoice.issue_event_id = event.id
    AND invoice.client_event_id = event.client_event_id
    AND invoice.correlation_id = event.correlation_id
    AND invoice.issued_by = event.user_id
    AND invoice.issued_at = event.created_at AT TIME ZONE 'UTC'
    AND event.aggregate_version = 1
    AND (event.payload->>'orderVersion')::integer = invoice.order_version
    AND event.payload->>'invoiceSourceState' = 'after_goods_out'
    AND event.payload->>'pdfSha256' = invoice.pdf_sha256
    AND encode(sha256(invoice.pdf_content), 'hex') = invoice.pdf_sha256
    AND 1 = (
      SELECT count(*)::integer
      FROM public.events goods_out
      WHERE goods_out.tenant_id = event.tenant_id
        AND goods_out.order_id = event.order_id
        AND goods_out.event_type = 'ORDER_PICKED_UP_V2'
        AND goods_out.event_schema_version = 2
        AND goods_out.status = 'success'
        AND goods_out.from_station = 'fertig'
        AND goods_out.station = 'abgeholt'
        AND goods_out.aggregate_version = (event.payload->>'orderVersion')::integer
        AND goods_out.payload->>'orderId' = event.order_id
        AND goods_out.payload->>'paymentMode' = 'rechnung'
        AND goods_out.payload->>'invoiceState' = 'not_issued'
        AND goods_out.created_at <= event.created_at
        AND NOT EXISTS (
          SELECT 1
          FROM public.invoices prior_invoice
          WHERE prior_invoice.tenant_id = goods_out.tenant_id
            AND prior_invoice.order_id = goods_out.order_id
            AND prior_invoice.status = 'issued'
            AND prior_invoice.issued_at <= goods_out.created_at
        )
    )
  ) AS integrity_ok
FROM public.events event
JOIN public.invoices invoice
  ON invoice.tenant_id = event.tenant_id
 AND invoice.id::text = event.payload->>'invoiceId'
JOIN public.app_users actor
  ON actor.id = event.user_id AND actor.tenant_id = event.tenant_id
WHERE invoice.contract_version = 1
  AND event.event_type = 'INVOICE_CREATED_V2'
  AND event.status = 'success'
  AND nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND event.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_goods_out_receipt_v2 IS
  'F1.5-C tenant-bound invoice-not-issued goods-out receipt without invented payment values.';
COMMENT ON VIEW private.v_invoice_issue_source_v2 IS
  'F1.5-C additive invoice source: unchanged F1.4 fertig path or one strict Rechnung goods-out V2 receipt.';
COMMENT ON VIEW private.v_invoice_created_receipt_v2 IS
  'F1.5-C tenant-bound immutable invoice receipt after invoice-not-issued goods-out.';

REVOKE ALL ON TABLE private.v_goods_out_receipt_v2 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.v_invoice_issue_source_v2 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.v_invoice_created_receipt_v2 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_goods_out_receipt_v2 TO service_role;
GRANT SELECT ON TABLE private.v_invoice_issue_source_v2 TO service_role;
GRANT SELECT ON TABLE private.v_invoice_created_receipt_v2 TO service_role;
