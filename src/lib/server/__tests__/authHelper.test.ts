/**
 * authHelper.test.ts
 *
 * Unit-Tests für checkAppSession() und checkAppAuth().
 *
 * Abgedeckte Szenarien:
 * 11. checkAppSession() liefert den korrekten Fehlergrund je SessionReadResult-Reason
 * 12. checkAppAuth() bleibt für bestehende Konsumenten kompatibel (gibt Rolle zurück)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { signAppSession, type AppSession } from "@/lib/server/appSession";

// ─── Testschlüssel ──────────────────────────────────────────────────────────
const TEST_SECRET = "test-secret-authhelper-unit-tests";
process.env.APP_SESSION_SECRET = TEST_SECRET;

// ─── Mocks (vi.hoisted → verfügbar in vi.mock-Factories) ─────────────────
const { mockCookieGet } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookieGet,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// ─── Hilfsfunktion ──────────────────────────────────────────────────────────
function makeSession(overrides?: Partial<AppSession>): AppSession {
  const now = Date.now();
  return {
    userId: "user-xyz",
    tenantId: "galvanik-kreile",
    role: "meister",
    displayName: "Klaus Meister",
    issuedAt: now - 500,
    expiresAt: now + 3600_000,
    ...overrides,
  };
}

function setMockCookie(session: AppSession) {
  const token = signAppSession(session, TEST_SECRET);
  mockCookieGet.mockImplementation((name: string) =>
    name === "kreile_app_session" ? { name, value: token } : undefined
  );
}

function clearMockCookie() {
  mockCookieGet.mockReturnValue(undefined);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("checkAppSession() – typisierte Fehlergründe (A-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("kein Cookie → UNAUTHORIZED, Meldung enthält 'Nicht angemeldet'", async () => {
    clearMockCookie();
    const { checkAppSession } = await import("@/lib/server/authHelper");
    const result = await checkAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("UNAUTHORIZED");
      expect(result.message).toContain("Nicht angemeldet");
    }
  });

  it("abgelaufene Session → UNAUTHORIZED, Meldung enthält 'abgelaufen'", async () => {
    const now = Date.now();
    setMockCookie(makeSession({ expiresAt: now - 1000 }));
    const { checkAppSession } = await import("@/lib/server/authHelper");
    const result = await checkAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("UNAUTHORIZED");
      expect(result.message).toContain("abgelaufen");
    }
  });

  it("falscher Tenant → UNAUTHORIZED, Meldung enthält 'Mandant'", async () => {
    setMockCookie(makeSession({ tenantId: "andere-firma" }));
    const { checkAppSession } = await import("@/lib/server/authHelper");
    const result = await checkAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("UNAUTHORIZED");
      expect(result.message).toContain("Mandant");
    }
  });

  it("manipulierte Signatur → UNAUTHORIZED, Meldung enthält 'Ungültige Sitzung'", async () => {
    const session = makeSession();
    const b64 = Buffer.from(JSON.stringify(session)).toString("base64");
    // Falsche Signaturlänge (64 Hex-Zeichen für SHA-256)
    const token = `${b64}.${"x".repeat(64)}`;
    mockCookieGet.mockImplementation((name: string) =>
      name === "kreile_app_session" ? { name, value: token } : undefined
    );
    const { checkAppSession } = await import("@/lib/server/authHelper");
    const result = await checkAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("UNAUTHORIZED");
      expect(result.message).toContain("Ungültige Sitzung");
    }
  });

  it("gültige Session → ok: true, vollständige AppSession", async () => {
    setMockCookie(makeSession());
    const { checkAppSession } = await import("@/lib/server/authHelper");
    const result = await checkAppSession();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe("user-xyz");
      expect(result.data.role).toBe("meister");
      expect(result.data.displayName).toBe("Klaus Meister");
    }
  });
});

describe("checkAppAuth() – Kompatibilität (A-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gültige Session, Rolle in READ_ROLES → ok: true, data = Rollenstring", async () => {
    setMockCookie(makeSession({ role: "meister" }));
    const { checkAppAuth } = await import("@/lib/server/authHelper");
    const result = await checkAppAuth("read");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("meister");
  });

  it("gültige Session, Rolle NICHT in WRITE_ROLES (readonly) → FORBIDDEN", async () => {
    setMockCookie(makeSession({ role: "readonly" }));
    const { checkAppAuth } = await import("@/lib/server/authHelper");
    const result = await checkAppAuth("write");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("FORBIDDEN");
  });

  it("keine Session → UNAUTHORIZED (Weitergabe von checkAppSession)", async () => {
    clearMockCookie();
    const { checkAppAuth } = await import("@/lib/server/authHelper");
    const result = await checkAppAuth();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("UNAUTHORIZED");
  });

  it("gültige Session, admin → ok: true im write-Modus", async () => {
    setMockCookie(makeSession({ role: "admin" }));
    const { checkAppAuth } = await import("@/lib/server/authHelper");
    const result = await checkAppAuth("write");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("admin");
  });
});
