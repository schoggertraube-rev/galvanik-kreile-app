/**
 * logout.test.ts
 *
 * Unit-Tests für logout().
 *
 * Szenarien:
 * 10a. Logout löscht App-Cookie trotz Supabase-Fehler (try/finally)
 * 10b. Erfolgreicher Supabase-Logout → remoteSignOut: "success"
 * 10c. Supabase-Logout wirft → remoteSignOut: "failed", Cookie trotzdem gelöscht
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSignOut, mockClearAppSession } = vi.hoisted(() => {
  return {
    mockSignOut: vi.fn(),
    mockClearAppSession: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { signOut: mockSignOut },
  }),
}));

vi.mock("@/lib/server/appSession", () => ({
  clearAppSession: mockClearAppSession,
  clearAppSessionCookie: mockClearAppSession,
  setAppSession: vi.fn().mockResolvedValue(undefined),
  getAppSession: vi.fn().mockResolvedValue(null),
  readAppSession: vi.fn().mockResolvedValue({ ok: false, reason: "NO_COOKIE" }),
  SESSION_TTL_MS: 12 * 60 * 60 * 1000,
  COOKIE_NAME: "kreile_app_session",
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/auth/roles", () => ({
  getCurrentRole: vi.fn().mockResolvedValue("admin"),
  getCurrentAppUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { logout } from "@/app/actions/auth";

describe("logout() – Cookie-Bereinigung (A-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearAppSession.mockResolvedValue(undefined);
  });

  it("10b – erfolgreicher Supabase-Logout → ok: true, remoteSignOut: 'success'", async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });
    const result = await logout();

    expect(result).toEqual({ ok: true, remoteSignOut: "success" });
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(mockClearAppSession).toHaveBeenCalledOnce();
  });

  it("10c – Supabase-Logout wirft → ok: true, remoteSignOut: 'failed', Cookie trotzdem gelöscht", async () => {
    mockSignOut.mockRejectedValueOnce(new Error("Supabase network failure"));
    const result = await logout();

    expect(result).toEqual({ ok: true, remoteSignOut: "failed" });
    expect(mockSignOut).toHaveBeenCalledOnce();
    // DIE KRITISCHE PRÜFUNG: clearAppSession trotz Supabase-Fehler
    expect(mockClearAppSession).toHaveBeenCalledOnce();
  });

  it("10a – Supabase gibt Error-Objekt zurück → Cookie trotzdem gelöscht", async () => {
    mockSignOut.mockResolvedValueOnce({ error: { message: "JWT expired" } });
    const result = await logout();

    expect(result.ok).toBe(true);
    expect(mockClearAppSession).toHaveBeenCalledOnce();
  });
});
