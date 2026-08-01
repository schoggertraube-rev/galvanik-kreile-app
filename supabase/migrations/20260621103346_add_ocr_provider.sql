
ALTER TABLE scan_uploads ADD COLUMN IF NOT EXISTS ocr_provider text;

-- RLS-Policy für neue Spalte (lesen/schreiben wie bestehende scan_uploads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scan_uploads' AND policyname = 'tenant_isolation_scan_uploads'
  ) THEN
    CREATE POLICY tenant_isolation_scan_uploads ON scan_uploads
      FOR ALL TO authenticated
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;
