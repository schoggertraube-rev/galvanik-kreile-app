-- Migration: 0015_mvp_operational_modules
-- Description: MVP tables for Communication, KVP, Finance, Devices

-- 1. communication_threads
CREATE TABLE IF NOT EXISTS communication_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
    customer_id text REFERENCES customers(id) ON DELETE SET NULL,
    order_id text REFERENCES orders(id) ON DELETE SET NULL,
    source text,
    subject text,
    status text,
    priority text,
    category text,
    created_by uuid REFERENCES app_users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE communication_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_communication_threads" ON communication_threads;
CREATE POLICY "service_role_all_communication_threads" ON communication_threads 
    AS PERMISSIVE FOR ALL TO service_role 
    USING (true) WITH CHECK (true);
-- Authenticated policy disabled until safe tenant mapping is implemented
DROP POLICY IF EXISTS "auth_read_communication_threads" ON communication_threads;


-- 2. communication_messages
CREATE TABLE IF NOT EXISTS communication_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
    thread_id uuid REFERENCES communication_threads(id) ON DELETE CASCADE,
    direction text,
    channel text,
    body text,
    summary text,
    created_by uuid REFERENCES app_users(id),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE communication_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_communication_messages" ON communication_messages;
CREATE POLICY "service_role_all_communication_messages" ON communication_messages 
    AS PERMISSIVE FOR ALL TO service_role 
    USING (true) WITH CHECK (true);
-- Authenticated policy disabled until safe tenant mapping is implemented
DROP POLICY IF EXISTS "auth_read_communication_messages" ON communication_messages;


-- 3. phone_notes
CREATE TABLE IF NOT EXISTS phone_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
    thread_id uuid REFERENCES communication_threads(id),
    customer_id text REFERENCES customers(id) ON DELETE SET NULL,
    order_id text REFERENCES orders(id) ON DELETE SET NULL,
    raw_text text,
    generated_answer text,
    caller_name text,
    company text,
    phone text,
    category text,
    urgency text,
    status text DEFAULT 'draft',
    extraction_json jsonb DEFAULT '{}',
    links_json jsonb DEFAULT '[]',
    created_by uuid REFERENCES app_users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE phone_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_phone_notes" ON phone_notes;
CREATE POLICY "service_role_all_phone_notes" ON phone_notes 
    AS PERMISSIVE FOR ALL TO service_role 
    USING (true) WITH CHECK (true);
-- Authenticated policy disabled until safe tenant mapping is implemented
DROP POLICY IF EXISTS "auth_read_phone_notes" ON phone_notes;


-- 4. business_kvp_items
CREATE TABLE IF NOT EXISTS business_kvp_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
    title text NOT NULL,
    note text,
    category text,
    benefit text,
    priority text,
    status text DEFAULT 'new',
    photo_url text,
    created_by uuid REFERENCES app_users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE business_kvp_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_business_kvp" ON business_kvp_items;
CREATE POLICY "service_role_all_business_kvp" ON business_kvp_items 
    AS PERMISSIVE FOR ALL TO service_role 
    USING (true) WITH CHECK (true);
-- Authenticated policy disabled until safe tenant mapping is implemented
DROP POLICY IF EXISTS "auth_read_business_kvp" ON business_kvp_items;


-- 5. app_kvp_items
CREATE TABLE IF NOT EXISTS app_kvp_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
    title text NOT NULL,
    note text,
    category text,
    impact text,
    status text DEFAULT 'new',
    created_by uuid REFERENCES app_users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_kvp_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_app_kvp" ON app_kvp_items;
CREATE POLICY "service_role_all_app_kvp" ON app_kvp_items 
    AS PERMISSIVE FOR ALL TO service_role 
    USING (true) WITH CHECK (true);
-- Authenticated policy disabled until safe tenant mapping is implemented
DROP POLICY IF EXISTS "auth_read_app_kvp" ON app_kvp_items;


-- 6. feedback_notes
CREATE TABLE IF NOT EXISTS feedback_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
    page_path text,
    note text NOT NULL,
    role text,
    created_by uuid REFERENCES app_users(id),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_feedback_notes" ON feedback_notes;
CREATE POLICY "service_role_all_feedback_notes" ON feedback_notes 
    AS PERMISSIVE FOR ALL TO service_role 
    USING (true) WITH CHECK (true);
-- Authenticated policy disabled until safe tenant mapping is implemented
DROP POLICY IF EXISTS "auth_read_feedback_notes" ON feedback_notes;


-- 7. cost_positions
CREATE TABLE IF NOT EXISTS cost_positions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
    name text NOT NULL,
    amount numeric,
    cost_type text NOT NULL,
    interval_or_basis text,
    category text,
    note text,
    status text DEFAULT 'active',
    created_by uuid REFERENCES app_users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE cost_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_cost_positions" ON cost_positions;
CREATE POLICY "service_role_all_cost_positions" ON cost_positions 
    AS PERMISSIVE FOR ALL TO service_role 
    USING (true) WITH CHECK (true);
-- Authenticated policy disabled until safe tenant mapping is implemented
DROP POLICY IF EXISTS "auth_read_cost_positions" ON cost_positions;


-- 8. invoices (Vorbereitung / Demo für Livegang)
CREATE TABLE IF NOT EXISTS invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
    customer_id text REFERENCES customers(id) ON DELETE SET NULL,
    order_id text REFERENCES orders(id) ON DELETE SET NULL,
    invoice_number text,
    amount_total numeric,
    status text DEFAULT 'draft',
    due_date date,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_invoices" ON invoices;
CREATE POLICY "service_role_all_invoices" ON invoices 
    AS PERMISSIVE FOR ALL TO service_role 
    USING (true) WITH CHECK (true);
-- Authenticated policy disabled until safe tenant mapping is implemented
DROP POLICY IF EXISTS "auth_read_invoices" ON invoices;


-- 9. payments (Vorbereitung / Demo für Livegang)
CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
    invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
    provider text,
    method text,
    amount numeric,
    status text,
    paid_at timestamptz,
    provider_reference text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_payments" ON payments;
CREATE POLICY "service_role_all_payments" ON payments 
    AS PERMISSIVE FOR ALL TO service_role 
    USING (true) WITH CHECK (true);
-- Authenticated policy disabled until safe tenant mapping is implemented
DROP POLICY IF EXISTS "auth_read_payments" ON payments;


-- 10. devices (Vorbereitung / Demo für Livegang)
CREATE TABLE IF NOT EXISTS devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
    name text NOT NULL,
    status text DEFAULT 'active',
    last_seen timestamptz,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_devices" ON devices;
CREATE POLICY "service_role_all_devices" ON devices 
    AS PERMISSIVE FOR ALL TO service_role 
    USING (true) WITH CHECK (true);
-- Authenticated policy disabled until safe tenant mapping is implemented
DROP POLICY IF EXISTS "auth_read_devices" ON devices;


-- 11. licenses (Vorbereitung / Demo für Livegang)
CREATE TABLE IF NOT EXISTS licenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
    plan text NOT NULL,
    valid_until timestamptz,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_licenses" ON licenses;
CREATE POLICY "service_role_all_licenses" ON licenses 
    AS PERMISSIVE FOR ALL TO service_role 
    USING (true) WITH CHECK (true);
-- Authenticated policy disabled until safe tenant mapping is implemented
DROP POLICY IF EXISTS "auth_read_licenses" ON licenses;
