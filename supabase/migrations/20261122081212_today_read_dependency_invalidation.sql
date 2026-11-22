-- PLAN_LADEZEIT E-G2: native productive-reader counters found these five
-- existing inputs in addition to the original trigger inventory. Their rows
-- all have a NOT NULL tenant_id. Invalidate the actual affected tenant epoch;
-- never infer an order/customer from incomplete evidence or duplicate a reader.
-- The derived payload stays behind the existing tenant/source/version CAS.
DO $install$
DECLARE relation text; schema_name text; table_name text; function_name text;
BEGIN
 FOREACH relation IN ARRAY ARRAY[
  'private.evidence_extraction_metadata',
  'private.evidence_visibility_events',
  'private.order_production_snapshots',
  'private.order_station_evidence_reservations',
  'public.scan_uploads'
 ] LOOP
  schema_name:=split_part(relation,'.',1);
  table_name:=split_part(relation,'.',2);
  function_name:='today_mark_'||table_name||'_v1';
  EXECUTE format($function$
   CREATE FUNCTION private.%I() RETURNS trigger
   LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $body$
   DECLARE tenants text[];
   BEGIN
    IF TG_OP='INSERT' THEN
     SELECT array_agg(DISTINCT tenant_id ORDER BY tenant_id) INTO tenants FROM today_new;
    ELSIF TG_OP='DELETE' THEN
     SELECT array_agg(DISTINCT tenant_id ORDER BY tenant_id) INTO tenants FROM today_old;
    ELSE
     SELECT array_agg(tenant_id ORDER BY tenant_id) INTO tenants FROM (
      SELECT tenant_id FROM today_old UNION SELECT tenant_id FROM today_new
     ) affected;
    END IF;
    INSERT INTO private.today_tenant_v1(tenant_id)
     SELECT tenant_id FROM unnest(tenants) AS affected(tenant_id) ORDER BY tenant_id
     ON CONFLICT(tenant_id) DO UPDATE SET tenant_seq=today_tenant_v1.tenant_seq+1;
    RETURN NULL;
   END $body$;
  $function$,function_name);
  EXECUTE format('REVOKE ALL ON FUNCTION private.%I() FROM PUBLIC,anon,authenticated',function_name);
  EXECUTE format('CREATE TRIGGER today_mark_insert_v1 AFTER INSERT ON %I.%I REFERENCING NEW TABLE AS today_new FOR EACH STATEMENT EXECUTE FUNCTION private.%I()',schema_name,table_name,function_name);
  EXECUTE format('CREATE TRIGGER today_mark_update_v1 AFTER UPDATE ON %I.%I REFERENCING OLD TABLE AS today_old NEW TABLE AS today_new FOR EACH STATEMENT EXECUTE FUNCTION private.%I()',schema_name,table_name,function_name);
  EXECUTE format('CREATE TRIGGER today_mark_delete_v1 AFTER DELETE ON %I.%I REFERENCING OLD TABLE AS today_old FOR EACH STATEMENT EXECUTE FUNCTION private.%I()',schema_name,table_name,function_name);
 END LOOP;
END $install$;
