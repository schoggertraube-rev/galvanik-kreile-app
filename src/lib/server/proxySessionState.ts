import { createClient } from "@supabase/supabase-js";
import type { AppSession } from "./appSessionToken";

export type CurrentAppUserState = {
  id: string;
  tenantId: string;
  role: string;
  active: boolean;
};

export async function readCurrentAppUserStates(input: {
  supabaseUrl: string;
  serviceRoleKey: string | undefined;
  userIds: readonly string[];
}): Promise<Map<string, CurrentAppUserState> | null> {
  const userIds = [...new Set(input.userIds.filter((id) => id.length > 0 && id.length <= 128))];
  if (!input.supabaseUrl || !input.serviceRoleKey || userIds.length < 1 || userIds.length > 2) {
    return null;
  }
  try {
    const admin = createClient(input.supabaseUrl, input.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin
      .from("app_users")
      .select("id, tenant_id, role, active")
      .eq("tenant_id", "galvanik-kreile")
      .in("id", userIds);
    if (error || !Array.isArray(data)) return null;

    const states = new Map<string, CurrentAppUserState>();
    for (const value of data) {
      if (
        value && typeof value === "object" &&
        typeof value.id === "string" && userIds.includes(value.id) &&
        value.tenant_id === "galvanik-kreile" &&
        typeof value.role === "string" &&
        typeof value.active === "boolean"
      ) {
        states.set(value.id, {
          id: value.id,
          tenantId: value.tenant_id,
          role: value.role,
          active: value.active,
        });
      }
    }
    return states;
  } catch {
    return null;
  }
}

export function decideCurrentProxyIdentity(input: {
  hadAppSessionCookie: boolean;
  verifiedAppSession: AppSession | null;
  supabaseUserId: string | null;
  currentUsers: Map<string, CurrentAppUserState> | null;
}): { allowed: boolean; staleAppSession: boolean } {
  if (!input.currentUsers) {
    return { allowed: false, staleAppSession: false };
  }

  if (input.hadAppSessionCookie) {
    const session = input.verifiedAppSession;
    const current = session ? input.currentUsers.get(session.userId) : undefined;
    const sessionMatches = Boolean(
      session && current?.active &&
      current.tenantId === session.tenantId &&
      current.role.trim().toLowerCase() === session.role.trim().toLowerCase(),
    );
    return { allowed: sessionMatches, staleAppSession: !sessionMatches };
  }

  const current = input.supabaseUserId ? input.currentUsers.get(input.supabaseUserId) : undefined;
  return { allowed: Boolean(current?.active), staleAppSession: false };
}
