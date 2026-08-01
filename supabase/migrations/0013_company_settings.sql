-- Company Settings Migration

CREATE TABLE IF NOT EXISTS company_settings (
  id text PRIMARY KEY DEFAULT 'default',
  tenant_id text NOT NULL,
  company_name text NOT NULL DEFAULT '',
  tagline text DEFAULT '',
  street text DEFAULT '',
  zip text DEFAULT '',
  city text DEFAULT '',
  country text DEFAULT 'Deutschland',
  phone text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  iban text DEFAULT '',
  bic text DEFAULT '',
  bank_name text DEFAULT '',
  tax_id text DEFAULT '',
  logo_url text DEFAULT '/logo.png',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Policy: CRUD nur fuer eigenen Tenant
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_settings' AND policyname = 'tenant_isolation_company_settings'
  ) THEN
    CREATE POLICY "tenant_isolation_company_settings" ON company_settings
      FOR ALL
      TO public
      USING (tenant_id = current_setting('app.tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;
