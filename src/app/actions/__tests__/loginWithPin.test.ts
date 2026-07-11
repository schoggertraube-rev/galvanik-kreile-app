/**
 * loginWithPin.test.ts
 *
 * Unit-Tests fuer den PIN-Login.
 *
 * Abgedeckte Szenarien:
 *  8a. PIN-Login erstellt vollstaendige AppSession mit korrektem displayName
 *  8b. PIN-Login mit leerem fullName -> Fehler statt UUID-Fallback
 *  8c. Falscher PIN -> nicht-ok Ergebnis
 *  8d. Developer mit korrekter PIN -> abgelehnt
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_SECRET = "test-secret-loginwithpin-unit-tests";
process.env.KREILE_SESSION_SECRET = TEST_SECRET;

const mockSetAppSession = vi.fn();
const mockCookieSet = vi.fn();

vi.mock("@/lib/server/appSession", () => ({
  setAppSession: mockSetAppSession,
  clearAppSession: vi.fn(),
  readAppSession: vi.fn().mockResolvedValue({ ok: false, reason: "NO_COOKIE" }),
  deriveSessionInitials: (name: string) => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return parts[0] ? parts[0].slice(0, 2).toUpperCase() : "?";
  },
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
  appUsers: { id: "id", tenantId: "tenant_id", pinHash: "pin_hash", active: "active", role: "role", fullName: "full_name" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

describe("loginWithPin() - AppSession-Erstellung (A-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetAppSession.mockResolvedValue(undefined);
  });

  it("8a - gueltiger PIN mit vollstaendigem fullName -> AppSession wird mit Initialen gesetzt", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-abc",
      tenantId: "galvanik-kreile",
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
    expect(sessionArg.uid).toBe("user-abc");
    expect(sessionArg.initials).toBe("MM");
    expect(sessionArg.role).toBe("werkstatt");
    expect(sessionArg.tenant).toBe("galvanik-kreile");
    expect(typeof sessionArg.exp).toBe("number");
  });

  it("8b - fullName leer -> Fehler statt UUID-Fallback", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-def",
      tenantId: "galvanik-kreile",
      pinHash: "5678",
      active: true,
      role: "buero",
      fullName: "   ",
    }]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("user-def", "5678");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Anzeigename/i);
    }
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("8c - falscher PIN -> nicht-ok, keine Session erstellt", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-ghi",
      tenantId: "galvanik-kreile",
      pinHash: "9999",
      active: true,
      role: "meister",
      fullName: "Paul Meister",
    }]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("user-ghi", "0000");

    expect(result.ok).toBe(false);
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("8d - developer mit korrekter PIN - abgelehnt, keine Session erstellt", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-dev",
      tenantId: "galvanik-kreile",
      pinHash: "2468",
      active: true,
      role: "developer",
      fullName: "Dev User",
    }]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("user-dev", "2468");

    expect(result).toEqual({
      ok: false,
      message: "Ung\u00fcltige PIN oder inaktiver Benutzer.",
    });
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });
});
