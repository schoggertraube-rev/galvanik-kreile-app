/**
 * appSession.test.ts
 *
 * Datenbankfreie Unit-Tests für den kanonischen App-Session-Vertrag.
 * Kein Netzwerk, keine echten Secrets, keine Supabase-Verbindung.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

// ─── Testschlüssel – ausschließlich für Tests ───────────────────────────────
const TEST_SECRET = "test-secret-only-for-unit-tests-not-production";

// ─── Hilfsfunktionen (spiegeln die internen Implementierungen) ─────────────
function signPayload(payloadStr: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
}

function buildToken(payload: object, secret: string): string {
  const payloadStr = JSON.stringify(payload);
  const sig = signPayload(payloadStr, secret);
  return `${Buffer.from(payloadStr).toString("base64")}.${sig}`;
}

// ─── Mocking ────────────────────────────────────────────────────────────────
// next/headers wird gemockt, da es außerhalb eines Next.js-Request-Contexts nicht funktioniert.
const mockCookieGet = vi.fn();
const mockCookieSet = vi.fn();
const mockCookieDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookieGet,
    set: mockCookieSet,
    delete: mockCookieDelete,
  }),
}));

// APP_SESSION_SECRET auf den Testschlüssel setzen
process.env.APP_SESSION_SECRET = TEST_SECRET;

// ─── Tests – Token-Struktur (pure Hilfsfunktionen, kein Next.js) ────────────

describe("AppSession – Token-Vertrag (pure Krypto, kein Next.js)", () => {
  const now = Date.now();
  const validSession = {
    userId: "user-123",
    tenantId: "galvanik-kreile",
    role: "werkstatt",
    displayName: "Hans Meister",
    issuedAt: now - 1000,
    expiresAt: now + 60 * 60 * 1000,
  };

  it("gültige Session: Token bauen und Signatur verifizieren", () => {
    const token = buildToken(validSession, TEST_SECRET);
    const [b64, sig] = token.split(".");
    expect(b64).toBeTruthy();
    expect(sig).toBeTruthy();

    const payloadStr = Buffer.from(b64, "base64").toString("utf8");
    const expectedSig = signPayload(payloadStr, TEST_SECRET);
    expect(sig).toBe(expectedSig);

    const decoded = JSON.parse(payloadStr);
    expect(decoded.userId).toBe("user-123");
    expect(decoded.tenantId).toBe("galvanik-kreile");
    expect(decoded.role).toBe("werkstatt");
    expect(decoded.displayName).toBe("Hans Meister");
  });

  it("manipulierte Signatur: Token mit falschem Secret → Signatur-Mismatch", () => {
    const token = buildToken(validSession, "wrong-secret-xyz");
    const [b64, sig] = token.split(".");
    const payloadStr = Buffer.from(b64, "base64").toString("utf8");
    const expectedSig = signPayload(payloadStr, TEST_SECRET);
    expect(sig).not.toBe(expectedSig);
  });

  it("manipulierte Payload: Payload ändern ohne neue Signatur → Mismatch", () => {
    const originalToken = buildToken(validSession, TEST_SECRET);
    const [, originalSig] = originalToken.split(".");

    const tampered = { ...validSession, role: "admin" };
    const tamperedB64 = Buffer.from(JSON.stringify(tampered)).toString("base64");

    const tamperedStr = Buffer.from(tamperedB64, "base64").toString("utf8");
    const recomputed = signPayload(tamperedStr, TEST_SECRET);
    expect(originalSig).not.toBe(recomputed);
  });

  it("abgelaufene Session: expiresAt in der Vergangenheit", () => {
    const expired = {
      ...validSession,
      issuedAt: now - 2 * 3600 * 1000,
      expiresAt: now - 1000,
    };
    const payloadStr = JSON.stringify(expired);
    const decoded = JSON.parse(payloadStr);
    expect(decoded.expiresAt).toBeLessThan(Date.now());
  });

  it("falscher Tenant: tenantId !== 'galvanik-kreile'", () => {
    const wrongTenant = { ...validSession, tenantId: "other-company" };
    const payloadStr = JSON.stringify(wrongTenant);
    const decoded = JSON.parse(payloadStr);
    expect(decoded.tenantId).not.toBe("galvanik-kreile");
  });
});

// ─── Tests – Konstanten ──────────────────────────────────────────────────────

describe("AppSession – Konstanten", () => {
  it("COOKIE_NAME ist 'kreile_app_session'", async () => {
    const { COOKIE_NAME } = await import("@/lib/server/appSession");
    expect(COOKIE_NAME).toBe("kreile_app_session");
  });

  it("SESSION_TTL_MS ist 12 Stunden in Millisekunden", async () => {
    const { SESSION_TTL_MS } = await import("@/lib/server/appSession");
    expect(SESSION_TTL_MS).toBe(12 * 60 * 60 * 1000);
  });
});

// ─── Tests – getAppSession() mit gemocktem Cookie ───────────────────────────

describe("AppSession – getAppSession() mit gemocktem Cookie", () => {
  const now = Date.now();
  const validSession = {
    userId: "user-abc",
    tenantId: "galvanik-kreile",
    role: "buero",
    displayName: "Büro User",
    issuedAt: now - 100,
    expiresAt: now + 3600 * 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("kein Cookie → null", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { getAppSession } = await import("@/lib/server/appSession");
    const result = await getAppSession();
    expect(result).toBeNull();
  });

  it("gültiger Token → Session-Objekt", async () => {
    const token = buildToken(validSession, TEST_SECRET);
    mockCookieGet.mockImplementation((name: string) =>
      name === "kreile_app_session" ? { name, value: token } : undefined
    );
    const { getAppSession } = await import("@/lib/server/appSession");
    const session = await getAppSession();
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-abc");
    expect(session?.role).toBe("buero");
    expect(session?.tenantId).toBe("galvanik-kreile");
  });

  it("manipulierte Signatur → null", async () => {
    const payloadStr = JSON.stringify(validSession);
    const b64 = Buffer.from(payloadStr).toString("base64");
    const token = `${b64}.invalidsignatureXXX`;
    mockCookieGet.mockImplementation((name: string) =>
      name === "kreile_app_session" ? { name, value: token } : undefined
    );
    const { getAppSession } = await import("@/lib/server/appSession");
    const session = await getAppSession();
    expect(session).toBeNull();
  });

  it("abgelaufene Session → null", async () => {
    const expired = { ...validSession, expiresAt: now - 1000 };
    const token = buildToken(expired, TEST_SECRET);
    mockCookieGet.mockImplementation((name: string) =>
      name === "kreile_app_session" ? { name, value: token } : undefined
    );
    const { getAppSession } = await import("@/lib/server/appSession");
    const session = await getAppSession();
    expect(session).toBeNull();
  });

  it("falscher Tenant → null", async () => {
    const wrongTenant = { ...validSession, tenantId: "fremd-firma" };
    const token = buildToken(wrongTenant, TEST_SECRET);
    mockCookieGet.mockImplementation((name: string) =>
      name === "kreile_app_session" ? { name, value: token } : undefined
    );
    const { getAppSession } = await import("@/lib/server/appSession");
    const session = await getAppSession();
    expect(session).toBeNull();
  });
});
