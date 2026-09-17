import { beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const ports = vi.hoisted(() => ({
  readProductActorReadiness: vi.fn(),
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
  readProductActorReadiness: ports.readProductActorReadiness,
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

const ready = {
  ok: true as const,
  evidenceScope: "RUNTIME_REQUEST" as const,
  actors: {
    rolf: {
      key: "rolf" as const,
      actorId: "11111111-1111-4111-8111-111111111111",
      tenantId: KREILE_TENANT_SLUG,
      role: "meister" as const,
      identity: { name: "Rolf" as const, responsibility: "Meister" as const, initials: "R" as const },
      login: "pin" as const,
    },
    phillip: {
      key: "phillip" as const,
      actorId: "22222222-2222-4222-8222-222222222222",
      tenantId: KREILE_TENANT_SLUG,
      role: "werkstatt" as const,
      identity: { name: "Phillip" as const, responsibility: "Werkstatt" as const, initials: "P" as const },
      login: "pin" as const,
    },
    gregor: {
      key: "gregor" as const,
      actorId: GREGOR_ID,
      tenantId: KREILE_TENANT_SLUG,
      role: "admin" as const,
      identity: { name: "Gregor" as const, responsibility: "Systemadministrator" as const, initials: "G" as const },
      login: "email" as const,
    },
  },
};

function formData(): FormData {
  const data = new FormData();
  data.set("email", "synthetic-gregor@example.invalid");
  data.set("password", "synthetic-password");
  return data;
}

describe("Gregor email product login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.readProductActorReadiness.mockResolvedValue(ready);
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
        role: "admin",
        active: true,
      },
    });
    ports.recordUserLastSeenForLogin.mockResolvedValue({ code: "OK" });
  });

  it("sets the exact Gregor actor and canonical identity before routing to settings", async () => {
    await expect(login(formData())).rejects.toThrow("REDIRECT:/settings");
    expect(ports.setAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: GREGOR_ID,
        tenantId: KREILE_TENANT_SLUG,
        role: "admin",
        displayName: "Gregor",
      }),
    );
    expect(ports.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("fails before remote login when three-profile readiness is unavailable", async () => {
    ports.readProductActorReadiness.mockResolvedValue({
      ok: false,
      evidenceScope: "RUNTIME_REQUEST",
      code: "CONFIG_DUPLICATE",
      supportReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    await expect(login(formData())).rejects.toThrow(
      /REDIRECT:\/start\?.*support=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/,
    );
    expect(ports.createClient).not.toHaveBeenCalled();
    expect(ports.setAppSession).not.toHaveBeenCalled();
  });

  it("rejects another active admin instead of treating role as Gregor identity", async () => {
    ports.resolveLoginIdentityByEmail.mockResolvedValue({
      ok: true,
      data: {
        id: "44444444-4444-4444-8444-444444444444",
        tenantId: KREILE_TENANT_SLUG,
        email: "synthetic-other-admin@example.invalid",
        fullName: "Other Admin",
        role: "admin",
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
