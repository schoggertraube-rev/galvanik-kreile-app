/**
 * appSession.test.ts
 *
 * Datenbankfreie Unit-Tests für den kanonischen App-Session-Vertrag.
 * Kein Netzwerk, keine echten Secrets, keine Supabase-Verbindung.
 *
 * Abgedeckte Szenarien:
 *  1. Gültiger Token – signAppSession + verifyAppSessionToken
 *  2. Manipulierte Payload (Signatur-Mismatch)
 *  3. Falsche Signaturlänge → INVALID_SIGNATURE
 *  4. Abgelaufene Session → EXPIRED
 *  5. Falscher Tenant → INVALID_TENANT
 *  6. MALFORMED-Token (kein Punkt-Separator)
 *  7. Cookie-Konfiguration: COOKIE_NAME und SESSION_TTL_MS
 *  8. readAppSession() mit gemocktem Cookie: kein Cookie → NO_COOKIE
 *  9. readAppSession() mit gültigem Token → AppSession
 * 10. readAppSession() mit manipulierter Signatur → INVALID_SIGNATURE
 * 11. readAppSession() mit abgelaufenem Token → EXPIRED
 * 12. readAppSession() mit falschem Tenant → INVALID_TENANT
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  signAppSession,
  verifyAppSessionToken,
  COOKIE_NAME,
  SESSION_TTL_MS,
  type AppSession,
} from "@/lib/server/appSession";

// ─── Testschlüssel ─────────────────────────────────────────────────────────
const TEST_SECRET = "test-secret-only-for-unit-tests-not-production";

// ─── Mocks (vi.hoisted → verfügbar in vi.mock-Factories) ─────────────────
const { mockCookieGet, mockCookieSet, mockCookieDelete } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockCookieSet: vi.fn(),
  mockCookieDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookieGet,
    set: mockCookieSet,
    delete: mockCookieDelete,
  }),
}));

// APP_SESSION_SECRET auf Testschlüssel setzen
process.env.APP_SESSION_SECRET = TEST_SECRET;

// ─── Hilfsfunktion ──────────────────────────────────────────────────────────
function makeSession(overrides?: Partial<AppSession>): AppSession {
  const now = Date.now();
  return {
    userId: "user-123",
    tenantId: "galvanik-kreile",
    role: "werkstatt",
    displayName: "Hans Meister",
    issuedAt: now - 1000,
    expiresAt: now + 60 * 60 * 1000,
    ...overrides,
  };
}

// ─── 1–7: Pure Funktionen (kein Next.js benötigt) ──────────────────────────

describe("signAppSession + verifyAppSessionToken – pure Krypto", () => {
  it("1 – gültiger Token: signieren und verifizieren", () => {
    const session = makeSession();
    const token = signAppSession(session, TEST_SECRET);

    const result = verifyAppSessionToken(token, TEST_SECRET);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.userId).toBe("user-123");
      expect(result.session.role).toBe("werkstatt");
      expect(result.session.displayName).toBe("Hans Meister");
      expect(result.session.tenantId).toBe("galvanik-kreile");
    }
  });

  it("2 – manipulierte Payload: Token mit Original-Signatur → INVALID_SIGNATURE", () => {
    const session = makeSession();
    const originalToken = signAppSession(session, TEST_SECRET);
    const [, originalSig] = originalToken.split(".");

    // Payload manipulieren und mit Original-Signatur kombinieren
    const tampered = { ...session, role: "admin" };
    const tamperedB64 = Buffer.from(JSON.stringify(tampered)).toString("base64");
    const tamperedToken = `${tamperedB64}.${originalSig}`;

    const result = verifyAppSessionToken(tamperedToken, TEST_SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("3 – falsche Signaturlänge (zu kurz) → INVALID_SIGNATURE", () => {
    const session = makeSession();
    const token = signAppSession(session, TEST_SECRET);
    const [b64] = token.split(".");

    // Signatur auf 10 Zeichen kürzen
    const shortSigToken = `${b64}.tooshort12`;
    const result = verifyAppSessionToken(shortSigToken, TEST_SECRET);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("4 – abgelaufene Session → EXPIRED", () => {
    const now = Date.now();
    const session = makeSession({
      issuedAt: now - 2 * 3600_000,
      expiresAt: now - 1000, // bereits abgelaufen
    });
    const token = signAppSession(session, TEST_SECRET);

    const result = verifyAppSessionToken(token, TEST_SECRET, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("5 – falscher Tenant → INVALID_TENANT", () => {
    const session = makeSession({ tenantId: "fremdfirma-xyz" });
    const token = signAppSession(session, TEST_SECRET);

    const result = verifyAppSessionToken(token, TEST_SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_TENANT");
  });

  it("6 – MALFORMED Token: kein Punkt-Separator", () => {
    const result = verifyAppSessionToken("ohnetrennzeichen", TEST_SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MALFORMED");
  });

  it("6b – MALFORMED Token: kein Inhalt vor dem Punkt", () => {
    const result = verifyAppSessionToken(".nurSignatur", TEST_SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MALFORMED");
  });
});

// ─── 7: Cookie-Konfiguration ───────────────────────────────────────────────

describe("Konstanten", () => {
  it("7a – COOKIE_NAME ist 'kreile_app_session'", () => {
    expect(COOKIE_NAME).toBe("kreile_app_session");
  });

  it("7b – SESSION_TTL_MS ist 12 Stunden in Millisekunden", () => {
    expect(SESSION_TTL_MS).toBe(12 * 60 * 60 * 1000);
  });
});

// ─── 8–12: readAppSession() mit gemockten Cookies ─────────────────────────

describe("readAppSession() – Cookie-Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("8 – kein Cookie → NO_COOKIE", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { readAppSession } = await import("@/lib/server/appSession");
    const result = await readAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NO_COOKIE");
  });

  it("9 – gültiger Token → ok: true, Session-Objekt", async () => {
    const session = makeSession();
    const token = signAppSession(session, TEST_SECRET);
    mockCookieGet.mockImplementation((name: string) =>
      name === COOKIE_NAME ? { name, value: token } : undefined
    );
    const { readAppSession } = await import("@/lib/server/appSession");
    const result = await readAppSession();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.userId).toBe("user-123");
      expect(result.session.displayName).toBe("Hans Meister");
    }
  });

  it("10 – manipulierte Signatur → INVALID_SIGNATURE", async () => {
    const session = makeSession();
    const b64 = Buffer.from(JSON.stringify(session)).toString("base64");
    const token = `${b64}.invalidsig0000000000000000000000000000000000000000000000000000000000`;
    mockCookieGet.mockImplementation((name: string) =>
      name === COOKIE_NAME ? { name, value: token } : undefined
    );
    const { readAppSession } = await import("@/lib/server/appSession");
    const result = await readAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("11 – abgelaufene Session → EXPIRED", async () => {
    const now = Date.now();
    const expired = makeSession({ expiresAt: now - 1000 });
    const token = signAppSession(expired, TEST_SECRET);
    mockCookieGet.mockImplementation((name: string) =>
      name === COOKIE_NAME ? { name, value: token } : undefined
    );
    const { readAppSession } = await import("@/lib/server/appSession");
    const result = await readAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("12 – falscher Tenant → INVALID_TENANT", async () => {
    const wrongTenant = makeSession({ tenantId: "fremd-firma" });
    const token = signAppSession(wrongTenant, TEST_SECRET);
    mockCookieGet.mockImplementation((name: string) =>
      name === COOKIE_NAME ? { name, value: token } : undefined
    );
    const { readAppSession } = await import("@/lib/server/appSession");
    const result = await readAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_TENANT");
  });
});
