-- K5 / RA-08: debt stays visible; free rework is not collateral.
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
    AND (p_customer_debt_released OR orders.nacharbeit_zu IS NOT NULL
      OR orders.source='REKLAMATION_NACHARBEIT' OR NOT EXISTS(
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
