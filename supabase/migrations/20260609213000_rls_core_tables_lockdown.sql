-- Migration: YYYYMMDDHHMM_rls_core_tables_lockdown.sql
-- Goal: Lock down orders, items, customers, baths, bath_measurements from anon (public) access.
-- We enable RLS on these tables, drop any old public/anon access policies, and revoke all DML privileges from anon and public.

-- 1. Enable Row Level Security (RLS) on core tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bath_measurements ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing open/permissive policies (cleaning up prototyping rules)
DROP POLICY IF EXISTS "Allow public read" ON public.orders;
DROP POLICY IF EXISTS "Allow public write" ON public.orders;
DROP POLICY IF EXISTS "Allow public select" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert" ON public.orders;
DROP POLICY IF EXISTS "Allow public update" ON public.orders;
DROP POLICY IF EXISTS "Allow public delete" ON public.orders;

DROP POLICY IF EXISTS "Allow public read" ON public.items;
DROP POLICY IF EXISTS "Allow public write" ON public.items;
DROP POLICY IF EXISTS "Allow public select" ON public.items;
DROP POLICY IF EXISTS "Allow public insert" ON public.items;
DROP POLICY IF EXISTS "Allow public update" ON public.items;
DROP POLICY IF EXISTS "Allow public delete" ON public.items;

DROP POLICY IF EXISTS "Allow public read" ON public.customers;
DROP POLICY IF EXISTS "Allow public write" ON public.customers;
DROP POLICY IF EXISTS "Allow public select" ON public.customers;
DROP POLICY IF EXISTS "Allow public insert" ON public.customers;
DROP POLICY IF EXISTS "Allow public update" ON public.customers;
DROP POLICY IF EXISTS "Allow public delete" ON public.customers;

DROP POLICY IF EXISTS "Allow public read" ON public.baths;
DROP POLICY IF EXISTS "Allow public write" ON public.baths;
DROP POLICY IF EXISTS "Allow public select" ON public.baths;
DROP POLICY IF EXISTS "Allow public insert" ON public.baths;
DROP POLICY IF EXISTS "Allow public update" ON public.baths;
DROP POLICY IF EXISTS "Allow public delete" ON public.baths;

DROP POLICY IF EXISTS "Allow public read" ON public.bath_measurements;
DROP POLICY IF EXISTS "Allow public write" ON public.bath_measurements;
DROP POLICY IF EXISTS "Allow public select" ON public.bath_measurements;
DROP POLICY IF EXISTS "Allow public insert" ON public.bath_measurements;
DROP POLICY IF EXISTS "Allow public update" ON public.bath_measurements;
DROP POLICY IF EXISTS "Allow public delete" ON public.bath_measurements;

-- 3. Explicitly revoke select, insert, update, delete from public and anon
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.items FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.baths FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.bath_measurements FROM anon;

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders FROM public;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.items FROM public;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers FROM public;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.baths FROM public;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.bath_measurements FROM public;

-- 4. Set service_role policies to permit admin backend operations if queried through PostgREST (Supabase Serverless REST API)
DROP POLICY IF EXISTS "service_role_orders" ON public.orders;
CREATE POLICY "service_role_orders" ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_items" ON public.items;
CREATE POLICY "service_role_items" ON public.items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_customers" ON public.customers;
CREATE POLICY "service_role_customers" ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_baths" ON public.baths;
CREATE POLICY "service_role_baths" ON public.baths FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_bath_measurements" ON public.bath_measurements;
CREATE POLICY "service_role_bath_measurements" ON public.bath_measurements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Rollback (Information purposes only - NOT ACTIVE IN PRODUCTION):
-- -- ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
-- -- ALTER TABLE public.items DISABLE ROW LEVEL SECURITY;
-- -- ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
-- -- ALTER TABLE public.baths DISABLE ROW LEVEL SECURITY;
-- -- ALTER TABLE public.bath_measurements DISABLE ROW LEVEL SECURITY;
-- -- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO anon, public;
-- -- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.items TO anon, public;
-- -- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO anon, public;
-- -- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.baths TO anon, public;
-- -- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bath_measurements TO anon, public;
