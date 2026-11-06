-- AP-EIN 4b: Nacharbeit ist ein bereits belegter Auftrag ohne Zahlungsschritt.
-- The existing release fact remains canonical; this only adds its established
-- complaint-backed branch to the same calculation.
CREATE OR REPLACE FUNCTION private.refresh_order_ausgabe_frei(p_tenant text,p_order text) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $fn$
DECLARE v_allowed boolean;
BEGIN
 SELECT orders.station::text='fertig' AND orders.status::text='fertig'
   AND EXISTS(SELECT 1 FROM private.v_order_freeze_state_v1 freeze_state
     WHERE freeze_state.tenant_id=p_tenant AND freeze_state.order_id=orders.id AND freeze_state.active AND freeze_state.integrity_ok)
   AND (
     orders.payment_mode='rechnung'
     OR (
       orders.payment_mode='keiner'
       AND EXISTS(
         SELECT 1 FROM public.complaints complaint
         WHERE complaint.tenant_id=orders.tenant_id
           AND complaint.id=orders.nacharbeit_zu
           AND complaint.stand='massnahme_nacharbeit'
           AND complaint.nacharbeit_auftrag_id=orders.id
       )
     )
     OR EXISTS(
       SELECT 1 FROM private.v_payment_summary_v1 payment
       WHERE payment.tenant_id=p_tenant
         AND payment.order_id=orders.id
         AND payment.integrity_ok
         AND payment.payment_status='bezahlt'
         AND payment.payment_open_amount_cents=0
     )
   )
 INTO v_allowed
 FROM public.orders orders
 WHERE orders.tenant_id=p_tenant AND orders.id=p_order;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.orders SET ausgabe_frei=v_allowed
 WHERE tenant_id=p_tenant AND id=p_order AND ausgabe_frei IS DISTINCT FROM v_allowed;
END; $fn$;
