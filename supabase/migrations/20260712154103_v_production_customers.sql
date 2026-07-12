-- Spiegel des tenant-Hardcodes aus v_production_orders; De-Hardcode in F4.
CREATE OR REPLACE VIEW public.v_production_customers WITH (security_invoker=true) AS
SELECT c.*
FROM public.customers c
WHERE c.tenant_id::text = 'galvanik-kreile'
AND (
  EXISTS (SELECT 1 FROM public.v_production_orders v WHERE v.customer_id = c.id)
  OR (
    COALESCE(c.source,'') <> ALL (ARRAY['seed','test','integration-test'])
    AND lower(COALESCE(c.name,'')) !~ 'test|demo|muster|e2e'
    AND lower(COALESCE(c.company_name,'')) !~ 'test|demo|muster|e2e'
    AND length(trim(COALESCE(c.name, c.company_name, ''))) >= 3
  )
);
