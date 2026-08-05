import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { checkAppAuthorization } from '@/lib/server/authHelper'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export async function createAuthorizedSessionContext(mode: 'read' | 'write') {
  const authorization = await checkAppAuthorization(mode)
  if (!authorization.ok) {
    throw new Error(authorization.message)
  }

  return {
    client: await createClient(),
    authorization: authorization.data,
  }
}

/**
 * Privileged Data-API client for authenticated server code that must access a
 * table whose anon/authenticated grants are intentionally revoked.
 *
 * Every caller must state whether it reads or writes; authorization happens
 * before the service-role client is created. Do not use this as a blanket
 * replacement for session-bound clients or as a substitute for tenant filters.
 */
export async function createAuthorizedDataClient(mode: 'read' | 'write') {
  const { client } = await createAuthorizedDataContext(mode)
  return client
}

/**
 * Same privileged boundary as createAuthorizedDataClient(), but also returns
 * the canonical application identity. Callers that write audit/user columns
 * must use this identity instead of Supabase Auth: PIN sessions are app
 * sessions and the service-role client intentionally has no end-user session.
 */
export async function createAuthorizedDataContext(mode: 'read' | 'write') {
  const authorization = await checkAppAuthorization(mode)
  if (!authorization.ok) {
    throw new Error(authorization.message)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Serverseitiger Supabase-Datenzugriff ist nicht konfiguriert.')
  }

  const client = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return { client, authorization: authorization.data }
}
