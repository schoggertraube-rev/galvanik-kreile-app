import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckAppAuthorization = vi.fn();
const mockCreateSupabaseClient = vi.fn();
const mockCreateServerClient = vi.fn();
const mockCookies = vi.fn();

vi.mock("@/lib/server/authHelper", () => ({
  checkAppAuthorization: mockCheckAppAuthorization,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateSupabaseClient,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

describe("authorized Supabase server data client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    mockCreateSupabaseClient.mockReturnValue({ kind: "data-client" });
    mockCreateServerClient.mockReturnValue({ kind: "session-client" });
    mockCookies.mockResolvedValue({
      getAll: vi.fn(() => []),
      set: vi.fn(),
    });
  });

  it("fails closed before creating a privileged client", async () => {
    mockCheckAppAuthorization.mockResolvedValue({
      ok: false,
      error: "UNAUTHORIZED",
      message: "AUTH_ERROR: Nicht angemeldet",
    });
    const { createAuthorizedDataClient } = await import("@/lib/supabase/server");

    await expect(createAuthorizedDataClient("read")).rejects.toThrow(
      "AUTH_ERROR: Nicht angemeldet",
    );
    expect(mockCreateSupabaseClient).not.toHaveBeenCalled();
  });

  it("checks the requested access mode before using the server-only key", async () => {
    mockCheckAppAuthorization.mockResolvedValue({
      ok: true,
      data: {
        userId: "223e4567-e89b-12d3-a456-426614174001",
        tenantId: "galvanik-kreile",
        displayName: "Max Kreile",
        role: "meister",
        permissions: [],
        active: true,
      },
    });
    const { createAuthorizedDataClient } = await import("@/lib/supabase/server");

    await expect(createAuthorizedDataClient("write")).resolves.toEqual({
      kind: "data-client",
    });
    expect(mockCheckAppAuthorization).toHaveBeenCalledWith("write");
    expect(mockCreateSupabaseClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-test-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  });

  it("returns the canonical app identity with the privileged client", async () => {
    const authorization = {
      userId: "223e4567-e89b-12d3-a456-426614174001",
      tenantId: "galvanik-kreile",
      displayName: "Max Kreile",
      role: "meister",
      permissions: [],
      active: true,
    };
    mockCheckAppAuthorization.mockResolvedValue({
      ok: true,
      data: authorization,
    });
    const { createAuthorizedDataContext } = await import("@/lib/supabase/server");

    await expect(createAuthorizedDataContext("write")).resolves.toEqual({
      client: { kind: "data-client" },
      authorization,
    });
  });

  it("authorizes before creating a session-bound client", async () => {
    const authorization = {
      userId: "223e4567-e89b-12d3-a456-426614174001",
      tenantId: "galvanik-kreile",
      displayName: "Max Kreile",
      role: "meister",
      permissions: [],
      active: true,
    };
    mockCheckAppAuthorization.mockResolvedValue({
      ok: true,
      data: authorization,
    });
    const { createAuthorizedSessionContext } = await import("@/lib/supabase/server");

    await expect(createAuthorizedSessionContext("write")).resolves.toEqual({
      client: { kind: "session-client" },
      authorization,
    });
    expect(mockCheckAppAuthorization).toHaveBeenCalledWith("write");
    expect(mockCreateServerClient).toHaveBeenCalledOnce();
  });

  it("does not fall back to a browser key when server configuration is missing", async () => {
    mockCheckAppAuthorization.mockResolvedValue({
      ok: true,
      data: {
        userId: "223e4567-e89b-12d3-a456-426614174001",
        tenantId: "galvanik-kreile",
        displayName: "Max Kreile",
        role: "meister",
        permissions: [],
        active: true,
      },
    });
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { createAuthorizedDataClient } = await import("@/lib/supabase/server");

    await expect(createAuthorizedDataClient("read")).rejects.toThrow(
      "Serverseitiger Supabase-Datenzugriff ist nicht konfiguriert.",
    );
    expect(mockCreateSupabaseClient).not.toHaveBeenCalled();
  });
});
