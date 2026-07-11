/**
 * appSession.test.ts
 *
 * Datenbankfreie Unit-Tests fuer den kanonischen App-Session-Vertrag (S3A).
 * Web Crypto (async), Payload { uid, role, tenant, initials, exp }, Secret aus
 * KREILE_SESSION_SECRET. Kein Netzwerk, keine echten Secrets, kein Supabase.
 *
 * Abgedeckt: gueltig, manipuliert, falsche Signatur, abgelaufen, falscher Tenant,
 * MALFORMED, Konstanten und readAppSession() mit gemocktem Cookie.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  signAppSession,
  verifyAppSessionToken,
  COOKIE_NAME,
  SESSION_TTL_MS,
  type AppSession,
} from "@/lib/server/appSession";

const TEST_SECRET = "test-secret-only-for-unit-tests-not-production";
process.env.KREILE_SESSION_SECRET = TEST_SECRET;

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

function makeSession(overrides?: Partial<AppSession>): AppSession {
  return {
    uid: "user-123",
    role: "werkstatt",
    tenant: "galvanik-kreile",
    initials: "HM",
    exp: Date.now() + 60 * 60 * 1000,
    ...overrides,
  };
}

function base64Url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

describe("signAppSession + verifyAppSessionToken – pure Web-Crypto", () => {
  it("1 – gueltiger Token: signieren und verifizieren", async () => {
    const token = await signAppSession(makeSession(), TEST_SECRET);
    const result = await verifyAppSessionToken(token, TEST_SECRET);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.uid).toBe("user-123");
      expect(result.session.role).toBe("werkstatt");
      expect(result.session.initials).toBe("HM");
      expect(result.session.tenant).toBe("galvanik-kreile");
    }
  });

  it("2 – manipulierte Payload mit Original-Signatur -> INVALID_SIGNATURE", async () => {
    const session = makeSession();
    const originalToken = await signAppSession(session, TEST_SECRET);
    const originalSig = originalToken.slice(originalToken.indexOf(".") + 1);

    const tampered = { ...session, role: "admin" };
    const tamperedToken = `${base64Url(tampered)}.${originalSig}`;

    const result = await verifyAppSessionToken(tamperedToken, TEST_SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("3 – falsche Signatur -> INVALID_SIGNATURE", async () => {
    const token = await signAppSession(makeSession(), TEST_SECRET);
    const payloadPart = token.slice(0, token.indexOf("."));
    const badToken = `${payloadPart}.AAAABBBBCCCCDDDD`;

    const result = await verifyAppSessionToken(badToken, TEST_SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("4 – abgelaufene Session -> EXPIRED", async () => {
    const now = Date.now();
    const token = await signAppSession(makeSession({ exp: now - 1000 }), TEST_SECRET);

    const result = await verifyAppSessionToken(token, TEST_SECRET, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("5 – falscher Tenant -> INVALID_TENANT", async () => {
    const token = await signAppSession(makeSession({ tenant: "fremdfirma-xyz" }), TEST_SECRET);

    const result = await verifyAppSessionToken(token, TEST_SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_TENANT");
  });

  it("6 – MALFORMED: kein Punkt-Separator", async () => {
    const result = await verifyAppSessionToken("ohnetrennzeichen", TEST_SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MALFORMED");
  });

  it("6b – MALFORMED: kein Inhalt vor dem Punkt", async () => {
    const result = await verifyAppSessionToken(".nurSignatur", TEST_SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MALFORMED");
  });

  it("6c – falsches Secret -> INVALID_SIGNATURE", async () => {
    const token = await signAppSession(makeSession(), TEST_SECRET);
    const result = await verifyAppSessionToken(token, "anderes-secret");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_SIGNATURE");
  });
});

describe("Konstanten", () => {
  it("7a – COOKIE_NAME ist 'kreile_app_session'", () => {
    expect(COOKIE_NAME).toBe("kreile_app_session");
  });

  it("7b – SESSION_TTL_MS ist 12 Stunden", () => {
    expect(SESSION_TTL_MS).toBe(12 * 60 * 60 * 1000);
  });
});

describe("readAppSession() – Cookie-Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("8 – kein Cookie -> NO_COOKIE", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { readAppSession } = await import("@/lib/server/appSession");
    const result = await readAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NO_COOKIE");
  });

  it("9 – gueltiger Token -> ok: true, Session", async () => {
    const token = await signAppSession(makeSession(), TEST_SECRET);
    mockCookieGet.mockImplementation((name: string) =>
      name === COOKIE_NAME ? { name, value: token } : undefined,
    );
    const { readAppSession } = await import("@/lib/server/appSession");
    const result = await readAppSession();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.uid).toBe("user-123");
      expect(result.session.initials).toBe("HM");
    }
  });

  it("10 – manipulierte Signatur -> INVALID_SIGNATURE", async () => {
    const token = `${base64Url(makeSession())}.AAAABBBBCCCCDDDD`;
    mockCookieGet.mockImplementation((name: string) =>
      name === COOKIE_NAME ? { name, value: token } : undefined,
    );
    const { readAppSession } = await import("@/lib/server/appSession");
    const result = await readAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("11 – abgelaufene Session -> EXPIRED", async () => {
    const token = await signAppSession(makeSession({ exp: Date.now() - 1000 }), TEST_SECRET);
    mockCookieGet.mockImplementation((name: string) =>
      name === COOKIE_NAME ? { name, value: token } : undefined,
    );
    const { readAppSession } = await import("@/lib/server/appSession");
    const result = await readAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("12 – falscher Tenant -> INVALID_TENANT", async () => {
    const token = await signAppSession(makeSession({ tenant: "fremd-firma" }), TEST_SECRET);
    mockCookieGet.mockImplementation((name: string) =>
      name === COOKIE_NAME ? { name, value: token } : undefined,
    );
    const { readAppSession } = await import("@/lib/server/appSession");
    const result = await readAppSession();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_TENANT");
  });
});
