-- E-B/E1 source-shape correction: existing canonical fields, no new tenant model.
-- tenantFeaturePort filters tenant_features.tenant; packageFeaturePort and the
-- authorization resolver read feature_flags globally (there is no tenant key).
CREATE OR REPLACE FUNCTION private.today_mark_tenant_features_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
DECLARE changed jsonb;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('tenant_id',r.tenant)),'[]'::jsonb) INTO changed FROM today_new r;
 ELSIF TG_OP='DELETE' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('tenant_id',r.tenant)),'[]'::jsonb) INTO changed FROM today_old r;
 ELSE
  SELECT coalesce(jsonb_agg(row),'[]'::jsonb) INTO changed FROM (
   SELECT to_jsonb(r)||jsonb_build_object('tenant_id',r.tenant) AS row FROM today_new r
   UNION ALL SELECT to_jsonb(r)||jsonb_build_object('tenant_id',r.tenant) FROM today_old r
  ) transitions;
 END IF;
 PERFORM private.today_mark_rows_v1('public.tenant_features',changed);
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION private.today_mark_feature_flags_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
DECLARE changed boolean;
BEGIN
 IF TG_OP='INSERT' THEN SELECT EXISTS(SELECT 1 FROM today_new) INTO changed;
 ELSIF TG_OP='DELETE' THEN SELECT EXISTS(SELECT 1 FROM today_old) INTO changed;
 ELSE SELECT EXISTS(SELECT 1 FROM today_new) OR EXISTS(SELECT 1 FROM today_old) INTO changed;
 END IF;
 IF changed THEN
  -- Every existing model tenant consumes this same global source. Stable order
  -- retains the source trigger lock order and the projector's tenant-seq fence.
  INSERT INTO private.today_tenant_v1(tenant_id)
  SELECT tenant_id FROM private.today_tenant_v1 ORDER BY tenant_id
  ON CONFLICT(tenant_id) DO UPDATE SET tenant_seq=today_tenant_v1.tenant_seq+1;
 END IF;
 RETURN NULL;
END $$;
ALTER FUNCTION private.today_event_scope_v1(text) CALLED ON NULL INPUT;
REVOKE ALL ON FUNCTION private.today_mark_tenant_features_v1(),private.today_mark_feature_flags_v1() FROM PUBLIC,anon,authenticated;
