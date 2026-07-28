import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser database access remains prohibited until W3 proves tenant, role,
 * RLS, storage and realtime boundaries. There is deliberately no eager
 * singleton; quarantined legacy modules may import this factory without
 * silently establishing a client or refreshing a session.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
