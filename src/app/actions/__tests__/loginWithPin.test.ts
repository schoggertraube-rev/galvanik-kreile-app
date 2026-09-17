import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  setAppSession: vi.fn(),
  clearAppSession: vi.fn(),
  recordUserLastSeenForLogin: vi.fn(),
  bcryptCompare: vi.fn(),
  bcryptHash: vi.fn(),
  runPinAttempt: vi.fn(),
  dbSelect: vi.fn(),
  dbUpdateWhere: vi.fn(),
  readProductActorReadiness: vi.fn(),
}));

const dbUpdateSet = vi.fn(() => ({ where: ports.dbUpdateWhere }));
const dbUpdate = vi.fn(() => ({ set: dbUpdateSet }));

function handleFor(userId: string): string {
  return `synthetic-handle-${userId}`;
}

vi.mock("bcryptjs", () => ({
  default: { compare: ports.bcryptCompare, hash: ports.bcryptHash },
}));
vi.mock("@/lib/server/pinRateLimit", () => ({
  runPinAttempt: ports.runPinAttempt,
}));
vi.mock("@/lib/server/appSession", () => ({
  APP_TENANT_ID: KREILE_TENANT_SLUG,
  clearAppSession: ports.clearAppSession,
  setAppSession: ports.setAppSession,
  SESSION_TTL_MS: 12 * 60 * 60 * 1000,
}));
vi.mock("@/lib/server/userLastSeen", () => ({
  recordUserLastSeenForLogin: ports.recordUserLastSeenForLogin,
}));
vi.mock("@/lib/server/productActorReadiness", () => ({
  readProductActorReadiness: ports.readProductActorReadiness,
  resolveProductActorAuthorization: vi.fn(),
}));
vi.mock("@/lib/server/pinLoginHandle", () => ({
  isValidPinLoginHandle: (value: unknown) =>
    typeof value === "string" && value.startsWith("synthetic-handle-"),
  resolvePinLoginCandidate: (
    handle: string,
    candidates: PinLoginUser[],
  ) => candidates.find((candidate) => handleFor(candidate.id) === handle),
}));
vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: ports.dbSelect }) }),
    update: dbUpdate,
  },
}));
vi.mock("@/db/schema", () => ({
  appUsers: {
    active: "active",
    id: "id",
    pinHash: "pin_hash",
    role: "role",
    tenantId: "tenant_id",
  },
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
}));

type PinLoginUser = {
  active: boolean;
  id: string;
  pinHash: string | null;
  role: string;
  tenantId: string;
};

function makeUser(overrides: Partial<PinLoginUser> = {}): PinLoginUser {
  return {
    active: true,
    id: "synthetic-phillip-id",
    pinHash: "$2b$10$synthetic-bcrypt-hash",
    role: "werkstatt",
    tenantId: KREILE_TENANT_SLUG,
    ...overrides,
  };
}

function ready(phillipId = "synthetic-phillip-id") {
  return {
    ok: true as const,
    evidenceScope: "RUNTIME_REQUEST" as const,
    actors: {
      rolf: {
        key: "rolf" as const,
        actorId: "synthetic-rolf-id",
        tenantId: KREILE_TENANT_SLUG,
        role: "meister" as const,
        identity: { name: "Rolf" as const, responsibility: "Meister" as const, initials: "R" as const },
        login: "pin" as const,
      },
      phillip: {
        key: "phillip" as const,
        actorId: phillipId,
        tenantId: KREILE_TENANT_SLUG,
        role: "werkstatt" as const,
        identity: { name: "Phillip" as const, responsibility: "Werkstatt" as const, initials: "P" as const },
        login: "pin" as const,
      },
      gregor: {
        key: "gregor" as const,
        actorId: "synthetic-gregor-id",
        tenantId: KREILE_TENANT_SLUG,
        role: "admin" as const,
        identity: { name: "Gregor" as const, responsibility: "Systemadministrator" as const, initials: "G" as const },
        login: "email" as const,
      },
    },
  };
}

