DROP VIEW private.v_quote_conversion_receipts_v1;

CREATE VIEW private.v_quote_conversion_receipts_v1 WITH (security_invoker = true) AS
SELECT receipt.id AS receipt_id, receipt.event_id, receipt.tenant_id, receipt.quote_id,
  receipt.customer_id, receipt.order_id, receipt.order_intake_event_id, receipt.actor_id,
  receipt.client_event_id, receipt.award_client_event_id, receipt.correlation_id, receipt.intent_sha256,
  receipt.quote_version, receipt.created_at AS recorded_at,
  (event.id IS NOT NULL AND quote.id IS NOT NULL AND intake_event.id IS NOT NULL AND order_row.id IS NOT NULL
    AND quote.status = 'converted' AND quote.version = receipt.quote_version
    AND quote.linked_order_id = receipt.order_id AND quote.customer_id = receipt.customer_id
    AND order_row.customer_id = receipt.customer_id
    AND intake_event.order_id = receipt.order_id AND intake_event.user_id = receipt.actor_id
    AND intake_event.client_event_id = receipt.client_event_id
    AND intake_event.event_type = 'ORDER_INTAKE_CREATED_V1'
    AND intake_event.status = 'success' AND intake_event.station = 'wareneingang'
    AND intake_event.event_schema_version = 1 AND intake_event.aggregate_version = 1
    AND intake_event.payload = jsonb_build_object(
      'intentSha256', receipt.order_intent_sha256,
      'handoverMode', order_row.handover_mode,
      'paymentMode', order_row.payment_mode
    )
    AND event.event_type = 'QUOTE_AWARDED_V1' AND event.user_id = receipt.actor_id
    AND event.client_event_id = receipt.award_client_event_id AND event.correlation_id = receipt.correlation_id
    AND event.aggregate_version = receipt.quote_version
    AND event.payload = jsonb_build_object('quoteId', receipt.quote_id::text,
      'orderId', receipt.order_id, 'intentSha256', receipt.intent_sha256)) AS integrity_ok
FROM private.quote_conversion_receipts receipt
LEFT JOIN public.events event ON event.tenant_id = receipt.tenant_id AND event.id = receipt.event_id
LEFT JOIN private.quotes quote ON quote.tenant_id = receipt.tenant_id AND quote.id = receipt.quote_id
LEFT JOIN public.orders order_row ON order_row.tenant_id = receipt.tenant_id AND order_row.id = receipt.order_id
LEFT JOIN public.events intake_event ON intake_event.tenant_id = receipt.tenant_id AND intake_event.id = receipt.order_intake_event_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_quote_conversion_receipts_v1
  IS 'Atomic quote-to-order receipt readback for the complete order-intake event contract.';

REVOKE ALL ON TABLE private.v_quote_conversion_receipts_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_quote_conversion_receipts_v1 TO service_role;
