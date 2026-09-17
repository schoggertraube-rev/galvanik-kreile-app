import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const ports = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  dbWhere: vi.fn(),
  inArray: vi.fn(() => "synthetic-in-array-condition"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: ports.resolveAuthorization,
}));
vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: ports.dbWhere }) }),
  },
}));
vi.mock("@/db/schema", () => ({
  appUsers: {
    id: "id",
    tenantId: "tenant_id",
    role: "role",
    active: "active",
  },
}));
vi.mock("drizzle-orm", () => ({ inArray: ports.inArray }));

import { resolveProductActorAuthorization } from "../productActorReadiness";

const ACTORS = {
  rolf: "11111111-1111-4111-8111-111111111111",
  phillip: "22222222-2222-4222-8222-222222222222",
  gregor: "33333333-3333-4333-8333-333333333333",
} as const;

const profiles = [
  { id: ACTORS.rolf, tenantId: KREILE_TENANT_SLUG, role: "meister", active: true },
  { id: ACTORS.phillip, tenantId: KREILE_TENANT_SLUG, role: "werkstatt", active: true },
  { id: ACTORS.gregor, tenantId: KREILE_TENANT_SLUG, role: "admin", active: true },
];

function authorization(
  userId: string = ACTORS.rolf,
  role: "meister" | "werkstatt" | "admin" = "meister",
) {
  return {
    ok: true as const,
    data: {
      userId,
      tenantId: KREILE_TENANT_SLUG,
      displayName: "Technical DB Name",
      role,
      permissions: ["perm_view_leitstand"] as const,
      active: true as const,
    },
  };
}

describe("resolveProductActorAuthorization() choke point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("KREILE_ROLF_APP_USER_ID", ACTORS.rolf);
    vi.stubEnv("KREILE_PHILLIP_APP_USER_ID", ACTORS.phillip);
    vi.stubEnv("KREILE_GREGOR_APP_USER_ID", ACTORS.gregor);
    ports.resolveAuthorization.mockResolvedValue(authorization());
    ports.dbWhere.mockResolvedValue(profiles);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns the exact actor and canonical product identity", async () => {
    const result = await resolveProductActorAuthorization();
    expect(result).toMatchObject({
      ok: true,
      data: {
        authorization: { role: "meister", displayName: "Rolf" },
        actor: { key: "rolf", role: "meister" },
      },
    });
    expect(ports.inArray).toHaveBeenCalledWith("id", [
      ACTORS.rolf,
      ACTORS.phillip,
      ACTORS.gregor,
    ]);
  });

  it("does not query readiness for an absent session", async () => {
    ports.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "not signed in",
    });
    await expect(resolveProductActorAuthorization()).resolves.toMatchObject({
      ok: false,
      reason: "NO_SESSION",
    });
    expect(ports.dbWhere).not.toHaveBeenCalled();
  });

  it("fails closed when the valid technical session is not an exact product actor", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    ports.resolveAuthorization.mockResolvedValue(
      authorization("44444444-4444-4444-8444-444444444444"),
    );

    const result = await resolveProductActorAuthorization();
    expect(result).toMatchObject({
      ok: false,
      reason: "SESSION_ACTOR_NOT_CONFIGURED",
    });
    const logs = consoleError.mock.calls.flat().join(" ");
    expect(logs).toContain("PRODUCT_ACTOR_AUTHORIZATION_FAILED");
    expect(logs).not.toContain("44444444-4444-4444-8444-444444444444");
    expect(logs).not.toContain(ACTORS.rolf);
  });

  it("fails closed when the session role differs from the configured actor role", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    ports.resolveAuthorization.mockResolvedValue(
      authorization(ACTORS.rolf, "werkstatt"),
    );

    await expect(resolveProductActorAuthorization()).resolves.toMatchObject({
      ok: false,
      reason: "SESSION_ACTOR_ROLE_MISMATCH",
    });
    expect(consoleError.mock.calls.flat().join(" ")).toContain(
      "SESSION_ACTOR_ROLE_MISMATCH",
    );
  });

  it("fails closed and logs no configured values when configuration is partial", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("KREILE_PHILLIP_APP_USER_ID", "");

    const result = await resolveProductActorAuthorization();
    expect(result).toMatchObject({
      ok: false,
      reason: "ACTOR_READINESS_UNAVAILABLE",
    });
    expect(ports.dbWhere).not.toHaveBeenCalled();
    const logs = consoleError.mock.calls.flat().join(" ");
    expect(logs).toContain("CONFIG_PARTIAL");
    expect(logs).not.toContain(ACTORS.rolf);
    expect(logs).not.toContain(ACTORS.gregor);
  });

  it("fails closed without querying profiles when configuration is not a UUID", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("KREILE_ROLF_APP_USER_ID", "not-a-uuid");

    await expect(resolveProductActorAuthorization()).resolves.toMatchObject({
      ok: false,
      reason: "ACTOR_READINESS_UNAVAILABLE",
    });
    expect(ports.dbWhere).not.toHaveBeenCalled();
    expect(consoleError.mock.calls.flat().join(" ")).toContain("CONFIG_INVALID");
  });
});
