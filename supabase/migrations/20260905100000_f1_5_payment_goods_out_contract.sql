-- F1.5-A: payment truth and goods-out gate contract.
-- public.invoices remains the single payment truth; public.payments and
-- public.zahlung are legacy/quarantine and are intentionally not referenced.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_contract_version integer,
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS payment_open_amount_cents integer,
  ADD COLUMN IF NOT EXISTS payment_paid_amount_cents integer,
  ADD COLUMN IF NOT EXISTS payment_currency text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_receipt_id text,
  ADD COLUMN IF NOT EXISTS payment_event_id text,
  ADD COLUMN IF NOT EXISTS payment_correlation_id uuid,
  ADD COLUMN IF NOT EXISTS payment_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_f15_contract_version_chk
    CHECK (payment_contract_version IS NULL OR payment_contract_version = 1) NOT VALID,
  ADD CONSTRAINT invoices_f15_mode_chk
    CHECK (payment_mode IS NULL OR payment_mode IN ('vorkasse', 'abholung', 'rechnung')) NOT VALID,
  ADD CONSTRAINT invoices_f15_status_chk
    CHECK (payment_status IS NULL OR payment_status IN ('offen', 'teilbezahlt', 'bezahlt')) NOT VALID,
  ADD CONSTRAINT invoices_f15_currency_chk
    CHECK (payment_currency IS NULL OR payment_currency = 'EUR') NOT VALID,
  ADD CONSTRAINT invoices_f15_method_chk
    CHECK (payment_method IS NULL OR payment_method IN ('bar', 'ueberweisung', 'karte')) NOT VALID,
  ADD CONSTRAINT invoices_f15_amounts_chk
    CHECK (
      payment_contract_version IS DISTINCT FROM 1
      OR coalesce((
        gross_amount_cents IS NOT NULL
        AND payment_mode IS NOT NULL
        AND payment_status IS NOT NULL
        AND payment_currency = 'EUR'
        AND payment_open_amount_cents >= 0
        AND payment_paid_amount_cents >= 0
        AND payment_paid_amount_cents + payment_open_amount_cents = gross_amount_cents
        AND payment_version >= 0
        AND (
          (
            payment_status = 'offen'
            AND payment_paid_amount_cents = 0
            AND payment_open_amount_cents = gross_amount_cents
            AND payment_version = 0
            AND payment_method IS NULL
            AND payment_paid_at IS NULL
            AND payment_receipt_id IS NULL
            AND payment_event_id IS NULL
            AND payment_correlation_id IS NULL
          )
          OR (
            payment_status = 'teilbezahlt'
            AND payment_paid_amount_cents > 0
            AND payment_open_amount_cents > 0
            AND payment_version > 0
            AND payment_method IN ('bar', 'ueberweisung', 'karte')
            AND payment_paid_at IS NOT NULL
            AND payment_receipt_id IS NOT NULL
            AND btrim(payment_receipt_id) = payment_receipt_id
            AND length(payment_receipt_id) BETWEEN 1 AND 200
            AND payment_event_id IS NOT NULL
            AND btrim(payment_event_id) = payment_event_id
            AND length(payment_event_id) BETWEEN 1 AND 128
            AND payment_correlation_id IS NOT NULL
          )
          OR (
            payment_status = 'bezahlt'
            AND payment_paid_amount_cents = gross_amount_cents
            AND payment_open_amount_cents = 0
            AND payment_version > 0
            AND payment_method IN ('bar', 'ueberweisung', 'karte')
            AND payment_paid_at IS NOT NULL
            AND payment_receipt_id IS NOT NULL
            AND btrim(payment_receipt_id) = payment_receipt_id
            AND length(payment_receipt_id) BETWEEN 1 AND 200
            AND payment_event_id IS NOT NULL
            AND btrim(payment_event_id) = payment_event_id
            AND length(payment_event_id) BETWEEN 1 AND 128
            AND payment_correlation_id IS NOT NULL
          )
        )
      ), false)
    ) NOT VALID;

COMMENT ON COLUMN public.invoices.payment_contract_version IS
  'F1.5 payment truth version; NULL is legacy/uninitialized, 1 is the additive payment contract.';
COMMENT ON COLUMN public.invoices.payment_mode IS
  'F1.5 payment mode: vorkasse, abholung or rechnung.';
COMMENT ON COLUMN public.invoices.payment_status IS
  'F1.5 payment status: offen, teilbezahlt or bezahlt.';
