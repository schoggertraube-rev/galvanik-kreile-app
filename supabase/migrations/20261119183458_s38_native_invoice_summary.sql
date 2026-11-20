-- S38a: same authorized fiscal list, one row per native original; legacy branch byte-identical.
CREATE OR REPLACE VIEW private.v_invoice_summary_v1 WITH(security_invoker=true) AS
 SELECT invoice.id,
    invoice.tenant_id,
    invoice.order_id,
    invoice.customer_id,
    invoice.freeze_id,
    invoice.invoice_number,
    invoice.status,
    invoice.net_amount_cents,
    invoice.vat_rate_basis_points,
    invoice.vat_amount_cents,
    invoice.gross_amount_cents,
    invoice.service_date,
    invoice.order_version,
    invoice.due_date,
    invoice.payment_term_days,
    invoice.issued_at,
    invoice.aggregate_version,
    invoice.issued_by,
    invoice.pdf_ref,
    invoice.pdf_sha256,
    invoice.cancelled_by,
    invoice.cancel_reason,
    invoice.cancelled_at,
    invoice.cancellation_pdf_ref,
    invoice.cancellation_pdf_sha256,
    (invoice.snapshot -> 'order'::text) ->> 'orderNumber'::text AS order_number,
    COALESCE(NULLIF((invoice.snapshot -> 'customer'::text) ->> 'companyName'::text, ''::text), (invoice.snapshot -> 'customer'::text) ->> 'name'::text) AS customer_name,
    orders.id IS NOT NULL AND customer.id IS NOT NULL AND issuer.id IS NOT NULL AND invoice.gross_amount_cents = (invoice.net_amount_cents + invoice.vat_amount_cents) AND invoice.order_version = (((invoice.snapshot -> 'order'::text) ->> 'orderVersion'::text)::integer) AND invoice.order_id = ((invoice.snapshot -> 'order'::text) ->> 'orderId'::text) AND invoice.freeze_id::text = ((invoice.snapshot -> 'order'::text) ->> 'freezeId'::text) AND encode(sha256(invoice.pdf_content), 'hex'::text) = invoice.pdf_sha256 AND (invoice.status <> 'cancelled'::text OR canceller.id IS NOT NULL AND encode(sha256(invoice.cancellation_pdf_content), 'hex'::text) = invoice.cancellation_pdf_sha256) AND private.invoice_original_vat_valid(invoice.snapshot, invoice.net_amount_cents::bigint, invoice.vat_rate_basis_points, invoice.vat_amount_cents::bigint, invoice.gross_amount_cents::bigint) AS integrity_ok,
    invoice.snapshot
   FROM invoices invoice
     JOIN orders orders ON orders.id = invoice.order_id AND orders.tenant_id::text = invoice.tenant_id
     JOIN customers customer ON customer.id = invoice.customer_id AND customer.tenant_id::text = invoice.tenant_id
     JOIN app_users issuer ON issuer.id = invoice.issued_by AND issuer.tenant_id = invoice.tenant_id
     LEFT JOIN app_users canceller ON canceller.id = invoice.cancelled_by AND canceller.tenant_id = invoice.tenant_id
  WHERE invoice.contract_version = 1 AND NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND invoice.tenant_id = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text)
UNION ALL
 SELECT invoice.id,
    invoice.tenant_id,
    invoice.order_id,
    invoice.customer_id,
    invoice.freeze_id,
    invoice.invoice_number,
    invoice.status,
    invoice.net_amount_cents,
    invoice.vat_rate_basis_points,
    invoice.vat_amount_cents,
    invoice.gross_amount_cents,
    invoice.service_date,
    invoice.order_version,
    invoice.due_date,
    invoice.payment_term_days,
    invoice.issued_at,
    invoice.aggregate_version,
    invoice.issued_by,
    invoice.pdf_ref,
    invoice.pdf_sha256,
    invoice.cancelled_by,
    invoice.cancel_reason,
    invoice.cancelled_at,
    invoice.cancellation_pdf_ref,
    invoice.cancellation_pdf_sha256,
    (invoice.snapshot -> 'order'::text) ->> 'orderNumber'::text AS order_number,
    COALESCE(NULLIF((invoice.snapshot -> 'customer'::text) ->> 'companyName'::text, ''::text), (invoice.snapshot -> 'customer'::text) ->> 'name'::text) AS customer_name,
    invoice.order_id IS NULL AND customer.id IS NOT NULL AND issuer.id IS NOT NULL
    AND private.invoice_original_source_valid(invoice.tenant_id,invoice.customer_id,invoice.order_id,invoice.order_version,invoice.freeze_id,invoice.service_date,invoice.snapshot,invoice.issued_at)
    AND invoice.gross_amount_cents=invoice.net_amount_cents+invoice.vat_amount_cents
    AND encode(sha256(invoice.pdf_content),'hex')=invoice.pdf_sha256
    AND (invoice.status<>'cancelled' OR canceller.id IS NOT NULL AND encode(sha256(invoice.cancellation_pdf_content),'hex')=invoice.cancellation_pdf_sha256)
    AND private.invoice_original_vat_valid(invoice.snapshot,invoice.net_amount_cents::bigint,invoice.vat_rate_basis_points,invoice.vat_amount_cents::bigint,invoice.gross_amount_cents::bigint) AS integrity_ok,
    invoice.snapshot
   FROM invoices invoice
     JOIN customers customer ON customer.id = invoice.customer_id AND customer.tenant_id::text = invoice.tenant_id
     JOIN app_users issuer ON issuer.id = invoice.issued_by AND issuer.tenant_id = invoice.tenant_id
     LEFT JOIN app_users canceller ON canceller.id = invoice.cancelled_by AND canceller.tenant_id = invoice.tenant_id
  WHERE invoice.contract_version = 1 AND invoice.order_id IS NULL AND NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND invoice.tenant_id = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text);
