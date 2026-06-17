/**
 * loginWithPin.test.ts
 *
 * Unit-Tests für den PIN-Login.
 *
 * Abgedeckte Szenarien:
 *  8a. PIN-Login erstellt vollständige AppSession mit korrektem displayName
 *  8b. PIN-Login mit leerem fullName → Fehler statt UUID-Fallback
 *  8c. Falscher PIN → nicht-ok Ergebnis
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Testschlüssel ──────────────────────────────────────────────────────────
const TEST_SECRET = "test-secret-loginwithpin-unit-tests";
process.env.APP_SESSION_SECRET = TEST_SECRET;

// ─── Mocks ──────────────────────────────────────────────────────────────────
const mockSetAppSession = vi.fn();
const mockCookieSet = vi.fn();

vi.mock("@/lib/server/appSession", () => ({
  setAppSession: mockSetAppSession,
  clearAppSession: vi.fn(),
  getAppSession: vi.fn().mockResolvedValue(null),
  readAppSession: vi.fn().mockResolvedValue({ ok: false, reason: "NO_COOKIE" }),
  SESSION_TTL_MS: 12 * 60 * 60 * 1000,
  COOKIE_NAME: "kreile_app_session",
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: mockCookieSet,
    delete: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// DB-Mock: simuliert appUsers-Abfrage
const mockDbSelect = vi.fn();
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockDbSelect,
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: { id: "id", pinHash: "pin_hash", active: "active", role: "role", fullName: "full_name" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("loginWithPin() – AppSession-Erstellung (A-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetAppSession.mockResolvedValue(undefined);
  });

  it("8a – gültiger PIN mit vollständigem fullName → AppSession wird mit displayName gesetzt", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-abc",
      pinHash: "1234",
      active: true,
      role: "werkstatt",
      fullName: "Max Mustermann",
    }]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("user-abc", "1234");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.role).toBe("werkstatt");

    expect(mockSetAppSession).toHaveBeenCalledOnce();
    const sessionArg = mockSetAppSession.mock.calls[0][0];
    expect(sessionArg.userId).toBe("user-abc");
    expect(sessionArg.displayName).toBe("Max Mustermann");
    expect(sessionArg.role).toBe("werkstatt");
    expect(sessionArg.tenantId).toBe("galvanik-kreile");
    // Keine UUID als displayName
    expect(sessionArg.displayName).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("8b – fullName leer → Fehler statt UUID-Fallback", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-def",
      pinHash: "5678",
      active: true,
      role: "buero",
      fullName: "   ", // nur Leerzeichen
    }]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("user-def", "5678");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Anzeigename/i);
    }
    // setAppSession darf NICHT aufgerufen worden sein
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("8c – falscher PIN → nicht-ok, keine Session erstellt", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-ghi",
      pinHash: "9999",
      active: true,
      role: "meister",
      fullName: "Paul Meister",
    }]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("user-ghi", "0000"); // falscher PIN

    expect(result.ok).toBe(false);
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });
});
