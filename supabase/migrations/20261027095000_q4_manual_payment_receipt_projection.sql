-- Q4: public.invoices remains the payment aggregate truth. Each successful
-- manual confirmation additionally produces one immutable public.payments
-- receipt row for operational lists and the queue's SQL acceptance proof.

CREATE UNIQUE INDEX payments_manual_receipt_uidx
  ON public.payments (tenant_id, provider_reference)
  WHERE provider = 'manual' AND provider_reference IS NOT NULL;

CREATE FUNCTION private.project_manual_payment_receipt_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF NEW.payment_version = OLD.payment_version + 1
     AND NEW.payment_status IN ('teilbezahlt', 'bezahlt')
     AND NEW.payment_method IN ('bar', 'ueberweisung', 'karte')
     AND NEW.payment_paid_at IS NOT NULL
     AND NEW.payment_receipt_id IS NOT NULL
     AND NEW.payment_event_id IS NOT NULL
     AND NEW.payment_paid_amount_cents > OLD.payment_paid_amount_cents THEN
    INSERT INTO public.payments (
      tenant_id,
      invoice_id,
      order_id,
      provider,
      method,
      status,
      paid_at,
      provider_reference,
      amount_eur
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      NEW.order_id,
      'manual',
      NEW.payment_method,
      'confirmed',
      NEW.payment_paid_at,
      NEW.payment_receipt_id,
      (NEW.payment_paid_amount_cents - OLD.payment_paid_amount_cents)::numeric / 100
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoices_project_manual_payment_receipt_v1
  AFTER UPDATE OF payment_status, payment_paid_amount_cents, payment_method,
    payment_paid_at, payment_receipt_id, payment_event_id, payment_version
  ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION private.project_manual_payment_receipt_v1();

CREATE TRIGGER payments_manual_receipt_update_immutable
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  WHEN (OLD.provider = 'manual' OR NEW.provider = 'manual')
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER payments_manual_receipt_delete_immutable
  BEFORE DELETE ON public.payments
  FOR EACH ROW
  WHEN (OLD.provider = 'manual')
  EXECUTE FUNCTION public.prevent_audit_mutation();

COMMENT ON FUNCTION private.project_manual_payment_receipt_v1() IS
  'Q4 projection: mirrors each committed manual invoice payment into one immutable operational receipt; invoice payment columns remain aggregate truth.';
COMMENT ON INDEX public.payments_manual_receipt_uidx IS
  'Q4 idempotency boundary for manual payment receipt projections.';
