-- S38a same immutable creation receipt: old V2 source unchanged; released native V3 uses the canonical handover reader.
CREATE OR REPLACE VIEW private.v_invoice_created_receipt_v2 WITH(security_invoker=true) AS
 SELECT event.id AS event_id,
    event.tenant_id,
    event.order_id,
    event.event_type,
    event.client_event_id,
    event.correlation_id,
    event.event_schema_version,
    event.aggregate_version,
    event.user_id AS actor_id,
    to_char(event.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) AS occurred_at,
    invoice.id AS invoice_id,
    invoice.invoice_number,
    invoice.order_version,
    (event.payload ->> 'orderVersion'::text)::integer AS intent_expected_version,
    invoice.status AS current_status,
    invoice.aggregate_version AS current_version,
    invoice.net_amount_cents,
    invoice.vat_rate_basis_points,
    invoice.vat_amount_cents,
    invoice.gross_amount_cents,
    invoice.service_date,
    invoice.due_date,
    invoice.pdf_ref,
    invoice.pdf_sha256,
    invoice.cancel_reason,
    invoice.pdf_sha256 AS original_pdf_sha256,
    actor.id IS NOT NULL AND event.order_id = invoice.order_id AND invoice.id::text = (event.payload ->> 'invoiceId'::text) AND invoice.invoice_number = (event.payload ->> 'invoiceNumber'::text) AND invoice.order_version = (((invoice.snapshot -> 'order'::text) ->> 'orderVersion'::text)::integer) AND invoice.order_id = ((invoice.snapshot -> 'order'::text) ->> 'orderId'::text) AND invoice.freeze_id::text = ((invoice.snapshot -> 'order'::text) ->> 'freezeId'::text) AND (invoice.snapshot ->> 'serviceDate'::text) = to_char(invoice.service_date::timestamp with time zone, 'YYYY-MM-DD'::text) AND (invoice.snapshot ->> 'issuedAt'::text) = to_char((invoice.issued_at AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) AND invoice.net_amount_cents = (((invoice.snapshot -> 'totals'::text) ->> 'netAmountCents'::text)::integer) AND private.invoice_original_vat_valid(invoice.snapshot, invoice.net_amount_cents::bigint, invoice.vat_rate_basis_points, invoice.vat_amount_cents::bigint, invoice.gross_amount_cents::bigint) AND invoice.vat_amount_cents = (((invoice.snapshot -> 'totals'::text) ->> 'vatAmountCents'::text)::integer) AND invoice.gross_amount_cents = (((invoice.snapshot -> 'totals'::text) ->> 'grossAmountCents'::text)::integer) AND invoice.issue_event_id = event.id AND invoice.client_event_id = event.client_event_id AND invoice.correlation_id = event.correlation_id AND invoice.issued_by = event.user_id AND invoice.issued_at = (event.created_at AT TIME ZONE 'UTC'::text) AND event.aggregate_version = 1 AND ((event.payload ->> 'orderVersion'::text)::integer) = invoice.order_version AND (event.payload ->> 'invoiceSourceState'::text) = 'after_goods_out'::text AND (event.payload ->> 'pdfSha256'::text) = invoice.pdf_sha256 AND encode(sha256(invoice.pdf_content), 'hex'::text) = invoice.pdf_sha256 AND 1 = (( SELECT count(*)::integer AS count
           FROM events goods_out
          WHERE goods_out.tenant_id::text = event.tenant_id::text AND goods_out.order_id = event.order_id AND (goods_out.event_type::text = 'ORDER_PICKED_UP_V2'::text AND goods_out.event_schema_version = 2 AND goods_out.status::text = 'success'::text AND goods_out.from_station = 'fertig'::text AND goods_out.station = 'abgeholt'::text AND goods_out.aggregate_version = ((event.payload ->> 'orderVersion'::text)::integer) AND (goods_out.payload ->> 'orderId'::text) = event.order_id AND (goods_out.payload ->> 'paymentMode'::text) = 'rechnung'::text AND (goods_out.payload ->> 'invoiceState'::text) = 'not_issued'::text AND goods_out.created_at <= event.created_at AND NOT (EXISTS ( SELECT 1
                   FROM invoices prior_invoice
                  WHERE prior_invoice.tenant_id = goods_out.tenant_id::text AND prior_invoice.order_id = goods_out.order_id AND prior_invoice.status = 'issued'::text AND prior_invoice.issued_at <= goods_out.created_at))
 OR (goods_out.event_type='ORDER_PICKED_UP_V3' AND goods_out.created_at<=event.created_at
 AND EXISTS(SELECT 1 FROM private.v_goods_out_receipt_v2 qualified
  WHERE qualified.tenant_id=event.tenant_id AND qualified.order_id=event.order_id
   AND qualified.event_id=goods_out.id AND qualified.integrity_ok
   AND qualified.order_version=(event.payload->>'orderVersion')::integer))))) AND ((event.event_type::text <> ALL (ARRAY['INVOICE_CREATED_V1'::text, 'INVOICE_CREATED_V2'::text])) OR (event.payload -> 'netAmountCents'::text) = ((invoice.snapshot -> 'totals'::text) -> 'netAmountCents'::text) AND (event.payload -> 'vatRateBasisPoints'::text) = ((invoice.snapshot -> 'totals'::text) -> 'vatRateBasisPoints'::text) AND (event.payload -> 'vatAmountCents'::text) = ((invoice.snapshot -> 'totals'::text) -> 'vatAmountCents'::text) AND (event.payload -> 'grossAmountCents'::text) = ((invoice.snapshot -> 'totals'::text) -> 'grossAmountCents'::text)) AS integrity_ok,
    invoice.snapshot
   FROM events event
     JOIN invoices invoice ON invoice.tenant_id = event.tenant_id::text AND invoice.id::text = (event.payload ->> 'invoiceId'::text)
     JOIN app_users actor ON actor.id = event.user_id AND actor.tenant_id = event.tenant_id::text
  WHERE invoice.contract_version = 1 AND event.event_type::text = 'INVOICE_CREATED_V2'::text AND event.status::text = 'success'::text AND NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND event.tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text);
