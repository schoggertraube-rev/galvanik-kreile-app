-- D1: make the 'belege' storage bucket private.
-- Applied to production on 2026-08-06 via execute_sql; captured here as a
-- forward, replayable migration. Idempotent: a no-op if the bucket is absent.
-- The 'belege' bucket itself is created by 20260611114327_create_storage_buckets.sql.
update storage.buckets set public = false where id = 'belege';
