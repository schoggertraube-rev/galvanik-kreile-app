-- S08 / PL schema13.11.03:25: one append-only customer credit ledger.
-- No new tenant/auth model: existing composite tenant/customer/actor/invoice keys.
CREATE TABLE public.customer_credit_entries (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  customer_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('storno_gutschrift','verrechnung','auszahlung')),
  amount_cents bigint NOT NULL,
  invoice_id uuid,
  payment_method text CHECK (payment_method IN ('bar','ueberweisung')),
  reference text,
  note text,
  actor_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL CHECK (length(idempotency_key)>0 AND btrim(idempotency_key)=idempotency_key),
  CONSTRAINT customer_credit_tenant_customer_fk FOREIGN KEY (tenant_id,customer_id)
    REFERENCES public.customers(tenant_id,id) ON DELETE RESTRICT,
  CONSTRAINT customer_credit_tenant_actor_fk FOREIGN KEY (tenant_id,actor_user_id)
    REFERENCES public.app_users(tenant_id,id) ON DELETE RESTRICT,
  CONSTRAINT customer_credit_tenant_invoice_fk FOREIGN KEY (tenant_id,invoice_id)
    REFERENCES public.invoices(tenant_id,id) ON DELETE RESTRICT,
  CONSTRAINT customer_credit_n5_unique UNIQUE (tenant_id,idempotency_key),
  CONSTRAINT customer_credit_direction CHECK (
    (kind='storno_gutschrift' AND amount_cents>0)
    OR (kind IN ('verrechnung','auszahlung') AND amount_cents<0)
  ),
  CONSTRAINT customer_credit_invoice_kind CHECK (
    (kind IN ('storno_gutschrift','verrechnung') AND invoice_id IS NOT NULL AND payment_method IS NULL)
    OR (kind='auszahlung' AND invoice_id IS NULL AND payment_method IS NOT NULL)
  ),
  CONSTRAINT customer_credit_transfer_reference CHECK (
    payment_method IS DISTINCT FROM 'ueberweisung' OR (reference IS NOT NULL AND length(btrim(reference))>0)
  )
);
CREATE INDEX customer_credit_customer_idx ON public.customer_credit_entries(tenant_id,customer_id,created_at,id);
CREATE UNIQUE INDEX customer_credit_cancellation_unique ON public.customer_credit_entries(tenant_id,invoice_id)
  WHERE kind='storno_gutschrift';
ALTER TABLE public.customer_credit_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_credit_entries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.customer_credit_entries TO service_role;

CREATE FUNCTION private.lock_customer_credit_v1(p_tenant text,p_customer text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('customer-credit:'||p_tenant||':'||p_customer,0))
$$;
REVOKE ALL ON FUNCTION private.lock_customer_credit_v1(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.lock_customer_credit_v1(text,text) TO service_role;

CREATE FUNCTION private.guard_customer_credit_append_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN
    RAISE EXCEPTION 'CUSTOMER_CREDIT_APPEND_ONLY' USING ERRCODE='23514';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'') THEN
    RAISE EXCEPTION 'CUSTOMER_CREDIT_TENANT_REQUIRED' USING ERRCODE='23514';
  END IF;
  PERFORM private.lock_customer_credit_v1(NEW.tenant_id,NEW.customer_id);
  IF NEW.amount_cents<0 AND NEW.amount_cents+coalesce((
    SELECT sum(entry.amount_cents) FROM public.customer_credit_entries entry
    WHERE entry.tenant_id=NEW.tenant_id AND entry.customer_id=NEW.customer_id
  ),0)<0 THEN
    RAISE EXCEPTION 'CUSTOMER_CREDIT_BALANCE_EXCEEDED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION private.guard_customer_credit_append_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER customer_credit_append_guard BEFORE INSERT OR UPDATE OR DELETE
  ON public.customer_credit_entries FOR EACH ROW EXECUTE FUNCTION private.guard_customer_credit_append_v1();
CREATE TRIGGER customer_credit_no_truncate BEFORE TRUNCATE
  ON public.customer_credit_entries FOR EACH STATEMENT EXECUTE FUNCTION private.guard_customer_credit_append_v1();

-- The existing cancellation/payment event remains the source, not an asserted ID.
-- Deferred for an atomic credit + existing payment-writer transaction.
CREATE FUNCTION private.guard_customer_credit_source_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.kind='storno_gutschrift' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices invoice
      JOIN private.v_invoice_receipt_v1 receipt ON receipt.tenant_id=invoice.tenant_id
        AND receipt.invoice_id=invoice.id AND receipt.event_type='INVOICE_CANCELLED_V1'
        AND receipt.event_id=invoice.cancel_event_id AND receipt.integrity_ok
      WHERE invoice.tenant_id=NEW.tenant_id AND invoice.id=NEW.invoice_id
        AND invoice.customer_id=NEW.customer_id AND invoice.status='cancelled'
        AND invoice.cancelled_by=NEW.actor_user_id
        AND invoice.cancel_client_event_id::text=NEW.idempotency_key
        AND invoice.payment_paid_amount_cents=NEW.amount_cents
    ) THEN RAISE EXCEPTION 'CUSTOMER_CREDIT_CANCELLATION_RECEIPT_REQUIRED' USING ERRCODE='23514'; END IF;
  ELSIF NEW.kind='verrechnung' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.events event JOIN public.invoices invoice
        ON invoice.tenant_id=event.tenant_id AND invoice.id::text=event.payload->>'invoiceId'
      WHERE event.tenant_id=NEW.tenant_id AND event.event_type='PAYMENT_CONFIRMED_V1'
        AND event.client_event_id::text=NEW.idempotency_key AND event.user_id=NEW.actor_user_id
        AND invoice.id=NEW.invoice_id AND invoice.customer_id=NEW.customer_id
        AND event.payload->>'method'='guthaben'
        AND event.payload->>'amountCents'=(-NEW.amount_cents)::text
    ) THEN RAISE EXCEPTION 'CUSTOMER_CREDIT_PAYMENT_RECEIPT_REQUIRED' USING ERRCODE='23514'; END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.events event
      WHERE event.tenant_id=NEW.tenant_id AND event.event_type='CUSTOMER_CREDIT_PAYOUT_V1'
        AND event.client_event_id::text=NEW.idempotency_key AND event.user_id=NEW.actor_user_id
        AND event.payload->>'creditEntryId'=NEW.id::text
        AND event.payload->>'customerId'=NEW.customer_id
        AND event.payload->>'amountCents'=(-NEW.amount_cents)::text
        AND event.payload->>'method'=NEW.payment_method
        AND event.payload->>'reference' IS NOT DISTINCT FROM NEW.reference
    ) THEN RAISE EXCEPTION 'CUSTOMER_CREDIT_PAYOUT_RECEIPT_REQUIRED' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION private.guard_customer_credit_source_v1() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER customer_credit_source_guard AFTER INSERT ON public.customer_credit_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.guard_customer_credit_source_v1();
