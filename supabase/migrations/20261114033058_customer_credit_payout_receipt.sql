-- S08b: same immutable event receipt as cancellation/payment; no new ledger.
-- The existing append-only audit guard also covers changing a different event
-- into this type. This migration never rewrites any applied migration or data.
CREATE TRIGGER events_customer_credit_payout_update_immutable
 BEFORE UPDATE ON public.events
 FOR EACH ROW
 WHEN (OLD.event_type='CUSTOMER_CREDIT_PAYOUT_V1' OR NEW.event_type='CUSTOMER_CREDIT_PAYOUT_V1')
 EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_customer_credit_payout_delete_immutable
 BEFORE DELETE ON public.events
 FOR EACH ROW
 WHEN (OLD.event_type='CUSTOMER_CREDIT_PAYOUT_V1')
 EXECUTE FUNCTION public.prevent_audit_mutation();
