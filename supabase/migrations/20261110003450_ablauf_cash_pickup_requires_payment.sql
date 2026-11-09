-- U-254 / AP-ABLAUF H2: collecting at pickup is not a release before payment.
-- Preserve the existing tenant-bound security-invoker read port and every integrity check.
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
    AND invoice.payment_paid_amount_cents + invoice.payment_open_amount_cents = invoice.gross_amount_cents
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
          SELECT 1 FROM public.events event
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
JOIN public.orders orders ON orders.id = invoice.order_id AND orders.tenant_id = invoice.tenant_id
WHERE invoice.payment_contract_version = 1
  AND invoice.tenant_id = current_setting('app.tenant_id', true);

COMMENT ON VIEW private.v_payment_summary_v1 IS
  'U-254 payment truth: only Rechnung permits goods out before payment; cash/card at pickup requires recorded payment.';
