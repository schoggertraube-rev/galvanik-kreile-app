import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { signAppSession, type AppSession } from "@/lib/server/appSession";

const TEST_SECRET = "proxy-regression-test-secret";

const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

function request(path: string, cookie?: string) {
  return new NextRequest(`https://werkstatt.example${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

function validSession(): AppSession {
  const now = Date.now();
  return {
    userId: "user-1",
    tenantId: "galvanik-kreile",
    role: "werkstatt",
    displayName: "Philipp Werkstatt",
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
  };
}

function expectRedirectToStart(response: Response) {
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(
    "https://werkstatt.example/start",
  );
}

describe("proxy auth boundary", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubEnv("APP_SESSION_SECRET", TEST_SECRET);
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("redirects an anonymous protected request to /start", async () => {
    const { proxy } = await import("@/proxy");
    expectRedirectToStart(await proxy(request("/")));
  });

  it("matches protected pages and API routes", async () => {
    const { config } = await import("@/proxy");

    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "https://werkstatt.example/warendurchlauf",
      }),
    ).toBe(true);
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "https://werkstatt.example/api/users",
      }),
    ).toBe(true);
  });

  it("rejects and expires the legacy bypass cookie", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(request("/", "bypass-auth=true"));

    expectRedirectToStart(response);
    expect(response.headers.get("set-cookie")).toContain("bypass-auth=");
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it("rejects and expires a forged app-session cookie", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(
      request("/", "kreile_app_session=forged"),
    );

    expectRedirectToStart(response);
    expect(response.headers.get("set-cookie")).toContain(
      "kreile_app_session=",
    );
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it("rejects expired and wrong-tenant signed app sessions", async () => {
    const { proxy } = await import("@/proxy");
    const now = Date.now();
    const expired = signAppSession(
      { ...validSession(), expiresAt: now - 1 },
      TEST_SECRET,
    );
    const wrongTenant = signAppSession(
      { ...validSession(), tenantId: "other-tenant" },
      TEST_SECRET,
    );

    expectRedirectToStart(
      await proxy(request("/", `kreile_app_session=${expired}`)),
    );
    expectRedirectToStart(
      await proxy(request("/", `kreile_app_session=${wrongTenant}`)),
    );
  });

  it("returns 401 JSON for unauthenticated API requests", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(
      request("/api/erfassung/customer-search?q=kr"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
    expect(response.headers.get("location")).toBeNull();
  });

  it("cleans an invalid app session on the public start route", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(
      request("/start", "kreile_app_session=forged; bypass-auth=true"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("bypass-auth=");
    expect(response.headers.get("set-cookie")).toContain(
      "kreile_app_session=",
    );
  });

  it("preserves access for a valid signed app session", async () => {
    const { proxy } = await import("@/proxy");
    const token = signAppSession(validSession(), TEST_SECRET);
    const response = await proxy(
      request("/", `kreile_app_session=${token}`),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not treat a Supabase identity as the canonical app session", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "supabase-user-1" } },
    });
    const { proxy } = await import("@/proxy");
    const response = await proxy(
      request("/", "sb-project-auth-token=supabase-session"),
    );

    expectRedirectToStart(response);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});
