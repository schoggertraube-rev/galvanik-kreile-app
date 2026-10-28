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
}));

const dbUpdateSet = vi.fn(() => ({ where: ports.dbUpdateWhere }));
const dbUpdate = vi.fn(() => ({ set: dbUpdateSet }));

function handleFor(userId: string): string {
  return `synthetic-handle-${userId}`;
}

vi.mock("bcryptjs", () => ({
  default: { compare: ports.bcryptCompare, hash: ports.bcryptHash },
}));
vi.mock("@/lib/server/pinRateLimit", () => ({ runPinAttempt: ports.runPinAttempt }));
vi.mock("@/lib/server/appSession", () => ({
  APP_TENANT_ID: KREILE_TENANT_SLUG,
  clearAppSession: ports.clearAppSession,
  setAppSession: ports.setAppSession,
  SESSION_TTL_MS: 12 * 60 * 60 * 1000,
}));
vi.mock("@/lib/server/userLastSeen", () => ({
  recordUserLastSeenForLogin: ports.recordUserLastSeenForLogin,
}));
vi.mock("@/lib/server/pinLoginHandle", () => ({
  isValidPinLoginHandle: (value: unknown) =>
    typeof value === "string" && value.startsWith("synthetic-handle-"),
  resolvePinLoginCandidate: (handle: string, candidates: PinLoginUser[]) =>
    candidates.find((candidate) => handleFor(candidate.id) === handle),
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
    fullName: "full_name",
    id: "id",
    pinHash: "pin_hash",
    role: "role",
    tenantId: "tenant_id",
  },
}));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn() }));

type PinLoginUser = {
  active: boolean;
  fullName: string;
  id: string;
  pinHash: string | null;
  role: string;
  tenantId: string;
};

function makeUser(overrides: Partial<PinLoginUser> = {}): PinLoginUser {
  return {
    active: true,
    fullName: "Phillip",
    id: "synthetic-phillip-id",
    pinHash: "$2b$10$synthetic-bcrypt-hash",
    role: "werkstatt",
    tenantId: KREILE_TENANT_SLUG,
    ...overrides,
  };
}

describe("loginWithPin() active app user security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.bcryptCompare.mockResolvedValue(true);
    ports.bcryptHash.mockResolvedValue("$2b$10$synthetic-migrated-hash");
    ports.runPinAttempt.mockImplementation(
      async (_operatorId: string, verifyPin: () => Promise<boolean>) =>
        (await verifyPin()) ? { status: "valid" } : { status: "invalid" },
    );
    ports.dbUpdateWhere.mockResolvedValue(undefined);
    ports.setAppSession.mockResolvedValue(undefined);
    ports.clearAppSession.mockResolvedValue(undefined);
    ports.recordUserLastSeenForLogin.mockResolvedValue({ code: "OK", receipt: {}, replayed: false });
  });

  it("creates a session from the validated database identity", async () => {
    ports.dbSelect.mockResolvedValue([makeUser()]);
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-phillip-id"), "1234"))
      .resolves.toEqual({ ok: true, role: "werkstatt" });
    expect(ports.setAppSession).toHaveBeenCalledWith(expect.objectContaining({
      displayName: "Phillip",
      role: "werkstatt",
      tenantId: KREILE_TENANT_SLUG,
      userId: "synthetic-phillip-id",
    }));
  });

  it("clears the new session when last-seen confirmation fails", async () => {
    ports.dbSelect.mockResolvedValue([makeUser()]);
    ports.recordUserLastSeenForLogin.mockResolvedValue({ code: "UNAVAILABLE" });
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-phillip-id"), "1234"))
      .resolves.toEqual({ ok: false, message: "Login konnte nicht sicher bestätigt werden." });
    expect(ports.clearAppSession).toHaveBeenCalledOnce();
  });

  it("counts an invalid bcrypt PIN without creating a session", async () => {
    ports.bcryptCompare.mockResolvedValue(false);
    ports.dbSelect.mockResolvedValue([makeUser()]);
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-phillip-id"), "0000"))
      .resolves.toEqual({ ok: false, message: "Code falsch · bitte neu eingeben" });
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
    ports.runPinAttempt.mockResolvedValue({ status: "blocked", retryAfterMinutes: 15 });
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-phillip-id"), "1234"))
      .resolves.toEqual({
        ok: false,
        message: "Zu viele Fehlversuche. Bitte in 15 Minute(n) erneut versuchen.",
      });
    expect(ports.bcryptCompare).not.toHaveBeenCalled();
  });

  it("accepts every active tenant app user instead of a hard-coded actor list", async () => {
    ports.dbSelect.mockResolvedValue([makeUser({
      id: "synthetic-unrelated-id",
      fullName: "Neue Nutzerin",
    })]);
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin(handleFor("synthetic-unrelated-id"), "1234"))
      .resolves.toEqual({ ok: true, role: "werkstatt" });
    expect(ports.setAppSession).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Neue Nutzerin" }),
    );
  });

  it("rejects raw internal IDs before database and bcrypt", async () => {
    const { loginWithPin } = await import("@/app/actions/auth.actions");
    await expect(loginWithPin("synthetic-phillip-id", "1234"))
      .resolves.toEqual({ ok: false, message: "Code falsch · bitte neu eingeben" });
    expect(ports.dbSelect).not.toHaveBeenCalled();
  });
});
