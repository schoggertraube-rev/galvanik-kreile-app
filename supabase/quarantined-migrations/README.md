# Quarantined migrations

SQL files in this directory are preserved source material and are not part of
the automatic Supabase migration chain.

`20260804200000_rls_p0_tenant_isolation.sql` was merged into the repository but
was never applied to Production. Its `app.tenant_id` contract is not set by the
runtime, so applying it would close legitimate browser-backed application paths
without establishing a working tenant identity. It remains recoverable here
until the Data-API and database-role contract is repaired and separately
approved.

Do not move a file from this directory into `supabase/migrations/` without a new
version, a reviewed forward-only migration, local replay, and explicit approval
for the corresponding RLS or policy change.