COMMENT ON COLUMN public.invoices.payment_open_amount_cents IS
  'F1.5 remaining amount in integer euro cents.';
COMMENT ON COLUMN public.invoices.payment_paid_amount_cents IS
  'F1.5 confirmed amount in integer euro cents.';

-- Preserve the F1.4 invoice cancellation contract while allowing only the
-- explicitly marked F1.5 payment transition to change payment fields.
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
     AND coalesce(current_setting('app.payment_command', true), '') = 'v1'
     AND NEW.status = OLD.status
     AND NEW.aggregate_version = OLD.aggregate_version
     AND (
       (OLD.payment_contract_version IS NULL AND NEW.payment_contract_version = 1)
       OR (
         OLD.payment_contract_version = 1
         AND NEW.payment_contract_version = 1
         AND NEW.payment_version = OLD.payment_version + 1
       )
     )
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

ALTER TABLE public.events
  ADD CONSTRAINT events_payment_confirmed_v1_contract_chk
  CHECK (
    event_type <> 'PAYMENT_CONFIRMED_V1'
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
        'invoiceId', payload->'invoiceId',
        'orderId', payload->'orderId',
        'receiptId', payload->'receiptId',
        'amountCents', payload->'amountCents',
        'grossAmountCents', payload->'grossAmountCents',
        'paidAmountCents', payload->'paidAmountCents',
        'openAmountCents', payload->'openAmountCents',
        'currency', payload->'currency',
        'paymentMode', payload->'paymentMode',
        'paymentStatus', payload->'paymentStatus',
        'method', payload->'method',
        'occurredAt', payload->'occurredAt',
        'paymentVersion', payload->'paymentVersion',
        'source', payload->'source'
      )
      AND jsonb_typeof(payload->'invoiceId') = 'string'
      AND (payload->>'invoiceId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND jsonb_typeof(payload->'orderId') = 'string'
      AND payload->>'orderId' = order_id
      AND jsonb_typeof(payload->'receiptId') = 'string'
      AND btrim(payload->>'receiptId') = payload->>'receiptId'
      AND length(payload->>'receiptId') BETWEEN 1 AND 200
      AND payload->>'currency' = 'EUR'
      AND payload->>'paymentMode' IN ('vorkasse', 'abholung', 'rechnung')
      AND payload->>'paymentStatus' IN ('teilbezahlt', 'bezahlt')
      AND payload->>'method' IN ('bar', 'ueberweisung', 'karte')
      AND payload->>'source' IN ('manual', 'bank', 'mollie')
      AND payload->>'occurredAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$'
      AND CASE
        WHEN jsonb_typeof(payload->'amountCents') = 'number'
         AND jsonb_typeof(payload->'grossAmountCents') = 'number'
         AND jsonb_typeof(payload->'paidAmountCents') = 'number'
         AND jsonb_typeof(payload->'openAmountCents') = 'number'
         AND jsonb_typeof(payload->'paymentVersion') = 'number'
        THEN CASE
          WHEN (payload->>'amountCents') ~ '^[0-9]+$'
           AND (payload->>'grossAmountCents') ~ '^[0-9]+$'
           AND (payload->>'paidAmountCents') ~ '^[0-9]+$'
           AND (payload->>'openAmountCents') ~ '^[0-9]+$'
           AND (payload->>'paymentVersion') ~ '^[0-9]+$'
          THEN (payload->>'amountCents')::numeric > 0
            AND (payload->>'grossAmountCents')::numeric > 0
            AND (payload->>'paidAmountCents')::numeric > 0
            AND (payload->>'openAmountCents')::numeric >= 0
            AND (payload->>'paymentVersion')::numeric = aggregate_version
            AND (payload->>'amountCents')::numeric <= (payload->>'paidAmountCents')::numeric
            AND (payload->>'paidAmountCents')::numeric + (payload->>'openAmountCents')::numeric
                  = (payload->>'grossAmountCents')::numeric
            AND CASE
              WHEN payload->>'paymentStatus' = 'bezahlt'
                THEN (payload->>'openAmountCents')::numeric = 0
                 AND (payload->>'paidAmountCents')::numeric = (payload->>'grossAmountCents')::numeric
              ELSE (payload->>'openAmountCents')::numeric > 0
               AND (payload->>'paidAmountCents')::numeric < (payload->>'grossAmountCents')::numeric
            END
          ELSE false
        END
        ELSE false
      END
    ), false)
  ) NOT VALID,
  ADD CONSTRAINT events_order_picked_up_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_PICKED_UP_V1'
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
      AND from_station = 'fertig'
      AND station = 'abgeholt'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'orderId', payload->'orderId',
        'mode', payload->'mode',
        'orderVersion', payload->'orderVersion',
        'paymentMode', payload->'paymentMode',
        'paymentStatus', payload->'paymentStatus',
        'openAmountCents', payload->'openAmountCents',
        'gateAllowed', payload->'gateAllowed'
      )
      AND jsonb_typeof(payload->'orderId') = 'string'
      AND payload->>'orderId' = order_id
      AND payload->>'mode' IN ('versand', 'abholung')
      AND payload->>'paymentMode' IN ('vorkasse', 'abholung', 'rechnung')
      AND payload->>'paymentStatus' IN ('offen', 'teilbezahlt', 'bezahlt')
      AND jsonb_typeof(payload->'gateAllowed') = 'boolean'
      AND payload->>'gateAllowed' = 'true'
      AND CASE
        WHEN jsonb_typeof(payload->'orderVersion') = 'number'
         AND jsonb_typeof(payload->'openAmountCents') = 'number'
        THEN CASE
          WHEN (payload->>'orderVersion') ~ '^[0-9]+$'
           AND (payload->>'openAmountCents') ~ '^[0-9]+$'
          THEN (payload->>'orderVersion')::numeric = aggregate_version
            AND (payload->>'orderVersion')::numeric > 0
            AND (payload->>'openAmountCents')::numeric >= 0
            AND CASE
              WHEN payload->>'paymentMode' = 'rechnung' THEN true
              ELSE payload->>'paymentStatus' = 'bezahlt'
                AND (payload->>'openAmountCents')::numeric = 0
            END
          ELSE false
        END
        ELSE false
      END
    ), false)
  ) NOT VALID;

