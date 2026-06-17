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

import { getAppSession } from "@/lib/server/appSession";

/**
 * Gets the current authenticated Supabase user AND their DB user profile (role).
 * Falls back to App Session if Supabase user is not found (e.g. PIN login).
 */
export async function getCurrentAppUser() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  let targetUserId = user?.id;

  if (!targetUserId) {
    const appSession = await getAppSession();
    if (appSession?.userId) {
      targetUserId = appSession.userId;
    }
  }

  if (!targetUserId) return null;

  try {
    const [appUser] = await db.select().from(appUsers).where(eq(appUsers.id, targetUserId));
    return appUser || null;
  } catch (error: any) {
    const errorMsg = error?.message || "Unknown error";
    console.error("Error fetching appUser:", {
      message: errorMsg,
      details: error?.details || error?.detail || "No details",
      hint: error?.hint || "No hint",
      code: error?.code || "No code",
      cause: error?.cause || "No cause",
    });
    // Throw so that requireAdminOrDeveloper fails loudly instead of a silent redirect
    throw new Error(`DATABASE_ERROR: ${errorMsg}`);
  }
}

/**
 * Gets the role of the current user. Returns null if not logged in or no role found.
 */
export async function getCurrentRole(): Promise<string | null> {
  let user = null;
  let dbError: any = null;
  
  try {
    user = await getCurrentAppUser();
  } catch (error: any) {
    if (error.message.startsWith("DATABASE_ERROR")) {
      dbError = error;
    } else {
      throw error;
    }
  }

  if (user?.role) return user.role;
  
  // Fallback for local demo mode if DB query fails or user not linked
  const cookieStore = await cookies();
  const bypassAuth = cookieStore.get("bypass-auth")?.value;
  const localRole = cookieStore.get("kreile_role")?.value;
  
  const isDevEnv = process.env.NODE_ENV !== "production";
  
  if (isDevEnv && bypassAuth === "true" && localRole) {
    if (localRole === "admin" || localRole === "developer") {
      console.warn("DEMO MODE FALLBACK: Using kreile_role cookie for admin/developer verification.");
    }
    return localRole.toLowerCase();
  } else if (!isDevEnv && dbError && bypassAuth === "true") {
    console.error("Admin role DB check failed in production. Demo cookie fallback disabled.");
  }
  
  // If no fallback is available (or allowed), and there was a DB error, we must re-throw it so we don't fail silently
  if (dbError) {
    throw dbError;
  }

  return null;
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
