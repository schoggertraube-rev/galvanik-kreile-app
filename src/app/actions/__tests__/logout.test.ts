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
import { logout } from "@/app/actions/auth";

// ─── Mocks ──────────────────────────────────────────────────────────────────
const { mockSignOut, mockClearAppSession, mockResolveAuthorization, mockReadScope } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
  mockClearAppSession: vi.fn(),
  mockResolveAuthorization: vi.fn(),
  mockReadScope: vi.fn(),
}));

vi.mock('@/lib/server/authBootstrap', () => ({ readCacheLoginScope: mockReadScope }));
vi.mock('@/lib/server/authorization', () => ({ resolveAuthorization: mockResolveAuthorization }));

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

// ─── Tests ──────────────────────────────────────────────────────────────────

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

  it("revokes only the current Supabase session after inactivity", async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });
    const sessionScope = 'c'.repeat(64);
    mockReadScope.mockResolvedValueOnce(sessionScope);
    mockResolveAuthorization.mockResolvedValueOnce({ ok: false, reason: 'INVALID_SESSION', message: 'AUTH_SESSION_INACTIVE' });
    expect(await logout({ sessionScope })).toEqual({ ok: true, remoteSignOut: "success" });
    expect(mockSignOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
    expect(mockClearAppSession).toHaveBeenCalledOnce();
  });

  it('does not call Supabase or change cookies for an older tab after relogin', async () => {
    mockReadScope.mockResolvedValueOnce('b'.repeat(64));
    expect(await logout({ sessionScope: 'c'.repeat(64) })).toEqual({ ok: false, code: 'SESSION_CHANGED' });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClearAppSession).not.toHaveBeenCalled();
  });
});
