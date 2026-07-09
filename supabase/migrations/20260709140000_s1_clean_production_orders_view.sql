CREATE OR REPLACE FUNCTION fn_is_production_order(order_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT order_tenant_id = 'galvanik-kreile';
$$;

CREATE OR REPLACE VIEW v_production_orders AS
SELECT
  id,
  order_number,
  customer_id,
  title,
  task,
  status,
  risk,
  status_text,
  delay_reason,
  recommended_action,
  current_station_id,
  current_station_id AS current_station,
  station,
  intake_date,
  due_date,
  attachment_url,
  created_at,
  tenant_id
FROM orders
WHERE fn_is_production_order(tenant_id);
