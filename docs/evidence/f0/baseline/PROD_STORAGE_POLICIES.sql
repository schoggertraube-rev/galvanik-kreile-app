-- Storage-RLS-Policies (storage.objects) — Prod-Paritaet fuer F0-03/F0-06.
-- Exakte Prod-Definitionen (pg_get_expr). Idempotent/replay-safe.
-- Prod: 67 public/private + 4 storage = 71 Policies gesamt.

drop policy if exists "scan_objects_insert_authenticated" on storage.objects;
CREATE POLICY scan_objects_insert_authenticated ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1 FROM app_users au WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]) AND ((au.role)::text = ANY ((ARRAY['werkstatt'::character varying, 'meister'::character varying, 'buero'::character varying, 'admin'::character varying])::text[])))))));

drop policy if exists "scan_objects_select_authenticated" on storage.objects;
CREATE POLICY scan_objects_select_authenticated ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1 FROM app_users au WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]))))));

drop policy if exists "scan_objects_service_role_all" on storage.objects;
CREATE POLICY scan_objects_service_role_all ON storage.objects AS PERMISSIVE FOR ALL TO service_role USING ((bucket_id = 'scans'::text)) WITH CHECK ((bucket_id = 'scans'::text));

drop policy if exists "scan_objects_update_authenticated" on storage.objects;
CREATE POLICY scan_objects_update_authenticated ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1 FROM app_users au WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]) AND ((au.role)::text = ANY ((ARRAY['werkstatt'::character varying, 'meister'::character varying, 'buero'::character varying, 'admin'::character varying])::text[]))))))) WITH CHECK (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1 FROM app_users au WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]) AND ((au.role)::text = ANY ((ARRAY['werkstatt'::character varying, 'meister'::character varying, 'buero'::character varying, 'admin'::character varying])::text[])))))));
