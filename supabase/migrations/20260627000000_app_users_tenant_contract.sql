-- Migration: Add tenant_id to app_users and adjust email uniqueness
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS tenant_id text;

-- Backfill existing users
UPDATE public.app_users SET tenant_id = 'galvanik-kreile' WHERE tenant_id IS NULL;

-- Set column as NOT NULL
ALTER TABLE public.app_users ALTER COLUMN tenant_id SET NOT NULL;

-- Create tenant_id + id index for query optimization
CREATE INDEX IF NOT EXISTS app_users_tenant_id_id_idx ON public.app_users (tenant_id, id);

-- Drop old single-column unique constraint on email
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_email_key;
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_email_unique;
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS users_email_key;

-- Add new composite unique constraint on (tenant_id, email)
DO $tenant_email_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.app_users'::regclass
      AND conname = 'app_users_tenant_email_unique'
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_tenant_email_unique UNIQUE (tenant_id, email);
  END IF;
END
$tenant_email_constraint$;
