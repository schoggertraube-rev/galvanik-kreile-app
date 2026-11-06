-- AP-EIN Teil 6b / P76: payment at pickup is released only after the
-- immutable order freeze has succeeded. Existing receipts remain unchanged.

CREATE OR REPLACE FUNCTION private.refresh_order_ausgabe_frei(p_tenant text, p_order text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  v_allowed boolean;
BEGIN
  SELECT
    orders.station::text = 'fertig'
    AND orders.status::text = 'fertig'
    AND EXISTS (
      SELECT 1
      FROM private.v_order_freeze_state_v1 freeze_state
      WHERE freeze_state.tenant_id = p_tenant
        AND freeze_state.order_id = orders.id
        AND freeze_state.active
        AND freeze_state.integrity_ok
    )
    AND (
      orders.payment_mode = 'abholung'
      OR orders.payment_mode = 'rechnung'
      OR EXISTS (
        SELECT 1
        FROM private.v_payment_summary_v1 payment
        WHERE payment.tenant_id = p_tenant
          AND payment.order_id = orders.id
          AND payment.integrity_ok
          AND payment.payment_status = 'bezahlt'
          AND payment.payment_open_amount_cents = 0
      )
    )
  INTO v_allowed
  FROM public.orders orders
  WHERE orders.tenant_id = p_tenant
    AND orders.id = p_order;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.orders
  SET ausgabe_frei = v_allowed
  WHERE tenant_id = p_tenant
    AND id = p_order
    AND ausgabe_frei IS DISTINCT FROM v_allowed;
END;
$fn$;

REVOKE ALL ON FUNCTION private.refresh_order_ausgabe_frei(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.refresh_order_ausgabe_frei(text, text) TO service_role;

-- Recalculate the derived release fact for frozen orders only. This never
-- rewrites an invoice, payment, event, or order lifecycle receipt.
DO $backfill$
DECLARE
  candidate record;
  previous_tenant text := current_setting('app.tenant_id', true);
BEGIN
  FOR candidate IN
    SELECT tenant_id, id
    FROM public.orders
    WHERE station::text = 'fertig'
  LOOP
    PERFORM set_config('app.tenant_id', candidate.tenant_id, true);
    PERFORM private.refresh_order_ausgabe_frei(candidate.tenant_id, candidate.id);
  END LOOP;
  PERFORM set_config('app.tenant_id', coalesce(previous_tenant, ''), true);
END;
$backfill$;
