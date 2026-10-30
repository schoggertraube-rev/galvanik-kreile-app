-- Stufe 1 / P3: expose the persisted catalog lead time through the existing
-- tenant-bound operational order read model. No product data is changed.

CREATE OR REPLACE VIEW private.v_operational_station_queue_v1
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.tenant_id,
  o.version,
  o.order_number,
  o.customer_id,
  c.name AS customer_name,
  o.title,
  o.task,
  o.station,
  o.current_station,
  o.current_station_id,
  o.status,
  o.priority_computed AS risk,
  o.intake_date,
  o.due_date,
  o.created_at,
  (
    c.id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.items corrupt_item
      WHERE corrupt_item.order_id = o.id
        AND (
          corrupt_item.tenant_id IS DISTINCT FROM o.tenant_id
          OR corrupt_item.customer_id IS DISTINCT FROM o.customer_id
        )
    )
  ) AS tenant_integrity_ok,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'tenantId', i.tenant_id,
        'orderId', i.order_id,
        'customerId', i.customer_id,
        'name', i.name,
        'quantity', i.quantity,
        'currentStationId', i.current_station_id,
        'material', i.material,
        'surfaceRequested', i.surface_requested,
        'photoIds', i.photo_ids,
        'photo', i.photo,
        'repairTypes', i.repair_types,
        'stationSequence', i.station_sequence,
        'currentStep', i.current_step,
        'internalNotes', i.internal_notes,
        'catalogServiceId', i.catalog_service_id,
        'standardLeadTimeWorkingDays', catalog.standard_lead_time_working_days,
        'createdAt', i.created_at
      )
      ORDER BY i.created_at, i.id
    ) FILTER (WHERE i.id IS NOT NULL),
    '[]'::jsonb
  ) AS parts
FROM public.orders o
LEFT JOIN public.customers c
  ON c.id = o.customer_id
 AND c.tenant_id = o.tenant_id
LEFT JOIN public.items i
  ON i.order_id = o.id
 AND i.tenant_id = o.tenant_id
 AND i.customer_id = o.customer_id
LEFT JOIN public.catalog_services catalog
  ON catalog.id = i.catalog_service_id
 AND catalog.tenant_id = i.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND o.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND coalesce(o.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
  AND coalesce(o.order_number, '') NOT ILIKE 'A-SEED-%'
  AND coalesce(o.order_number, '') NOT ILIKE '%TEST%'
GROUP BY
  o.id,
  o.tenant_id,
  o.version,
  o.order_number,
  o.customer_id,
  c.id,
  c.name,
  o.title,
  o.task,
  o.station,
  o.current_station,
  o.current_station_id,
  o.status,
  o.priority_computed,
  o.intake_date,
  o.due_date,
  o.created_at;

COMMENT ON VIEW private.v_operational_station_queue_v1 IS
  'P3 tenant-bound operational queue including catalog lead time for delivery-buffer calculation.';

CREATE OR REPLACE VIEW public.v_order_calendar_due_v1
WITH (security_invoker = true)
AS
SELECT id, tenant_id, due_date, status
FROM public.orders
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND coalesce(source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
  AND coalesce(order_number, '') NOT ILIKE 'A-SEED-%'
  AND coalesce(order_number, '') NOT ILIKE '%TEST%';

COMMENT ON VIEW public.v_order_calendar_due_v1 IS
  'Orders module contract for tenant-bound calendar delivery counts.';
