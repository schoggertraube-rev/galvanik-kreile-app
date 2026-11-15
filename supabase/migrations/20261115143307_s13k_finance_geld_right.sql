-- K13K-2: retain the existing private function, UID/tenant binding and grants.
-- Financial access comes from the persisted geld right, never a role label.
CREATE OR REPLACE FUNCTION private.current_user_can_view_finance(expected_tenant text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users AS app_user
    JOIN public.app_user_rights AS rights
      ON rights.tenant_id = app_user.tenant_id
      AND rights.user_id = app_user.id
      AND rights.bereich = 'geld'
    WHERE app_user.id = (SELECT auth.uid())
      AND app_user.tenant_id = expected_tenant
      AND app_user.active IS TRUE
  );
$function$;
