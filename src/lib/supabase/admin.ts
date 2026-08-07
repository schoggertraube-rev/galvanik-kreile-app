import { createClient } from "@supabase/supabase-js";

/**
 * Canonical admin (service-role) Supabase client factory.
 *
 * This is the ONLY place in the codebase allowed to call createClient(...)
 * from "@supabase/supabase-js". Every other module under src/ must import
 * createAdminClient() from here instead of constructing its own client.
 * scripts/quality/check-supabase-client-boundary.mjs enforces this in CI and
 * fails the build if a new ad-hoc createClient(...) call appears outside
 * src/lib/supabase/.
 *
 * Server-only: the service-role key bypasses Row Level Security and must
 * never be imported into client-facing code. autoRefreshToken and
 * persistSession are disabled because this client has no end-user browser
 * session to maintain.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
