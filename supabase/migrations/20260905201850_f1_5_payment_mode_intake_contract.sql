-- F1.5-B2 / D-F15-002: payment mode is order truth from intake onward.
-- Payment amounts and status remain exclusively on public.invoices; no second
-- payment table or provider state is introduced here.

ALTER TABLE public.orders
  ADD COLUMN payment_mode text NOT NULL DEFAULT 'vorkasse',
  ADD COLUMN payment_mode_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_f15_payment_mode_chk
    CHECK (payment_mode IN ('vorkasse', 'abholung', 'rechnung')),
  ADD CONSTRAINT orders_f15_payment_mode_version_chk
    CHECK (payment_mode_version >= 0);

COMMENT ON COLUMN public.orders.payment_mode IS
  'D-F15-002 current payment mode; defaults to vorkasse at intake and changes only through setPaymentMode.';
COMMENT ON COLUMN public.orders.payment_mode_version IS
  'Independent optimistic version for audited payment-mode changes; unrelated to orders.version.';

CREATE FUNCTION private.guard_f1_5_order_payment_mode_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.payment_mode = 'vorkasse' AND NEW.payment_mode_version = 0 THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ORDER_PAYMENT_MODE_INTAKE_DEFAULT_REQUIRED' USING ERRCODE = '23514';
END;
$$;

CREATE FUNCTION private.guard_f1_5_order_payment_mode_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.payment_mode IS NOT DISTINCT FROM OLD.payment_mode
     AND NEW.payment_mode_version IS NOT DISTINCT FROM OLD.payment_mode_version THEN
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('app.payment_mode_command', true), '') = 'v1'
     AND NEW.payment_mode IN ('vorkasse', 'abholung', 'rechnung')
     AND NEW.payment_mode IS DISTINCT FROM OLD.payment_mode
     AND NEW.payment_mode_version = OLD.payment_mode_version + 1
     AND OLD.station IS DISTINCT FROM 'abgeholt'
     AND OLD.current_station IS DISTINCT FROM 'abgeholt'
     AND OLD.current_station_id IS DISTINCT FROM 'abgeholt'
     AND OLD.status IS DISTINCT FROM 'abgeholt'
     AND NOT EXISTS (
       SELECT 1
       FROM public.events event
       WHERE event.tenant_id = OLD.tenant_id
         AND event.order_id = OLD.id
         AND event.event_type = 'ORDER_PICKED_UP_V1'
     )
     AND (
       to_jsonb(NEW) - ARRAY['payment_mode', 'payment_mode_version']::text[]
     ) = (
       to_jsonb(OLD) - ARRAY['payment_mode', 'payment_mode_version']::text[]
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ORDER_PAYMENT_MODE_COMMAND_REQUIRED' USING ERRCODE = '23514';
END;
$$;

REVOKE ALL ON FUNCTION private.guard_f1_5_order_payment_mode_insert()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_f1_5_order_payment_mode_update()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER orders_f15_payment_mode_insert_guard
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.guard_f1_5_order_payment_mode_insert();

CREATE TRIGGER orders_f15_payment_mode_update_guard
  BEFORE UPDATE OF payment_mode, payment_mode_version ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.guard_f1_5_order_payment_mode_update();

ALTER TABLE public.events
  ADD CONSTRAINT events_payment_mode_set_v1_contract_chk
  CHECK (
    event_type <> 'PAYMENT_MODE_SET_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND correlation_id IS NOT NULL
      AND event_schema_version = 1
      AND aggregate_version > 0
      AND item_id IS NULL
      AND status = 'success'
      AND station IS NULL
      AND from_station IS NULL
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'orderId', payload->'orderId',
        'receiptId', payload->'receiptId',
        'previousPaymentMode', payload->'previousPaymentMode',
        'paymentMode', payload->'paymentMode',
        'expectedVersion', payload->'expectedVersion',
        'paymentModeVersion', payload->'paymentModeVersion',
        'occurredAt', payload->'occurredAt'
      )
      AND jsonb_typeof(payload->'orderId') = 'string'
      AND payload->>'orderId' = order_id
      AND jsonb_typeof(payload->'receiptId') = 'string'
      AND payload->>'receiptId' = 'payment-mode://' || order_id || '/' || aggregate_version::text
      AND payload->>'previousPaymentMode' IN ('vorkasse', 'abholung', 'rechnung')
      AND payload->>'paymentMode' IN ('vorkasse', 'abholung', 'rechnung')
      AND payload->>'paymentMode' <> payload->>'previousPaymentMode'
      AND jsonb_typeof(payload->'expectedVersion') = 'number'
      AND jsonb_typeof(payload->'paymentModeVersion') = 'number'
      AND (payload->>'expectedVersion') ~ '^[0-9]+$'
      AND (payload->>'paymentModeVersion') ~ '^[0-9]+$'
      AND (payload->>'expectedVersion')::numeric = aggregate_version - 1
      AND (payload->>'paymentModeVersion')::numeric = aggregate_version
      AND payload->>'occurredAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
    ), false)
  ) NOT VALID;

