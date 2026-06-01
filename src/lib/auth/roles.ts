import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Creates a server-side Supabase client for reading auth cookies.
 */
async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in server components
          }
        },
      },
    }
  );
}

/**
 * Gets the current authenticated Supabase user AND their DB user profile (role).
 */
export async function getCurrentAppUser() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const [appUser] = await db.select().from(appUsers).where(eq(appUsers.id, user.id));
  return appUser || null;
}

/**
 * Gets the role of the current user. Returns null if not logged in or no role found.
 */
export async function getCurrentRole(): Promise<string | null> {
  const user = await getCurrentAppUser();
  return user?.role || null;
}

/**
 * Asserts that the current user has one of the allowed roles.
 * Redirects to '/' if the user is unauthorized.
 */
export async function requireRole(allowedRoles: string[]) {
  const role = await getCurrentRole();
  if (!role || !allowedRoles.includes(role)) {
    redirect("/");
  }
}

/**
 * Shortcut to check if the current user is a developer.
 */
export async function isDeveloper(): Promise<boolean> {
  const role = await getCurrentRole();
  return role === "developer";
}
