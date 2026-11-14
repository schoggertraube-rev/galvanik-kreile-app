-- S08: same payment aggregate and event writer; credit is not cash/bank income.
-- Existing manual-receipt projection intentionally keeps its three cash/bank methods.
CREATE FUNCTION private.customer_credit_payment_receipt_v1(p_tenant text,p_invoice uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $credit$
 SELECT EXISTS (
  SELECT 1 FROM public.invoices invoice
  JOIN public.events event ON event.tenant_id=invoice.tenant_id AND event.id=invoice.payment_event_id
  JOIN public.customer_credit_entries entry ON entry.tenant_id=invoice.tenant_id
   AND entry.invoice_id=invoice.id AND entry.idempotency_key=event.client_event_id::text
  WHERE invoice.tenant_id=p_tenant AND invoice.id=p_invoice
   AND invoice.payment_contract_version=1 AND invoice.payment_method='guthaben'
   AND event.event_type='PAYMENT_CONFIRMED_V1' AND event.status='success'
   AND entry.kind='verrechnung' AND entry.customer_id=invoice.customer_id
   AND entry.actor_user_id=event.user_id AND entry.amount_cents=-(event.payload->>'amountCents')::bigint
   AND event.payload->>'method'='guthaben' AND event.payload->>'invoiceId'=invoice.id::text
   AND invoice.payment_version=event.aggregate_version
   AND invoice.payment_paid_amount_cents=(event.payload->>'paidAmountCents')::bigint
   AND invoice.payment_open_amount_cents=(event.payload->>'openAmountCents')::bigint
   AND invoice.payment_receipt_id=event.payload->>'receiptId'
   AND invoice.payment_correlation_id=event.correlation_id
   AND invoice.payment_paid_at=(event.payload->>'occurredAt')::timestamptz
 );
$credit$;
REVOKE ALL ON FUNCTION private.customer_credit_payment_receipt_v1(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.customer_credit_payment_receipt_v1(text,uuid) TO service_role;

ALTER TABLE public.invoices DROP CONSTRAINT invoices_f15_method_chk;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_f15_method_chk
 CHECK (payment_method IS NULL OR payment_method IN ('bar','ueberweisung','karte','guthaben')) NOT VALID;
ALTER TABLE public.events DROP CONSTRAINT events_payment_confirmed_v1_contract_chk;
ALTER TABLE public.events ADD CONSTRAINT events_payment_confirmed_v1_contract_chk
 CHECK (((((event_type)::text <> 'PAYMENT_CONFIRMED_V1'::text) OR COALESCE(((tenant_id IS NOT NULL) AND (order_id IS NOT NULL) AND (user_id IS NOT NULL) AND (client_event_id IS NOT NULL) AND (correlation_id IS NOT NULL) AND (event_schema_version = 1) AND (aggregate_version > 0) AND (item_id IS NULL) AND ((status)::text = 'success'::text) AND (station IS NULL) AND (from_station IS NULL) AND (jsonb_typeof(payload) = 'object'::text) AND (payload = (jsonb_build_object('invoiceId', (payload -> 'invoiceId'::text), 'orderId', (payload -> 'orderId'::text), 'receiptId', (payload -> 'receiptId'::text), 'amountCents', (payload -> 'amountCents'::text), 'grossAmountCents', (payload -> 'grossAmountCents'::text), 'paidAmountCents', (payload -> 'paidAmountCents'::text), 'openAmountCents', (payload -> 'openAmountCents'::text), 'currency', (payload -> 'currency'::text), 'paymentMode', (payload -> 'paymentMode'::text), 'paymentStatus', (payload -> 'paymentStatus'::text), 'method', (payload -> 'method'::text), 'occurredAt', (payload -> 'occurredAt'::text), 'paymentVersion', (payload -> 'paymentVersion'::text), 'source', (payload -> 'source'::text)) || CASE WHEN payload->>'method'='guthaben' THEN jsonb_build_object('creditVersion',payload->'creditVersion') ELSE '{}'::jsonb END)) AND (jsonb_typeof((payload -> 'invoiceId'::text)) = 'string'::text) AND ((payload ->> 'invoiceId'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) AND (jsonb_typeof((payload -> 'orderId'::text)) = 'string'::text) AND ((payload ->> 'orderId'::text) = order_id) AND (jsonb_typeof((payload -> 'receiptId'::text)) = 'string'::text) AND (btrim((payload ->> 'receiptId'::text)) = (payload ->> 'receiptId'::text)) AND ((length((payload ->> 'receiptId'::text)) >= 1) AND (length((payload ->> 'receiptId'::text)) <= 200)) AND ((payload ->> 'currency'::text) = 'EUR'::text) AND ((payload ->> 'paymentMode'::text) = ANY (ARRAY['vorkasse'::text, 'abholung'::text, 'rechnung'::text])) AND ((payload ->> 'paymentStatus'::text) = ANY (ARRAY['teilbezahlt'::text, 'bezahlt'::text])) AND ((payload ->> 'method'::text) = ANY (ARRAY['bar'::text, 'ueberweisung'::text, 'karte'::text, 'guthaben'::text])) AND ((payload ->> 'source'::text) = ANY (ARRAY['manual'::text, 'bank'::text, 'mollie'::text])) AND ((payload ->> 'occurredAt'::text) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'::text) AND
CASE
    WHEN ((jsonb_typeof((payload -> 'amountCents'::text)) = 'number'::text) AND (jsonb_typeof((payload -> 'grossAmountCents'::text)) = 'number'::text) AND (jsonb_typeof((payload -> 'paidAmountCents'::text)) = 'number'::text) AND (jsonb_typeof((payload -> 'openAmountCents'::text)) = 'number'::text) AND (jsonb_typeof((payload -> 'paymentVersion'::text)) = 'number'::text)) THEN
    CASE
        WHEN (((payload ->> 'amountCents'::text) ~ '^[0-9]+$'::text) AND ((payload ->> 'grossAmountCents'::text) ~ '^[0-9]+$'::text) AND ((payload ->> 'paidAmountCents'::text) ~ '^[0-9]+$'::text) AND ((payload ->> 'openAmountCents'::text) ~ '^[0-9]+$'::text) AND ((payload ->> 'paymentVersion'::text) ~ '^[0-9]+$'::text)) THEN ((((payload ->> 'amountCents'::text))::numeric > (0)::numeric) AND (((payload ->> 'grossAmountCents'::text))::numeric > (0)::numeric) AND (((payload ->> 'paidAmountCents'::text))::numeric > (0)::numeric) AND (((payload ->> 'openAmountCents'::text))::numeric >= (0)::numeric) AND (((payload ->> 'paymentVersion'::text))::numeric = (aggregate_version)::numeric) AND (((payload ->> 'amountCents'::text))::numeric <= ((payload ->> 'paidAmountCents'::text))::numeric) AND ((((payload ->> 'paidAmountCents'::text))::numeric + ((payload ->> 'openAmountCents'::text))::numeric) = ((payload ->> 'grossAmountCents'::text))::numeric) AND
        CASE
            WHEN ((payload ->> 'paymentStatus'::text) = 'bezahlt'::text) THEN ((((payload ->> 'openAmountCents'::text))::numeric = (0)::numeric) AND (((payload ->> 'paidAmountCents'::text))::numeric = ((payload ->> 'grossAmountCents'::text))::numeric))
            ELSE ((((payload ->> 'openAmountCents'::text))::numeric > (0)::numeric) AND (((payload ->> 'paidAmountCents'::text))::numeric < ((payload ->> 'grossAmountCents'::text))::numeric))
        END)
        ELSE false
    END
    ELSE false
END), false))) AND (event_type<>'PAYMENT_CONFIRMED_V1' OR payload->>'method'<>'guthaben' OR coalesce(jsonb_typeof(payload->'creditVersion')='number' AND CASE WHEN payload->>'creditVersion' ~ '^[0-9]+$' THEN (payload->>'creditVersion')::numeric BETWEEN 0 AND 2147483647 ELSE false END,false))) NOT VALID;

CREATE OR REPLACE VIEW private.v_payment_summary_v1 WITH(security_invoker=true) AS
 SELECT invoice.id AS invoice_id,
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
    orders.payment_mode = 'rechnung'::text OR invoice.payment_status = 'bezahlt'::text AS goods_out_allowed,
    COALESCE(invoice.payment_contract_version = 1 AND invoice.tenant_id = current_setting('app.tenant_id'::text, true) AND orders.id IS NOT NULL AND orders.tenant_id::text = invoice.tenant_id AND (orders.payment_mode = ANY (ARRAY['vorkasse'::text, 'abholung'::text, 'rechnung'::text])) AND orders.payment_mode_version >= 0 AND invoice.gross_amount_cents IS NOT NULL AND (invoice.payment_mode = ANY (ARRAY['vorkasse'::text, 'abholung'::text, 'rechnung'::text])) AND (invoice.payment_status = ANY (ARRAY['offen'::text, 'teilbezahlt'::text, 'bezahlt'::text])) AND invoice.payment_currency = 'EUR'::text AND invoice.payment_open_amount_cents >= 0 AND invoice.payment_paid_amount_cents >= 0 AND (invoice.payment_paid_amount_cents + invoice.payment_open_amount_cents) = invoice.gross_amount_cents AND invoice.payment_version >= 0 AND (invoice.payment_status = 'offen'::text AND invoice.payment_paid_amount_cents = 0 AND invoice.payment_open_amount_cents = invoice.gross_amount_cents AND invoice.payment_version = 0 AND invoice.payment_method IS NULL AND invoice.payment_paid_at IS NULL AND invoice.payment_receipt_id IS NULL AND invoice.payment_event_id IS NULL AND invoice.payment_correlation_id IS NULL OR (invoice.payment_status = ANY (ARRAY['teilbezahlt'::text, 'bezahlt'::text])) AND invoice.payment_version > 0 AND (invoice.payment_method = ANY (ARRAY['bar'::text, 'ueberweisung'::text, 'karte'::text, 'guthaben'::text]) AND (invoice.payment_method<>'guthaben' OR private.customer_credit_payment_receipt_v1(invoice.tenant_id,invoice.id))) AND invoice.payment_paid_at IS NOT NULL AND invoice.payment_receipt_id IS NOT NULL AND invoice.payment_event_id IS NOT NULL AND invoice.payment_correlation_id IS NOT NULL AND (EXISTS ( SELECT 1
           FROM events event
          WHERE event.event_type::text = 'PAYMENT_CONFIRMED_V1'::text AND event.id = invoice.payment_event_id AND event.tenant_id::text = invoice.tenant_id AND event.order_id = invoice.order_id AND (event.payload ->> 'invoiceId'::text) = invoice.id::text AND (event.payload ->> 'receiptId'::text) = invoice.payment_receipt_id AND (event.payload ->> 'paymentMode'::text) = invoice.payment_mode AND (event.payload ->> 'paymentVersion'::text) = invoice.payment_version::text AND (event.payload ->> 'paidAmountCents'::text) = invoice.payment_paid_amount_cents::text AND (event.payload ->> 'openAmountCents'::text) = invoice.payment_open_amount_cents::text AND (event.payload ->> 'grossAmountCents'::text) = invoice.gross_amount_cents::text AND (event.payload ->> 'currency'::text) = invoice.payment_currency AND event.correlation_id = invoice.payment_correlation_id))), false) AS integrity_ok,
    orders.payment_mode_version
   FROM invoices invoice
     JOIN orders orders ON orders.id = invoice.order_id AND orders.tenant_id::text = invoice.tenant_id
  WHERE invoice.status = 'issued'::text AND invoice.payment_contract_version = 1 AND invoice.tenant_id = current_setting('app.tenant_id'::text, true);

CREATE OR REPLACE FUNCTION private.guard_customer_credit_source_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
        AND private.customer_credit_payment_receipt_v1(NEW.tenant_id,NEW.invoice_id)
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
$function$;


-- A credit payment cannot commit without its actual ledger debit. Both facts
-- may be inserted in either order inside the existing payment transaction.
CREATE FUNCTION private.guard_invoice_credit_receipt_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $invoice$
BEGIN
 IF NEW.payment_method='guthaben' AND NOT private.customer_credit_payment_receipt_v1(NEW.tenant_id,NEW.id) THEN
  RAISE EXCEPTION 'INVOICE_CUSTOMER_CREDIT_RECEIPT_REQUIRED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END
$invoice$;
REVOKE ALL ON FUNCTION private.guard_invoice_credit_receipt_v1() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER invoices_customer_credit_receipt_guard AFTER INSERT OR UPDATE ON public.invoices
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.guard_invoice_credit_receipt_v1();
