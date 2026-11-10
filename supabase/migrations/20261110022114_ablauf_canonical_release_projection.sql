-- The existing active-invoice reader must not join a cancelled invoice as its current payment.
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
WHERE invoice.status = 'issued' AND invoice.payment_contract_version = 1
  AND invoice.tenant_id = current_setting('app.tenant_id', true);

COMMENT ON VIEW private.v_payment_summary_v1 IS
  'U-254 payment truth: only Rechnung permits goods out before payment; cash/card at pickup requires recorded payment.';

-- AP-ABLAUF §8.1: derive readiness from existing immutable facts, not the
-- legacy orders.ausgabe_frei cache. No new stored business state or backfill.
CREATE OR REPLACE FUNCTION private.invoice_is_overdue_v1(
  p_status text,p_payment_status text,p_open_cents bigint,p_due date,p_today date
) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT coalesce(p_status='issued' AND p_payment_status IN ('offen','teilbezahlt')
   AND p_open_cents>0 AND p_due<p_today,false);
$fn$;
REVOKE ALL ON FUNCTION private.invoice_is_overdue_v1(text,text,bigint,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.invoice_is_overdue_v1(text,text,bigint,date,date) TO service_role;

CREATE OR REPLACE FUNCTION private.order_release_allowed_v1(
  p_tenant text,p_order text,
  p_customer_debt_released boolean DEFAULT false,
  p_payment_released boolean DEFAULT false
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT coalesce((
  SELECT state.integrity_ok IS TRUE
    AND state.goods_out_event_count=0
    AND orders.station='fertig' AND orders.current_station='fertig'
    AND orders.current_station_id='fertig' AND orders.status='fertig'
    AND EXISTS(SELECT 1 FROM private.v_order_freeze_state_v1 freeze_state
      WHERE freeze_state.tenant_id=orders.tenant_id AND freeze_state.order_id=orders.id
        AND freeze_state.active AND freeze_state.integrity_ok)
    AND (p_payment_released OR state.goods_out_allowed IS TRUE)
    AND NOT EXISTS(SELECT 1 FROM public.complaints complaint
      WHERE complaint.tenant_id=orders.tenant_id AND complaint.order_id=orders.id
        AND complaint.stand IS DISTINCT FROM 'abgeschlossen')
    AND (p_customer_debt_released OR NOT EXISTS(
      SELECT 1 FROM public.invoices invoice
      WHERE invoice.tenant_id=orders.tenant_id AND invoice.customer_id=orders.customer_id
        AND private.invoice_is_overdue_v1(invoice.status::text,invoice.payment_status::text,
          invoice.payment_open_amount_cents,invoice.due_date,
          (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date)))
  FROM public.orders orders
  JOIN private.v_goods_out_ui_state_v1 state
    ON state.tenant_id=orders.tenant_id AND state.order_id=orders.id
  WHERE orders.tenant_id=p_tenant AND orders.id=p_order
    AND p_tenant=nullif(btrim(current_setting('app.tenant_id',true)),'')
 ),false);
$fn$;
REVOKE ALL ON FUNCTION private.order_release_allowed_v1(text,text,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.order_release_allowed_v1(text,text,boolean,boolean) TO service_role;
COMMENT ON FUNCTION private.order_release_allowed_v1(text,text,boolean,boolean) IS
 'Live physical release decision. Overrides are only facts already authorized and validated by the existing goods-out command; readers use neither override.';

-- Preserve the legacy column for existing contracts; it is only a cache and
-- no longer independently calculates a payment rule.
CREATE OR REPLACE FUNCTION private.refresh_order_ausgabe_frei(p_tenant text,p_order text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$
 UPDATE public.orders SET ausgabe_frei=private.order_release_allowed_v1(p_tenant,p_order)
 WHERE tenant_id=p_tenant AND id=p_order
   AND ausgabe_frei IS DISTINCT FROM private.order_release_allowed_v1(p_tenant,p_order);
$fn$;

-- Same existing queue shape/security; only its release column now reads live facts.
CREATE OR REPLACE VIEW private.v_operational_station_queue_v1
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.tenant_id,
  o.version,
  o.order_number,
  o.customer_id,
  c.name AS customer_name,
  o.title,
  o.task,
  o.station,
  o.current_station,
  o.current_station_id,
  o.status,
  o.priority_computed AS risk,
  o.intake_date,
  o.due_date,
  o.created_at,
  (
    c.id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.items corrupt_item
      WHERE corrupt_item.order_id = o.id
        AND (
          corrupt_item.tenant_id IS DISTINCT FROM o.tenant_id
          OR corrupt_item.customer_id IS DISTINCT FROM o.customer_id
        )
    )
  ) AS tenant_integrity_ok,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'tenantId', i.tenant_id,
        'orderId', i.order_id,
        'customerId', i.customer_id,
        'name', i.name,
        'quantity', i.quantity,
        'currentStationId', i.current_station_id,
        'material', i.material,
        'surfaceRequested', i.surface_requested,
        'photoIds', i.photo_ids,
        'photo', i.photo,
        'repairTypes', i.repair_types,
        'stationSequence', i.station_sequence,
        'currentStep', i.current_step,
        'internalNotes', i.internal_notes,
        'catalogServiceId', i.catalog_service_id,
        'standardLeadTimeWorkingDays', catalog.standard_lead_time_working_days,
        'createdAt', i.created_at
      )
      ORDER BY i.created_at, i.id
    ) FILTER (WHERE i.id IS NOT NULL),
    '[]'::jsonb
  ) AS parts,
  private.order_release_allowed_v1(o.tenant_id,o.id) AS ausgabe_frei
FROM public.orders o
LEFT JOIN public.customers c
  ON c.id = o.customer_id
 AND c.tenant_id = o.tenant_id
LEFT JOIN public.items i
  ON i.order_id = o.id
 AND i.tenant_id = o.tenant_id
 AND i.customer_id = o.customer_id
LEFT JOIN public.catalog_services catalog
  ON catalog.id = i.catalog_service_id
 AND catalog.tenant_id = i.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND o.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND coalesce(o.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
  AND coalesce(o.order_number, '') NOT ILIKE 'A-SEED-%'
  AND coalesce(o.order_number, '') NOT ILIKE '%TEST%'
GROUP BY
  o.id,
  o.tenant_id,
  o.version,
  o.order_number,
  o.customer_id,
  c.id,
  c.name,
  o.title,
  o.task,
  o.station,
  o.current_station,
  o.current_station_id,
  o.status,
  o.priority_computed,
  o.intake_date,
  o.due_date,
  o.created_at;
