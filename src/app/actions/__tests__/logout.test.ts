/**
 * logout.test.ts
 *
 * Datenbankfreier Unit-Test:
 * Logout löscht die App-Session auch wenn Supabase-Logout fehlschlägt.
 *
 * Kein Netzwerk, keine echten Secrets, keine Supabase-Verbindung.
 *
 * Strategie: auth.ts importiert @/lib/auth/roles, welches @/db lädt.
 * Daher werden alle transitiven Imports gemockt, die DATABASE_URL benötigen.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Alle transitiven DB- und Supabase-Imports mocken ───────────────────────

const mockSignOut = vi.fn();
const mockClearAppSession = vi.fn();

// Supabase Server-Client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { signOut: mockSignOut },
  }),
}));

// App-Session – clearAppSession mocken (kanonische Funktion)
vi.mock("@/lib/server/appSession", () => ({
  clearAppSession: mockClearAppSession,
  clearAppSessionCookie: mockClearAppSession,
  getAppSession: vi.fn().mockResolvedValue(null),
  setAppSession: vi.fn().mockResolvedValue(undefined),
  COOKIE_NAME: "kreile_app_session",
  SESSION_TTL_MS: 12 * 60 * 60 * 1000,
}));

// DB-Treiber – wirft sonst wegen fehlender DATABASE_URL
vi.mock("@/db", () => ({
  db: {},
}));

// Roles – braucht db
vi.mock("@/lib/auth/roles", () => ({
  getCurrentRole: vi.fn().mockResolvedValue("admin"),
  getCurrentAppUser: vi.fn().mockResolvedValue(null),
}));

// next/cache + next/navigation – werden von auth.ts genutzt
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// ─── Dynamischer Import NACH Mocks ──────────────────────────────────────────
async function importLogout() {
  // Modul-Cache leeren damit Mocks greifen
  vi.resetModules();
  const mod = await import("@/app/actions/auth");
  return mod.logout;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("logout() – Cookie-Bereinigung (A-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mocks nach clearAllMocks neu registrieren
    mockClearAppSession.mockResolvedValue(undefined);
  });

  it("erfolgreicher Supabase-Logout → clearAppSession wird aufgerufen", async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });

    const logout = await importLogout();
    const result = await logout();

    expect(result).toEqual({ ok: true });
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(mockClearAppSession).toHaveBeenCalledOnce();
  });

  it("Supabase-Logout wirft → clearAppSession wird TROTZDEM aufgerufen (try/finally)", async () => {
    mockSignOut.mockRejectedValueOnce(new Error("Supabase network failure"));

    const logout = await importLogout();
    const result = await logout();

    expect(result).toEqual({ ok: true });
    expect(mockSignOut).toHaveBeenCalledOnce();
    // DIE KRITISCHE PRÜFUNG: clearAppSession muss trotz Supabase-Fehler aufgerufen worden sein
    expect(mockClearAppSession).toHaveBeenCalledOnce();
  });

  it("Supabase-Logout gibt Error-Objekt zurück → clearAppSession wird aufgerufen", async () => {
    mockSignOut.mockResolvedValueOnce({ error: { message: "JWT expired" } });

    const logout = await importLogout();
    const result = await logout();

    expect(result).toEqual({ ok: true });
    expect(mockClearAppSession).toHaveBeenCalledOnce();
  });
});
