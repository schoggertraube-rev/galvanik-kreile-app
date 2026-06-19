process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";

/**
 * authHelper.test.ts
 *
 * Unit-Tests für checkAppSession() und checkAppAuth().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { signAppSession, type AppSession } from "@/lib/server/appSession";
import { db } from "@/db";
import { appUsers } from "@/db/schema";

// ─── Testschlüssel ──────────────────────────────────────────────────────────
const TEST_SECRET = "test-secret-authhelper-unit-tests";
process.env.APP_SESSION_SECRET = TEST_SECRET;

// ─── Mocks ─────────────────
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

vi.mock("@/db", () => {
  const mockWhere = vi.fn();
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return {
    db: {
      select: mockSelect,
    },
    mockWhere,
  };
});

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
    vi.mocked(db.select().from(appUsers).where).mockReset();
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
    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([
      {
        id: "user-xyz",
        fullName: "Klaus Meister",
        role: "meister",
        active: true,
      }
    ] as unknown as Array<typeof appUsers.$inferSelect>);

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
    vi.mocked(db.select().from(appUsers).where).mockReset();
  });

  it("gültige Session, Rolle in READ_ROLES → ok: true, data = Rollenstring", async () => {
    setMockCookie(makeSession({ role: "meister" }));
    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([
      {
        id: "user-xyz",
        fullName: "Klaus Meister",
        role: "meister",
        active: true,
      }
    ] as unknown as Array<typeof appUsers.$inferSelect>);

    const { checkAppAuth } = await import("@/lib/server/authHelper");
    const result = await checkAppAuth("read");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("meister");
  });

  it("gültige Session, Rolle NICHT in WRITE_ROLES (readonly) → FORBIDDEN", async () => {
    setMockCookie(makeSession({ role: "readonly" }));
    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([
      {
        id: "user-xyz",
        fullName: "Klaus Meister",
        role: "readonly",
        active: true,
      }
    ] as unknown as Array<typeof appUsers.$inferSelect>);

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
    vi.mocked(db.select().from(appUsers).where).mockResolvedValue([
      {
        id: "user-xyz",
        fullName: "Klaus Meister",
        role: "admin",
        active: true,
      }
    ] as unknown as Array<typeof appUsers.$inferSelect>);

    const { checkAppAuth } = await import("@/lib/server/authHelper");
    const result = await checkAppAuth("write");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("admin");
  });
});
