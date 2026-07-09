DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'v_production_orders'
      AND c.relkind IN ('v', 'm')
  ) THEN
    EXECUTE $view$
      CREATE VIEW public.v_production_orders AS
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
      FROM public.orders
      WHERE tenant_id = 'galvanik-kreile'
    $view$;
  END IF;
END
$migration$;