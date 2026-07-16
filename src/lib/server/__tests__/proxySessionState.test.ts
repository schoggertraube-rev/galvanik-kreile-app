import { describe, expect, it } from "vitest";
import { decideCurrentProxyIdentity, type CurrentAppUserState } from "@/lib/server/proxySessionState";
import type { AppSession } from "@/lib/server/appSessionToken";

const session: AppSession = {
  userId: "user-42",
  tenantId: "galvanik-kreile",
  role: "admin",
  displayName: "Admin",
  issuedAt: 1,
  expiresAt: Date.now() + 60_000,
};

function states(value?: Partial<CurrentAppUserState>) {
  if (!value) return new Map<string, CurrentAppUserState>();
  const state: CurrentAppUserState = {
    id: "user-42",
    tenantId: "galvanik-kreile",
    role: "admin",
    active: true,
    ...value,
  };
  return new Map([[state.id, state]]);
}

describe("proxy current-state session decision", () => {
  it("admits only a live role-matched app session", () => {
    expect(decideCurrentProxyIdentity({
      hadAppSessionCookie: true,
      verifiedAppSession: session,
      supabaseUserId: null,
      currentUsers: states({}),
    })).toEqual({ allowed: true, staleAppSession: false });
  });

  it("immediately rejects inactive, deleted and role-changed users", () => {
    for (const currentUsers of [
      states({ active: false }),
      states(),
      states({ role: "readonly" }),
    ]) {
      expect(decideCurrentProxyIdentity({
        hadAppSessionCookie: true,
        verifiedAppSession: session,
        supabaseUserId: "user-42",
        currentUsers,
      })).toEqual({ allowed: false, staleAppSession: true });
    }
  });

  it("does not let a Supabase session bypass a stale app-session cookie", () => {
    expect(decideCurrentProxyIdentity({
      hadAppSessionCookie: true,
      verifiedAppSession: null,
      supabaseUserId: "user-42",
      currentUsers: states({}),
    })).toEqual({ allowed: false, staleAppSession: true });
  });

  it("fails closed when current state is unavailable", () => {
    expect(decideCurrentProxyIdentity({
      hadAppSessionCookie: true,
      verifiedAppSession: session,
      supabaseUserId: null,
      currentUsers: null,
    })).toEqual({ allowed: false, staleAppSession: false });
  });

  it("admits an active mapped Supabase user only when no app cookie exists", () => {
    expect(decideCurrentProxyIdentity({
      hadAppSessionCookie: false,
      verifiedAppSession: null,
      supabaseUserId: "user-42",
      currentUsers: states({}),
    }).allowed).toBe(true);
    expect(decideCurrentProxyIdentity({
      hadAppSessionCookie: false,
      verifiedAppSession: null,
      supabaseUserId: "user-42",
      currentUsers: states({ active: false }),
    }).allowed).toBe(false);
  });
});
