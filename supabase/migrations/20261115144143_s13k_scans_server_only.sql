-- K13K-3: existing server-only signed upload/download ports use service_role.
-- Retain that policy and all objects; remove the three direct session paths.
DROP POLICY scan_objects_insert_authenticated ON storage.objects;
DROP POLICY scan_objects_select_authenticated ON storage.objects;
DROP POLICY scan_objects_update_authenticated ON storage.objects;