describe("loginWithPin() product actor security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.readProductActorReadiness.mockResolvedValue(ready());
    ports.bcryptCompare.mockResolvedValue(true);
    ports.bcryptHash.mockResolvedValue("$2b$10$synthetic-migrated-hash");
    ports.runPinAttempt.mockImplementation(
      async (_operatorId: string, verifyPin: () => Promise<boolean>) =>
        (await verifyPin()) ? { status: "valid" } : { status: "invalid" },
    );
    ports.dbUpdateWhere.mockResolvedValue(undefined);
    ports.setAppSession.mockResolvedValue(undefined);
    ports.clearAppSession.mockResolvedValue(undefined);
    ports.recordUserLastSeenForLogin.mockResolvedValue({
      code: "OK",
      receipt: {},
      replayed: false,
    });
  });

  it("creates a canonical session with the validated product identity", async () => {
    ports.dbSelect.mockResolvedValue([makeUser()]);
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-phillip-id"), "1234"))
      .resolves.toEqual({ ok: true, role: "werkstatt" });
    expect(ports.setAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Phillip",
        role: "werkstatt",
        tenantId: KREILE_TENANT_SLUG,
        userId: "synthetic-phillip-id",
      }),
    );
  });

  it("clears the new session when last-seen confirmation fails", async () => {
    ports.dbSelect.mockResolvedValue([makeUser()]);
    ports.recordUserLastSeenForLogin.mockResolvedValue({ code: "UNAVAILABLE" });
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-phillip-id"), "1234"))
      .resolves.toEqual({
        ok: false,
        message: "Login konnte nicht sicher bestätigt werden.",
      });
    expect(ports.clearAppSession).toHaveBeenCalledOnce();
  });

  it("counts an invalid bcrypt PIN without creating a session", async () => {
    ports.bcryptCompare.mockResolvedValue(false);
    ports.dbSelect.mockResolvedValue([makeUser()]);
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-phillip-id"), "0000"))
      .resolves.toEqual({
        ok: false,
        message: "Ungültige PIN oder inaktiver Benutzer.",
      });
    expect(ports.setAppSession).not.toHaveBeenCalled();
  });

  it("migrates a valid legacy PIN to bcrypt", async () => {
    ports.dbSelect.mockResolvedValue([makeUser({ pinHash: "1234" })]);
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-phillip-id"), "1234"))
      .resolves.toEqual({ ok: true, role: "werkstatt" });
    expect(ports.bcryptHash).toHaveBeenCalledWith("1234", 12);
    expect(dbUpdateSet).toHaveBeenCalledWith({
      pinHash: "$2b$10$synthetic-migrated-hash",
      updatedAt: expect.any(Date),
    });
  });

  it("blocks before PIN comparison when rate limited", async () => {
    ports.dbSelect.mockResolvedValue([makeUser()]);
    ports.runPinAttempt.mockResolvedValue({
      status: "blocked",
      retryAfterMinutes: 15,
    });
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-phillip-id"), "1234"))
      .resolves.toEqual({
        ok: false,
        message: "Zu viele Fehlversuche. Bitte in 15 Minute(n) erneut versuchen.",
      });
    expect(ports.bcryptCompare).not.toHaveBeenCalled();
  });

  it("fails before profile lookup when full actor readiness is unavailable", async () => {
    ports.readProductActorReadiness.mockResolvedValue({
      ok: false,
      evidenceScope: "RUNTIME_REQUEST",
      code: "PROFILE_AMBIGUOUS",
      supportReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-phillip-id"), "1234"))
      .resolves.toEqual({
        ok: false,
        message: "Anmeldung ist momentan nicht sicher verfügbar.",
        supportReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      });
    expect(ports.dbSelect).not.toHaveBeenCalled();
    expect(ports.runPinAttempt).not.toHaveBeenCalled();
  });

  it("rejects a candidate that is not one of the exact PIN product actors", async () => {
    ports.dbSelect.mockResolvedValue([makeUser({ id: "synthetic-unrelated-id" })]);
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-unrelated-id"), "1234"))
      .resolves.toEqual({
        ok: false,
        message: "Ungültige PIN oder inaktiver Benutzer.",
      });
    expect(ports.runPinAttempt).not.toHaveBeenCalled();
  });

  it("rejects raw internal IDs before readiness, database and bcrypt", async () => {
    const { loginWithPin } = await import("@/app/actions/auth.actions");
    await expect(loginWithPin("synthetic-phillip-id", "1234"))
      .resolves.toEqual({
        ok: false,
        message: "Ungültige PIN oder inaktiver Benutzer.",
      });
    expect(ports.readProductActorReadiness).not.toHaveBeenCalled();
    expect(ports.dbSelect).not.toHaveBeenCalled();
  });
});
