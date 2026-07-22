BEGIN;

ALTER TABLE public.scan_uploads ADD COLUMN IF NOT EXISTS ocr_provider text;
ALTER TABLE public.scan_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_uploads FORCE ROW LEVEL SECURITY;

DO $boundary$
DECLARE
  policy_name text;
  client_role text;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_uploads'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.scan_uploads', policy_name);
  END LOOP;

  REVOKE ALL PRIVILEGES ON TABLE public.scan_uploads FROM PUBLIC;
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.scan_uploads FROM %I', client_role);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.scan_uploads TO service_role;
  END IF;
END
$boundary$;

COMMIT;
