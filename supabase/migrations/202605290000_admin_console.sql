-- ============================================================================
-- Migration: Admin Console & User Management (Idempotent)
-- ============================================================================

BEGIN;

-- 1. Defensively rename public.users to public.app_users
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') AND
       NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_users') THEN
        ALTER TABLE users RENAME TO app_users;
    END IF;
END $$;

-- Fallback: If app_users doesn't exist and users didn't exist either, create it to prevent errors on ADD COLUMN
CREATE TABLE IF NOT EXISTS app_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    full_name text NOT NULL,
    role text NOT NULL DEFAULT 'workshop',
    active boolean DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Update foreign keys referencing the old users table
ALTER TABLE IF EXISTS events DROP CONSTRAINT IF EXISTS fk_user_id;

-- Add new columns to app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS language text DEFAULT 'de';

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS pin_hash text;

-- 3. feature_flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text,
    enabled boolean DEFAULT false,
    roles_allowed text[] DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- 4. import_jobs
CREATE TABLE IF NOT EXISTS import_jobs (
    id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    type text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_by uuid REFERENCES app_users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ
);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- 5. import_job_rows
CREATE TABLE IF NOT EXISTS import_job_rows (
    id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    job_id text NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    row_index integer NOT NULL,
    data jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    error_message text,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE import_job_rows ENABLE ROW LEVEL SECURITY;

-- 6. audit_log
CREATE TABLE IF NOT EXISTS audit_log (
    id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    action text NOT NULL,
    table_name text,
    record_id text,
    actor_id uuid REFERENCES app_users(id),
    payload jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 7. Basic permissive policies for Admin Console tables for now (until full RLS is rolled out)

DROP POLICY IF EXISTS "Allow full access to feature_flags" ON feature_flags;

CREATE POLICY "Allow full access to feature_flags" ON feature_flags FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to import_jobs" ON import_jobs;

CREATE POLICY "Allow full access to import_jobs" ON import_jobs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to import_job_rows" ON import_job_rows;

CREATE POLICY "Allow full access to import_job_rows" ON import_job_rows FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to audit_log" ON audit_log;

CREATE POLICY "Allow full access to audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);

COMMIT;