CREATE UNIQUE INDEX events_f15_payment_mode_order_version_uidx
  ON public.events (tenant_id, order_id, aggregate_version)
  WHERE event_type = 'PAYMENT_MODE_SET_V1';
CREATE UNIQUE INDEX events_f15_payment_mode_correlation_uidx
  ON public.events (tenant_id, correlation_id)
  WHERE event_type = 'PAYMENT_MODE_SET_V1';

CREATE TRIGGER events_f15_payment_mode_update_guard
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'PAYMENT_MODE_SET_V1' OR NEW.event_type = 'PAYMENT_MODE_SET_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_f15_payment_mode_delete_guard
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'PAYMENT_MODE_SET_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

-- F1.5 payment updates may never rewrite the immutable issuance-mode snapshot.
CREATE OR REPLACE FUNCTION private.guard_f1_4_invoice_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF OLD.contract_version IS DISTINCT FROM 1 THEN
    IF NEW.contract_version IS DISTINCT FROM OLD.contract_version THEN
      RAISE EXCEPTION 'INVOICE_LEGACY_UPGRADE_FORBIDDEN' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.contract_version = 1
     AND OLD.contract_version = 1
     AND OLD.payment_contract_version = 1
     AND NEW.payment_contract_version = 1
     AND NEW.payment_mode IS NOT DISTINCT FROM OLD.payment_mode
     AND coalesce(current_setting('app.payment_command', true), '') = 'v1'
     AND NEW.status = OLD.status
     AND NEW.aggregate_version = OLD.aggregate_version
     AND NEW.payment_version = OLD.payment_version + 1
     AND (
       to_jsonb(NEW) - ARRAY[
         'payment_contract_version', 'payment_mode', 'payment_status',
         'payment_open_amount_cents', 'payment_paid_amount_cents',
         'payment_currency', 'payment_method', 'payment_paid_at',
         'payment_receipt_id', 'payment_event_id', 'payment_correlation_id',
         'payment_version'
       ]::text[]
     ) = (
       to_jsonb(OLD) - ARRAY[
         'payment_contract_version', 'payment_mode', 'payment_status',
         'payment_open_amount_cents', 'payment_paid_amount_cents',
         'payment_currency', 'payment_method', 'payment_paid_at',
         'payment_receipt_id', 'payment_event_id', 'payment_correlation_id',
         'payment_version'
       ]::text[]
     ) THEN
    RETURN NEW;
  END IF;

  IF NEW.contract_version = 1
     AND OLD.status = 'issued'
     AND NEW.status = 'cancelled'
     AND coalesce(current_setting('app.invoice_cancel_command', true), '') = 'v1'
     AND NEW.aggregate_version = OLD.aggregate_version + 1
     AND (
       to_jsonb(NEW) - ARRAY[
         'status', 'aggregate_version', 'cancel_client_event_id',
         'cancel_correlation_id', 'cancelled_by', 'cancel_reason',
         'cancelled_at', 'cancel_event_id', 'cancellation_pdf_ref',
         'cancellation_pdf_sha256', 'cancellation_pdf_content'
       ]::text[]
     ) = (
       to_jsonb(OLD) - ARRAY[
         'status', 'aggregate_version', 'cancel_client_event_id',
         'cancel_correlation_id', 'cancelled_by', 'cancel_reason',
         'cancelled_at', 'cancel_event_id', 'cancellation_pdf_ref',
         'cancellation_pdf_sha256', 'cancellation_pdf_content'
       ]::text[]
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'INVOICE_IMMUTABLE' USING ERRCODE = '23514';
END;
$$;

-- The public invoice keeps its immutable issuance snapshot. The read port and
-- later goods-out gate consume the current order mode instead.
CREATE OR REPLACE VIEW private.v_payment_summary_v1
WITH (security_invoker = true)
AS
SELECT
  invoice.id AS invoice_id,
  invoice.tenant_id,
  invoice.order_id,
  orders.order_number,
  invoice.invoice_number,
  invoice.gross_amount_cents AS total_amount_cents,
  invoice.payment_contract_version,
  orders.payment_mode,
  invoice.payment_status,
  invoice.payment_open_amount_cents,
  invoice.payment_paid_amount_cents,
  invoice.payment_currency,
  invoice.payment_method,
  invoice.payment_paid_at,
  invoice.payment_receipt_id,
  invoice.payment_event_id,
  invoice.payment_correlation_id,
  invoice.payment_version,
  (
    orders.payment_mode = 'rechnung'
    OR invoice.payment_status = 'bezahlt'
  ) AS goods_out_allowed,
  coalesce(
    invoice.payment_contract_version = 1
    AND invoice.tenant_id = current_setting('app.tenant_id', true)
    AND orders.id IS NOT NULL
    AND orders.tenant_id = invoice.tenant_id
    AND orders.payment_mode IN ('vorkasse', 'abholung', 'rechnung')
    AND orders.payment_mode_version >= 0
    AND invoice.gross_amount_cents IS NOT NULL
    AND invoice.payment_mode IN ('vorkasse', 'abholung', 'rechnung')
    AND invoice.payment_status IN ('offen', 'teilbezahlt', 'bezahlt')
    AND invoice.payment_currency = 'EUR'
    AND invoice.payment_open_amount_cents >= 0
    AND invoice.payment_paid_amount_cents >= 0
    AND invoice.payment_paid_amount_cents + invoice.payment_open_amount_cents
          = invoice.gross_amount_cents
    AND invoice.payment_version >= 0
    AND (
      (
        invoice.payment_status = 'offen'
        AND invoice.payment_paid_amount_cents = 0
        AND invoice.payment_open_amount_cents = invoice.gross_amount_cents
        AND invoice.payment_version = 0
        AND invoice.payment_method IS NULL
        AND invoice.payment_paid_at IS NULL
        AND invoice.payment_receipt_id IS NULL
        AND invoice.payment_event_id IS NULL
        AND invoice.payment_correlation_id IS NULL
      )
      OR (
        invoice.payment_status IN ('teilbezahlt', 'bezahlt')
        AND invoice.payment_version > 0
        AND invoice.payment_method IN ('bar', 'ueberweisung', 'karte')
        AND invoice.payment_paid_at IS NOT NULL
        AND invoice.payment_receipt_id IS NOT NULL
        AND invoice.payment_event_id IS NOT NULL
        AND invoice.payment_correlation_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.events event
          WHERE event.event_type = 'PAYMENT_CONFIRMED_V1'
            AND event.id = invoice.payment_event_id
            AND event.tenant_id = invoice.tenant_id
            AND event.order_id = invoice.order_id
            AND event.payload->>'invoiceId' = invoice.id::text
            AND event.payload->>'receiptId' = invoice.payment_receipt_id
            AND event.payload->>'paymentMode' = invoice.payment_mode
            AND event.payload->>'paymentVersion' = invoice.payment_version::text
            AND event.payload->>'paidAmountCents' = invoice.payment_paid_amount_cents::text
            AND event.payload->>'openAmountCents' = invoice.payment_open_amount_cents::text
            AND event.payload->>'grossAmountCents' = invoice.gross_amount_cents::text
            AND event.payload->>'currency' = invoice.payment_currency
            AND event.correlation_id = invoice.payment_correlation_id
        )
      )
    )
  , false) AS integrity_ok,
  orders.payment_mode_version
FROM public.invoices invoice
JOIN public.orders orders
  ON orders.id = invoice.order_id
 AND orders.tenant_id = invoice.tenant_id
WHERE invoice.payment_contract_version = 1
  AND invoice.tenant_id = current_setting('app.tenant_id', true);

COMMENT ON VIEW private.v_payment_summary_v1 IS
  'F1.5 tenant-bound invoice payment truth with the current order payment mode and goods-out gate.';
REVOKE ALL ON TABLE private.v_payment_summary_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_payment_summary_v1 TO service_role;