CREATE UNIQUE INDEX events_f15_payment_receipt_uidx
  ON public.events (tenant_id, (payload->>'receiptId'))
  WHERE event_type = 'PAYMENT_CONFIRMED_V1';
CREATE UNIQUE INDEX events_f15_payment_invoice_version_uidx
  ON public.events (tenant_id, (payload->>'invoiceId'), aggregate_version)
  WHERE event_type = 'PAYMENT_CONFIRMED_V1';

CREATE TRIGGER events_f15_payment_update_guard
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type IN ('PAYMENT_CONFIRMED_V1', 'ORDER_PICKED_UP_V1')
        OR NEW.event_type IN ('PAYMENT_CONFIRMED_V1', 'ORDER_PICKED_UP_V1'))
  EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_f15_payment_delete_guard
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type IN ('PAYMENT_CONFIRMED_V1', 'ORDER_PICKED_UP_V1'))
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE VIEW private.v_payment_summary_v1
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
  invoice.payment_mode,
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
    invoice.payment_mode = 'rechnung'
    OR invoice.payment_status = 'bezahlt'
  ) AS goods_out_allowed,
  coalesce(
    invoice.payment_contract_version = 1
    AND invoice.tenant_id = current_setting('app.tenant_id', true)
    AND orders.id IS NOT NULL
    AND orders.tenant_id = invoice.tenant_id
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
            AND event.payload->>'paymentVersion' = invoice.payment_version::text
            AND event.payload->>'paidAmountCents' = invoice.payment_paid_amount_cents::text
            AND event.payload->>'openAmountCents' = invoice.payment_open_amount_cents::text
            AND event.payload->>'grossAmountCents' = invoice.gross_amount_cents::text
            AND event.payload->>'currency' = invoice.payment_currency
            AND event.correlation_id = invoice.payment_correlation_id
        )
      )
    )
  , false) AS integrity_ok
FROM public.invoices invoice
LEFT JOIN public.orders orders
  ON orders.id = invoice.order_id
 AND orders.tenant_id = invoice.tenant_id
WHERE invoice.payment_contract_version = 1
  AND invoice.tenant_id = current_setting('app.tenant_id', true);

COMMENT ON VIEW private.v_payment_summary_v1 IS
  'F1.5 tenant-bound payment status, open amount and goods-out gate; public.invoices is the only payment truth.';
REVOKE ALL ON TABLE private.v_payment_summary_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_payment_summary_v1 TO service_role;
