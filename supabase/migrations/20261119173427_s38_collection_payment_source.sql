-- S38a / PL19.11.14:47: native collection identity in the existing payment contract.
-- Old monetary predicates, receipts, writer and immutable event kind stay unchanged.
CREATE OR REPLACE FUNCTION private.invoice_collection_payment_source_valid(tenant text,invoice_key text,collection_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path='' AS $function$
BEGIN
 IF tenant IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id',true)),'')
 OR NOT coalesce(invoice_key ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',false)
 OR NOT coalesce(collection_key ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',false) THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM public.invoices invoice WHERE invoice.tenant_id=tenant AND invoice.id=invoice_key::uuid
  AND invoice.order_id IS NULL AND invoice.contract_version=1 AND invoice.payment_contract_version=1 AND invoice.payment_mode='rechnung'
  AND invoice.snapshot#>>'{collection,collectionId}'=collection_key
  AND private.invoice_original_source_valid(invoice.tenant_id,invoice.customer_id,invoice.order_id,invoice.order_version,invoice.freeze_id,invoice.service_date,invoice.snapshot,invoice.issued_at));
END;
$function$;
REVOKE ALL ON FUNCTION private.invoice_collection_payment_source_valid(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.invoice_collection_payment_source_valid(text,text,text) TO service_role;

ALTER TABLE public.events DROP CONSTRAINT events_payment_confirmed_v1_contract_chk;
ALTER TABLE public.events ADD CONSTRAINT events_payment_confirmed_v1_contract_chk CHECK((event_type::text <> 'PAYMENT_CONFIRMED_V1'::text OR COALESCE(tenant_id IS NOT NULL AND (order_id IS NOT NULL OR (order_id IS NULL AND payload ? 'collectionId')) AND user_id IS NOT NULL AND client_event_id IS NOT NULL AND correlation_id IS NOT NULL AND event_schema_version = 1 AND aggregate_version > 0 AND item_id IS NULL AND status::text = 'success'::text AND station IS NULL AND from_station IS NULL AND jsonb_typeof(payload) = 'object'::text AND payload = (jsonb_build_object('invoiceId', payload -> 'invoiceId'::text, 'orderId', payload -> 'orderId'::text, 'receiptId', payload -> 'receiptId'::text, 'amountCents', payload -> 'amountCents'::text, 'grossAmountCents', payload -> 'grossAmountCents'::text, 'paidAmountCents', payload -> 'paidAmountCents'::text, 'openAmountCents', payload -> 'openAmountCents'::text, 'currency', payload -> 'currency'::text, 'paymentMode', payload -> 'paymentMode'::text, 'paymentStatus', payload -> 'paymentStatus'::text, 'method', payload -> 'method'::text, 'occurredAt', payload -> 'occurredAt'::text, 'paymentVersion', payload -> 'paymentVersion'::text, 'source', payload -> 'source'::text) ||
CASE
    WHEN (payload ->> 'method'::text) = 'guthaben'::text THEN jsonb_build_object('creditVersion', payload -> 'creditVersion'::text)
    ELSE '{}'::jsonb
END || CASE WHEN payload ? 'collectionId' THEN jsonb_build_object('collectionId',payload->'collectionId') ELSE '{}'::jsonb END) AND jsonb_typeof(payload -> 'invoiceId'::text) = 'string'::text AND (payload ->> 'invoiceId'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text AND ((jsonb_typeof(payload -> 'orderId'::text) = 'string'::text AND (payload ->> 'orderId'::text) = order_id) AND NOT(payload ? 'collectionId') OR (order_id IS NULL AND payload->'orderId'='null'::jsonb AND jsonb_typeof(payload->'collectionId')='string' AND payload->>'paymentMode'='rechnung' AND private.invoice_collection_payment_source_valid(tenant_id::text,payload->>'invoiceId',payload->>'collectionId'))) AND jsonb_typeof(payload -> 'receiptId'::text) = 'string'::text AND btrim(payload ->> 'receiptId'::text) = (payload ->> 'receiptId'::text) AND length(payload ->> 'receiptId'::text) >= 1 AND length(payload ->> 'receiptId'::text) <= 200 AND (payload ->> 'currency'::text) = 'EUR'::text AND ((payload ->> 'paymentMode'::text) = ANY (ARRAY['vorkasse'::text, 'abholung'::text, 'rechnung'::text])) AND ((payload ->> 'paymentStatus'::text) = ANY (ARRAY['teilbezahlt'::text, 'bezahlt'::text])) AND ((payload ->> 'method'::text) = ANY (ARRAY['bar'::text, 'ueberweisung'::text, 'karte'::text, 'guthaben'::text])) AND ((payload ->> 'source'::text) = ANY (ARRAY['manual'::text, 'bank'::text, 'mollie'::text])) AND (payload ->> 'occurredAt'::text) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'::text AND
CASE
    WHEN jsonb_typeof(payload -> 'amountCents'::text) = 'number'::text AND jsonb_typeof(payload -> 'grossAmountCents'::text) = 'number'::text AND jsonb_typeof(payload -> 'paidAmountCents'::text) = 'number'::text AND jsonb_typeof(payload -> 'openAmountCents'::text) = 'number'::text AND jsonb_typeof(payload -> 'paymentVersion'::text) = 'number'::text THEN
    CASE
        WHEN (payload ->> 'amountCents'::text) ~ '^[0-9]+$'::text AND (payload ->> 'grossAmountCents'::text) ~ '^[0-9]+$'::text AND (payload ->> 'paidAmountCents'::text) ~ '^[0-9]+$'::text AND (payload ->> 'openAmountCents'::text) ~ '^[0-9]+$'::text AND (payload ->> 'paymentVersion'::text) ~ '^[0-9]+$'::text THEN ((payload ->> 'amountCents'::text)::numeric) > 0::numeric AND ((payload ->> 'grossAmountCents'::text)::numeric) > 0::numeric AND ((payload ->> 'paidAmountCents'::text)::numeric) > 0::numeric AND ((payload ->> 'openAmountCents'::text)::numeric) >= 0::numeric AND ((payload ->> 'paymentVersion'::text)::numeric) = aggregate_version::numeric AND ((payload ->> 'amountCents'::text)::numeric) <= ((payload ->> 'paidAmountCents'::text)::numeric) AND (((payload ->> 'paidAmountCents'::text)::numeric) + ((payload ->> 'openAmountCents'::text)::numeric)) = ((payload ->> 'grossAmountCents'::text)::numeric) AND
        CASE
            WHEN (payload ->> 'paymentStatus'::text) = 'bezahlt'::text THEN ((payload ->> 'openAmountCents'::text)::numeric) = 0::numeric AND ((payload ->> 'paidAmountCents'::text)::numeric) = ((payload ->> 'grossAmountCents'::text)::numeric)
            ELSE ((payload ->> 'openAmountCents'::text)::numeric) > 0::numeric AND ((payload ->> 'paidAmountCents'::text)::numeric) < ((payload ->> 'grossAmountCents'::text)::numeric)
        END
        ELSE false
    END
    ELSE false
END, false)) AND (event_type::text <> 'PAYMENT_CONFIRMED_V1'::text OR (payload ->> 'method'::text) <> 'guthaben'::text OR COALESCE(jsonb_typeof(payload -> 'creditVersion'::text) = 'number'::text AND
CASE
    WHEN (payload ->> 'creditVersion'::text) ~ '^[0-9]+$'::text THEN ((payload ->> 'creditVersion'::text)::numeric) >= 0::numeric AND ((payload ->> 'creditVersion'::text)::numeric) <= 2147483647::numeric
    ELSE false
END, false))) NOT VALID;

CREATE OR REPLACE VIEW private.v_payment_summary_v1 WITH(security_invoker=true) AS
 SELECT invoice.id AS invoice_id,
    invoice.tenant_id,
    invoice.order_id,
    orders.order_number,
    invoice.invoice_number,
    invoice.gross_amount_cents AS total_amount_cents,
    invoice.payment_contract_version,
    CASE WHEN invoice.order_id IS NULL THEN invoice.payment_mode ELSE orders.payment_mode END AS payment_mode,
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
    (CASE WHEN invoice.order_id IS NULL THEN invoice.payment_mode ELSE orders.payment_mode END) = 'rechnung'::text OR invoice.payment_status = 'bezahlt'::text AS goods_out_allowed,
    COALESCE(invoice.payment_contract_version = 1 AND invoice.tenant_id = current_setting('app.tenant_id'::text, true) AND ((invoice.order_id IS NOT NULL AND orders.id IS NOT NULL AND orders.tenant_id::text = invoice.tenant_id AND (orders.payment_mode = ANY (ARRAY['vorkasse'::text, 'abholung'::text, 'rechnung'::text])) AND orders.payment_mode_version >= 0) OR (invoice.order_id IS NULL AND invoice.payment_mode='rechnung' AND private.invoice_collection_payment_source_valid(invoice.tenant_id,invoice.id::text,invoice.snapshot#>>'{collection,collectionId}'))) AND invoice.gross_amount_cents IS NOT NULL AND (invoice.payment_mode = ANY (ARRAY['vorkasse'::text, 'abholung'::text, 'rechnung'::text])) AND (invoice.payment_status = ANY (ARRAY['offen'::text, 'teilbezahlt'::text, 'bezahlt'::text])) AND invoice.payment_currency = 'EUR'::text AND invoice.payment_open_amount_cents >= 0 AND invoice.payment_paid_amount_cents >= 0 AND (invoice.payment_paid_amount_cents + invoice.payment_open_amount_cents) = invoice.gross_amount_cents AND invoice.payment_version >= 0 AND (invoice.payment_status = 'offen'::text AND invoice.payment_paid_amount_cents = 0 AND invoice.payment_open_amount_cents = invoice.gross_amount_cents AND invoice.payment_version = 0 AND invoice.payment_method IS NULL AND invoice.payment_paid_at IS NULL AND invoice.payment_receipt_id IS NULL AND invoice.payment_event_id IS NULL AND invoice.payment_correlation_id IS NULL OR (invoice.payment_status = ANY (ARRAY['teilbezahlt'::text, 'bezahlt'::text])) AND invoice.payment_version > 0 AND (invoice.payment_method = ANY (ARRAY['bar'::text, 'ueberweisung'::text, 'karte'::text, 'guthaben'::text])) AND (invoice.payment_method <> 'guthaben'::text OR private.customer_credit_payment_receipt_v1(invoice.tenant_id, invoice.id)) AND invoice.payment_paid_at IS NOT NULL AND invoice.payment_receipt_id IS NOT NULL AND invoice.payment_event_id IS NOT NULL AND invoice.payment_correlation_id IS NOT NULL AND (EXISTS ( SELECT 1
           FROM events event
          WHERE event.event_type::text = 'PAYMENT_CONFIRMED_V1'::text AND event.id = invoice.payment_event_id AND event.tenant_id::text = invoice.tenant_id AND event.order_id IS NOT DISTINCT FROM invoice.order_id AND ((invoice.order_id IS NOT NULL AND NOT(event.payload ? 'collectionId')) OR (invoice.order_id IS NULL AND event.payload->>'collectionId'=invoice.snapshot#>>'{collection,collectionId}')) AND (event.payload ->> 'invoiceId'::text) = invoice.id::text AND (event.payload ->> 'receiptId'::text) = invoice.payment_receipt_id AND (event.payload ->> 'paymentMode'::text) = invoice.payment_mode AND (event.payload ->> 'paymentVersion'::text) = invoice.payment_version::text AND (event.payload ->> 'paidAmountCents'::text) = invoice.payment_paid_amount_cents::text AND (event.payload ->> 'openAmountCents'::text) = invoice.payment_open_amount_cents::text AND (event.payload ->> 'grossAmountCents'::text) = invoice.gross_amount_cents::text AND (event.payload ->> 'currency'::text) = invoice.payment_currency AND event.correlation_id = invoice.payment_correlation_id))), false) AS integrity_ok,
    CASE WHEN invoice.order_id IS NULL THEN NULL::integer ELSE orders.payment_mode_version END AS payment_mode_version,
    CASE WHEN invoice.order_id IS NULL THEN invoice.snapshot->'collection' ELSE NULL::jsonb END AS collection_source
   FROM invoices invoice
     LEFT JOIN orders orders ON orders.id = invoice.order_id AND orders.tenant_id::text = invoice.tenant_id
  WHERE invoice.status = 'issued'::text AND invoice.payment_contract_version = 1 AND invoice.tenant_id = current_setting('app.tenant_id'::text, true);
