import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COOKIE_NAME,
  SESSION_TTL_MS,
  getSessionSecret,
  signAppSession,
  verifyAppSessionToken,
  type AppSession,
} from "@/lib/server/appSession";

const TEST_SECRET = "test-secret-only-for-unit-tests-not-production";
process.env.KREILE_SESSION_SECRET = TEST_SECRET;

afterEach(() => vi.unstubAllEnvs());

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

function session(overrides: Partial<AppSession> = {}): AppSession {
  const now = Date.now();
  return {
    userId: "user-123",
    tenantId: "galvanik-kreile",
    role: "werkstatt",
    displayName: "Hans Meister",
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    ...overrides,
  };
}

describe("app session token", () => {
  it("signs and verifies a valid token", async () => {
    const token = await signAppSession(session(), TEST_SECRET);
    const result = await verifyAppSessionToken(token, TEST_SECRET);
    expect(result).toMatchObject({ ok: true, session: { userId: "user-123" } });
  });

  it("rejects payload tampering", async () => {
    const token = await signAppSession(session(), TEST_SECRET);
    const [, signature] = token.split(".");
    const changedPayload = Buffer.from(JSON.stringify(session({ role: "admin" })))
      .toString("base64url");
    await expect(verifyAppSessionToken(`${changedPayload}.${signature}`, TEST_SECRET))
      .resolves.toEqual({ ok: false, reason: "INVALID_SIGNATURE" });
  });

  it("rejects malformed, expired, and foreign-tenant tokens", async () => {
    await expect(verifyAppSessionToken("malformed", TEST_SECRET))
      .resolves.toEqual({ ok: false, reason: "MALFORMED" });
    const expired = await signAppSession(session({ expiresAt: Date.now() - 1 }), TEST_SECRET);
    await expect(verifyAppSessionToken(expired, TEST_SECRET))
      .resolves.toEqual({ ok: false, reason: "EXPIRED" });
    const foreign = await signAppSession(session({ tenantId: "foreign" }), TEST_SECRET);
    await expect(verifyAppSessionToken(foreign, TEST_SECRET))
      .resolves.toEqual({ ok: false, reason: "INVALID_TENANT" });
  });

  it("uses the canonical cookie constants", () => {
    expect(COOKIE_NAME).toBe("kreile_app_session");
    expect(SESSION_TTL_MS).toBe(12 * 60 * 60 * 1_000);
  });

  it("fails closed for session secrets shorter than 32 UTF-8 bytes", async () => {
    vi.stubEnv("KREILE_SESSION_SECRET", "too-short");
    expect(() => getSessionSecret()).toThrow("at least 32 UTF-8 bytes");
    await expect(signAppSession(session(), "too-short"))
      .rejects.toThrow("at least 32 UTF-8 bytes");
  });
});

describe("readAppSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns NO_COOKIE when absent", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { readAppSession } = await import("@/lib/server/appSession");
    await expect(readAppSession()).resolves.toEqual({ ok: false, reason: "NO_COOKIE" });
  });

  it("verifies the cookie before returning the session", async () => {
    const token = await signAppSession(session(), TEST_SECRET);
    mockCookieGet.mockReturnValue({ name: COOKIE_NAME, value: token });
    const { readAppSession } = await import("@/lib/server/appSession");
    await expect(readAppSession()).resolves.toMatchObject({
      ok: true,
      session: { userId: "user-123", tenantId: "galvanik-kreile" },
    });
  });
});
