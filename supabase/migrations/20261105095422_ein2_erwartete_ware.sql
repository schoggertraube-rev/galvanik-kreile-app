-- P63: expected goods expose existing order/customer facts through one tenant-bound read port.
BEGIN;

CREATE VIEW public.v_intake_expected_goods_v1 WITH (security_invoker = true) AS
SELECT o.tenant_id, o.id, o.order_number, o.customer_id, c.name AS customer_name,
  o.task AS title, o.ware, o.ware_seit
FROM public.orders o
LEFT JOIN public.customers c ON c.tenant_id = o.tenant_id AND c.id = o.customer_id
WHERE o.ware IN ('erwartet', 'teilweise')
  AND nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND o.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

REVOKE ALL ON public.v_intake_expected_goods_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_intake_expected_goods_v1 TO service_role;

COMMIT;
