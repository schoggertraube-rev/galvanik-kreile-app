import { beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const ports = vi.hoisted(() => ({
  reportProductActorOperationalFailure: vi.fn(),
  resolveLoginIdentityByEmail: vi.fn(),
  setAppSession: vi.fn(),
  clearAppSession: vi.fn(),
  recordUserLastSeenForLogin: vi.fn(),
  signInWithPassword: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/server/productActorReadiness", () => ({
  reportProductActorOperationalFailure: ports.reportProductActorOperationalFailure,
}));
vi.mock("@/lib/server/authorization", () => ({
  resolveLoginIdentityByEmail: ports.resolveLoginIdentityByEmail,
}));
vi.mock("@/lib/server/appSession", () => ({
  setAppSession: ports.setAppSession,
  clearAppSession: ports.clearAppSession,
  SESSION_TTL_MS: 12 * 60 * 60 * 1000,
}));
vi.mock("@/lib/server/userLastSeen", () => ({
  recordUserLastSeenForLogin: ports.recordUserLastSeenForLogin,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: ports.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: ports.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: ports.redirect }));

import { login } from "@/app/actions/auth";

const GREGOR_ID = "33333333-3333-4333-8333-333333333333";

function formData(): FormData {
  const data = new FormData();
  data.set("email", "synthetic-gregor@example.invalid");
  data.set("password", "synthetic-password");
  return data;
}

describe("developer email product login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.reportProductActorOperationalFailure.mockReturnValue(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    ports.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: ports.signInWithPassword,
        getUser: ports.getUser,
        signOut: ports.signOut,
      },
    });
    ports.signInWithPassword.mockResolvedValue({ error: null });
    ports.getUser.mockResolvedValue({
      data: { user: { email: "synthetic-gregor@example.invalid" } },
    });
    ports.resolveLoginIdentityByEmail.mockResolvedValue({
      ok: true,
      data: {
        id: GREGOR_ID,
        tenantId: KREILE_TENANT_SLUG,
        email: "synthetic-gregor@example.invalid",
        fullName: "Technical DB Name",
        role: "developer",
        active: true,
      },
    });
    ports.recordUserLastSeenForLogin.mockResolvedValue({ code: "OK" });
  });

  it("sets the authenticated developer identity before routing to settings", async () => {
    await expect(login(formData())).rejects.toThrow("REDIRECT:/settings");
    expect(ports.setAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: GREGOR_ID,
        tenantId: KREILE_TENANT_SLUG,
        role: "developer",
        displayName: "Technical DB Name",
      }),
    );
    expect(ports.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects admin even when the identity otherwise has settings access", async () => {
    ports.resolveLoginIdentityByEmail.mockResolvedValue({
      ok: true,
      data: {
        id: GREGOR_ID,
        tenantId: KREILE_TENANT_SLUG,
        email: "synthetic-gregor@example.invalid",
        fullName: "Admin",
        role: "admin",
        active: true,
      },
    });

    await expect(login(formData())).rejects.toThrow(
      /REDIRECT:\/start\?.*support=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/,
    );
    expect(ports.signOut).toHaveBeenCalledOnce();
    expect(ports.setAppSession).not.toHaveBeenCalled();
  });

  it("rejects an authenticated role without settings access", async () => {
    ports.resolveLoginIdentityByEmail.mockResolvedValue({
      ok: true,
      data: {
        id: "44444444-4444-4444-8444-444444444444",
        tenantId: KREILE_TENANT_SLUG,
        email: "synthetic-office@example.invalid",
        fullName: "Office",
        role: "buero",
        active: true,
      },
    });

    await expect(login(formData())).rejects.toThrow(
      /REDIRECT:\/start\?.*support=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/,
    );
    expect(ports.signOut).toHaveBeenCalledOnce();
    expect(ports.setAppSession).not.toHaveBeenCalled();
    expect(ports.reportProductActorOperationalFailure).toHaveBeenCalledWith(
      "EMAIL_LOGIN_IDENTITY_MISMATCH",
    );
  });
});
