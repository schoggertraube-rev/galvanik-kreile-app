-- Supabase's default service_role grant may include DELETE/TRUNCATE.
-- Preserve queued originals and history: application access must never delete them.
REVOKE DELETE, TRUNCATE ON TABLE public.print_jobs FROM service_role;
