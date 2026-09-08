-- Path-1 Werkstatt: tenant-bound, fail-closed KPI contract for the Phillip V4 home.
-- The view mirrors the two canonical station queues; TypeScript must not rederive counts.

CREATE OR REPLACE VIEW public.v_werkstatt_kpis_v1
WITH (security_invoker = true)
AS
WITH tenant_context AS (
  SELECT nullif(btrim(current_setting('app.tenant_id', true)), '') AS tenant_id
), eligible_orders AS (
  SELECT
    orders.tenant_id,
    orders.station,
    orders.current_station,
    orders.current_station_id,
    orders.status,
    orders.due_date
  FROM public.orders orders
  JOIN tenant_context
    ON tenant_context.tenant_id IS NOT NULL
   AND orders.tenant_id = tenant_context.tenant_id
  WHERE coalesce(orders.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
    AND coalesce(orders.order_number, '') NOT ILIKE 'A-SEED-%'
    AND coalesce(orders.order_number, '') NOT ILIKE '%TEST%'
    AND (
      (
        orders.station = 'wareneingang'
        AND (orders.current_station = 'wareneingang' OR orders.current_station IS NULL)
        AND (orders.current_station_id = 'wareneingang' OR orders.current_station_id IS NULL)
      )
      OR (
        orders.station IN ('galvanik', 'fertig')
        AND orders.current_station = orders.station
        AND orders.current_station_id = orders.station
        AND orders.status = orders.station
      )
    )
)
SELECT
  tenant_context.tenant_id,
  1::integer AS contract_version,
  count(eligible_orders.tenant_id) FILTER (
    WHERE eligible_orders.station IN ('galvanik', 'fertig')
  )::integer AS wip_count,
  count(eligible_orders.tenant_id) FILTER (
    WHERE eligible_orders.due_date::date >= (now() AT TIME ZONE 'Europe/Berlin')::date
      AND eligible_orders.due_date::date <= (
        date_trunc('week', now() AT TIME ZONE 'Europe/Berlin') + interval '6 days'
      )::date
  )::integer AS due_this_week_count
FROM tenant_context
LEFT JOIN eligible_orders
  ON eligible_orders.tenant_id = tenant_context.tenant_id
WHERE tenant_context.tenant_id IS NOT NULL
GROUP BY tenant_context.tenant_id;

COMMENT ON VIEW public.v_werkstatt_kpis_v1 IS
  'Werkstatt v1 tenant-bound WIP and due-this-week KPI contract; empty tenants return a validated 0/0 snapshot.';

REVOKE ALL ON TABLE public.v_werkstatt_kpis_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_werkstatt_kpis_v1 TO service_role;
