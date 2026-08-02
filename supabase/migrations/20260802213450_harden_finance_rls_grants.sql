-- P1 production migration: close public/authenticated finance-table exposure and replace the
-- permissive orders policy with an active-user, tenant-bound policy.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_user_can_view_finance(expected_tenant text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users AS app_user
    WHERE app_user.id = (SELECT auth.uid())
      AND app_user.tenant_id = expected_tenant
      AND app_user.active IS TRUE
      AND lower(app_user.role) IN ('developer', 'admin', 'buero')
  );
$$;

REVOKE ALL ON FUNCTION private.current_user_can_view_finance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_user_can_view_finance(text) TO authenticated;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_all_orders_final ON public.orders;
DROP POLICY IF EXISTS tenant_isolation_orders ON public.orders;
DROP POLICY IF EXISTS authenticated_finance_orders ON public.orders;
DROP POLICY IF EXISTS authenticated_finance_orders_select ON public.orders;
CREATE POLICY authenticated_finance_orders_select
ON public.orders
FOR SELECT
TO authenticated
USING (private.current_user_can_view_finance(tenant_id::text));

DROP POLICY IF EXISTS payments_all ON public.payments;
DROP POLICY IF EXISTS authenticated_finance_payments_select ON public.payments;
CREATE POLICY authenticated_finance_payments_select
ON public.payments
FOR SELECT
TO authenticated
USING (private.current_user_can_view_finance(tenant_id));

DROP POLICY IF EXISTS price_lines_all ON public.price_lines;

REVOKE ALL PRIVILEGES ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.payments FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.price_lines FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication AS publication
    JOIN pg_publication_rel AS publication_relation
      ON publication_relation.prpubid = publication.oid
    WHERE publication.pubname = 'supabase_realtime'
      AND publication_relation.prrelid = 'public.orders'::regclass
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
