import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | undefined;

/**
 * Server-only Supabase client for operations that must work for both the
 * password/OAuth session and the workshop PIN session. Every caller must
 * complete its application authorization before obtaining this client.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_CONFIGURATION_MISSING");
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

export function resetSupabaseServiceClientForTests(): void {
  cachedClient = undefined;
}
