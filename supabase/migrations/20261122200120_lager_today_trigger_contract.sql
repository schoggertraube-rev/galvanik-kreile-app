-- P1 follow-up: inventory_items uses the current Today tenant lock contract.
-- Existing statement triggers and their transition tables remain in place.
CREATE OR REPLACE FUNCTION private.today_mark_inventory_items_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $body$
DECLARE tenants text[]; created_tenants text[];
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT array_agg(DISTINCT tenant_id ORDER BY tenant_id) INTO tenants FROM today_new WHERE nullif(btrim(tenant_id), '') IS NOT NULL;
 ELSIF TG_OP='DELETE' THEN
  SELECT array_agg(DISTINCT tenant_id ORDER BY tenant_id) INTO tenants FROM today_old WHERE nullif(btrim(tenant_id), '') IS NOT NULL;
 ELSE
  SELECT array_agg(tenant_id ORDER BY tenant_id) INTO tenants FROM (
   SELECT tenant_id FROM today_old UNION SELECT tenant_id FROM today_new
  ) affected WHERE nullif(btrim(tenant_id), '') IS NOT NULL;
 END IF;
 created_tenants:=private.today_lock_tenants_v1(tenants);
 INSERT INTO private.today_tenant_v1(tenant_id)
  SELECT tenant_id FROM unnest(tenants) AS affected(tenant_id) ORDER BY tenant_id
  ON CONFLICT(tenant_id) DO UPDATE SET tenant_seq=today_tenant_v1.tenant_seq+CASE WHEN EXCLUDED.tenant_id=ANY(created_tenants) THEN 0 ELSE 1 END;
 RETURN NULL;
END $body$;
REVOKE ALL ON FUNCTION private.today_mark_inventory_items_v1() FROM PUBLIC,anon,authenticated;
