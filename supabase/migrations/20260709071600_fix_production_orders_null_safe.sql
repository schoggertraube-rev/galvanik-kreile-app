-- Migration: Make v_production_orders NULL-safe and set fn_is_production_order search_path
-- Date: 2026-07-09

-- Recreate v_production_orders to avoid empty lists due to SQL NULL three-valued logic.
-- We wrap nullable columns (source, customer_id, order_number, title, task) with COALESCE to ensure safe string matching.
CREATE OR REPLACE VIEW public.v_production_orders AS
 SELECT id,
    tenant_id,
    order_number,
    customer_id,
    title,
    task,
    station,
    current_station_id,
    status,
    risk,
    priority_computed,
    parts,
    status_text,
    delay_reason,
    recommended_action,
    intake_date,
    due_date,
    created_at,
    current_station,
    attachment_url,
    attachment_urls,
    inquiry_id,
    kostenstelle_primaer_id,
    db_geplant,
    db_ist,
    db_letzte_berechnung,
    priority,
    promised_due_date,
    completed_date,
    payment_status,
    delivery_method,
    source,
    source_ref,
    freetext_original,
    is_quote,
    quote_status,
    quote_converted_order_id
   FROM orders
  WHERE
    -- Enforce exact tenant
    (tenant_id::text = 'galvanik-kreile'::text)
    -- NULL-safe source matching: Default to empty string if NULL
    AND (COALESCE(source, '') NOT IN ('seed', 'test', 'integration-test'))
    -- Ensure customer_id exists and is not empty
    AND customer_id IS NOT NULL AND TRIM(BOTH FROM customer_id) <> ''
    -- Ensure order_number exists, is not empty, and excludes seed/test prefixes
    AND order_number IS NOT NULL AND TRIM(BOTH FROM order_number) <> ''
    AND order_number !~* '^A-SEED-'
    AND order_number !~* 'TEST'
    -- Ensure at least title or task is present
    AND (COALESCE(TRIM(BOTH FROM title), '') <> '' OR COALESCE(TRIM(BOTH FROM task), '') <> '')
    -- Exclude bad/dummy data pattern strings safely
    AND NOT (
      (COALESCE(title, '') <> '' AND TRIM(BOTH FROM title) <> '' AND (
        length(TRIM(BOTH FROM title)) < 3
        OR TRIM(BOTH FROM title) ~* '^[bcdfghjklmnpqrstvwxyz]{5,}'
        OR TRIM(BOTH FROM title) ~* 'asd|sdf|dfg|fgh|ghj|hjk|jkl|yxc|xcv|cvb|vbn|bnm'
        OR TRIM(BOTH FROM title) ~* '^([a-z])\1+'
        OR lower(TRIM(BOTH FROM title)) = ANY (ARRAY['gjgvvh', 'sfdghgjklji'])
        OR lower(TRIM(BOTH FROM title)) LIKE '%auftrag per scan test e2e%'
        OR lower(TRIM(BOTH FROM title)) LIKE '%test order%'
        OR lower(TRIM(BOTH FROM title)) LIKE '%test stoßstange kundenakte%'
      ))
      OR
      (COALESCE(task, '') <> '' AND TRIM(BOTH FROM task) <> '' AND (
        length(TRIM(BOTH FROM task)) < 3
        OR TRIM(BOTH FROM task) ~* '^[bcdfghjklmnpqrstvwxyz]{5,}'
        OR TRIM(BOTH FROM task) ~* 'asd|sdf|dfg|fgh|ghj|hjk|jkl|yxc|xcv|cvb|vbn|bnm'
        OR TRIM(BOTH FROM task) ~* '^([a-z])\1+'
        OR lower(TRIM(BOTH FROM task)) = ANY (ARRAY['gjgvvh', 'sfdghgjklji'])
        OR lower(TRIM(BOTH FROM task)) LIKE '%auftrag per scan test e2e%'
        OR lower(TRIM(BOTH FROM task)) LIKE '%test order%'
        OR lower(TRIM(BOTH FROM task)) LIKE '%test stoßstange kundenakte%'
      ))
    )
    -- Exclude test patterns from order_number, title, task
    AND NOT (
      COALESCE(order_number, '') ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'
      OR COALESCE(title, '') ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'
      OR COALESCE(task, '') ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'
    );

-- Set search_path on fn_is_production_order
ALTER FUNCTION public.fn_is_production_order(text) SET search_path = 'public';
