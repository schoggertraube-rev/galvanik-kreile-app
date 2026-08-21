-- F1.3 customer-card read contract. The orders cross-reference consumes the
-- existing tenant-bound operational order port; no parallel order truth.

CREATE VIEW private.v_customer_summary_v1
WITH (security_invoker = true)
AS
SELECT
  customer.id,
  customer.tenant_id,
  customer.customer_number,
  customer.name,
  customer.company_name,
  customer.type,
  customer.contact_person,
  customer.email,
  customer.phone,
  customer.street,
  customer.address,
  customer.zip_code,
  customer.city,
  customer.country,
  customer.classification,
  customer.internal_notes,
  customer.tags,
  customer.created_at,
  customer.updated_at,
  count(order_row.id)::integer AS order_count,
  count(order_row.id) FILTER (
    WHERE order_row.status IN ('angenommen', 'galvanik', 'fertig')
  )::integer AS ware_im_haus_count,
  count(order_row.id) FILTER (
    WHERE order_row.status IN ('angenommen', 'galvanik', 'fertig')
  ) > 0 AS ware_im_haus,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', order_row.id,
        'orderNumber', order_row.order_number,
        'title', order_row.title,
        'station', order_row.station,
        'status', order_row.status,
        'version', order_row.version,
        'dueAt', order_row.due_date
      )
      ORDER BY order_row.created_at DESC, order_row.id
    ) FILTER (WHERE order_row.id IS NOT NULL),
    '[]'::jsonb
  ) AS orders,
  (
    customer.id = btrim(customer.id)
    AND length(customer.id) BETWEEN 1 AND 128
    AND customer.name = btrim(customer.name)
    AND length(customer.name) BETWEEN 1 AND 200
    AND NOT EXISTS (
      SELECT 1
      FROM private.v_operational_station_queue_v1 corrupt_order
      WHERE corrupt_order.customer_id = customer.id
        AND corrupt_order.tenant_id IS DISTINCT FROM customer.tenant_id
    )
    AND coalesce(bool_and(order_row.tenant_integrity_ok), true)
  ) AS integrity_ok
FROM public.customers customer
LEFT JOIN private.v_operational_station_queue_v1 order_row
  ON order_row.customer_id = customer.id
 AND order_row.tenant_id = customer.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND customer.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND coalesce(customer.source, '') NOT IN ('seed', 'test', 'demo', 'integration-test')
  AND coalesce(customer.name, '') NOT LIKE 'Capture%'
GROUP BY
  customer.id,
  customer.tenant_id,
  customer.customer_number,
  customer.name,
  customer.company_name,
  customer.type,
  customer.contact_person,
  customer.email,
  customer.phone,
  customer.street,
  customer.address,
  customer.zip_code,
  customer.city,
  customer.country,
  customer.classification,
  customer.internal_notes,
  customer.tags,
  customer.created_at,
  customer.updated_at;

COMMENT ON VIEW private.v_customer_summary_v1 IS
  'F1.3 tenant-bound customer-card port with canonical operational order cross-reference and Ware-im-Haus signal; calculated KPIs intentionally absent.';
