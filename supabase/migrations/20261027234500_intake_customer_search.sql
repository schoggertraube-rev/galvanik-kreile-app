DROP VIEW private.v_order_intake_customers_v1;

CREATE VIEW private.v_order_intake_customers_v1
WITH (security_invoker = true)
AS
SELECT
  customer.id,
  customer.tenant_id,
  customer.customer_number,
  customer.name,
  customer.company_name,
  customer.type AS customer_type,
  customer.contact_person,
  customer.phone,
  customer.email,
  customer.street,
  customer.zip_code,
  customer.city,
  customer.country,
  customer.payment_preference,
  customer.vat_id,
  count(orders.id)::integer AS orders_count,
  lower(concat_ws(' ',
    customer.name,
    customer.company_name,
    customer.contact_person,
    customer.phone,
    customer.email,
    customer.street,
    customer.zip_code,
    customer.city,
    customer.customer_number
  )) AS search_text,
  (
    customer.id = btrim(customer.id)
    AND length(customer.id) BETWEEN 1 AND 128
    AND customer.name = btrim(customer.name)
    AND length(customer.name) BETWEEN 2 AND 160
    AND NOT EXISTS (
      SELECT 1
      FROM public.orders corrupt_order
      WHERE corrupt_order.customer_id = customer.id
        AND corrupt_order.tenant_id IS DISTINCT FROM customer.tenant_id
    )
  ) AS integrity_ok
FROM public.customers customer
LEFT JOIN public.orders orders
  ON orders.customer_id = customer.id
 AND orders.tenant_id = customer.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND customer.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND coalesce(customer.source, '') NOT IN ('seed', 'test', 'demo', 'integration-test')
  AND coalesce(customer.name, '') NOT LIKE 'Capture%'
GROUP BY customer.id, customer.tenant_id, customer.customer_number,
  customer.name, customer.company_name, customer.type, customer.contact_person,
  customer.phone, customer.email, customer.street, customer.zip_code, customer.city,
  customer.country, customer.payment_preference, customer.vat_id;

COMMENT ON VIEW private.v_order_intake_customers_v1 IS
  'Tenant-bound F1 customer search across master-data fields; product data only.';

REVOKE ALL ON TABLE private.v_order_intake_customers_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_order_intake_customers_v1 TO service_role;
