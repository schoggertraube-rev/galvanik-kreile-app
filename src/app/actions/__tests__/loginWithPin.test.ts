import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetAppSession = vi.fn();
const mockClearAppSession = vi.fn();
const mockRecordUserLastSeenForLogin = vi.fn();
const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn();
const mockRunPinAttempt = vi.fn();
const mockDbSelect = vi.fn();
const mockDbUpdateWhere = vi.fn();
const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));

function handleFor(userId: string): string {
  return `handle-${userId}`;
}

vi.mock("bcryptjs", () => ({
  default: {
    compare: mockBcryptCompare,
    hash: mockBcryptHash,
  },
}));

vi.mock("@/lib/server/pinRateLimit", () => ({
  runPinAttempt: mockRunPinAttempt,
}));

vi.mock("@/lib/server/appSession", () => ({
  APP_TENANT_ID: KREILE_TENANT_SLUG,
  clearAppSession: mockClearAppSession,
  setAppSession: mockSetAppSession,
  SESSION_TTL_MS: 12 * 60 * 60 * 1000,
}));

vi.mock("@/lib/server/userLastSeen", () => ({
  recordUserLastSeenForLogin: mockRecordUserLastSeenForLogin,
}));

vi.mock("@/lib/server/pinLoginHandle", () => ({
  isValidPinLoginHandle: (value: unknown) =>
    typeof value === "string" && value.startsWith("handle-"),
  resolvePinLoginCandidate: (
    handle: string,
    candidates: PinLoginUser[],
  ) => candidates.find((candidate) => handleFor(candidate.id) === handle),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockDbSelect,
      }),
    }),
    update: mockDbUpdate,
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

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  ne: vi.fn(),
}));

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
    fullName: "Max Mustermann",
    id: "user-abc",
    pinHash: "$2b$10$valid-bcrypt-hash",
    role: "werkstatt",
    tenantId: KREILE_TENANT_SLUG,
    ...overrides,
  };
}

describe("loginWithPin() – PIN-Security (M4: SEC-PIN-002B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBcryptCompare.mockResolvedValue(true);
    mockBcryptHash.mockResolvedValue("$2b$10$migrated-bcrypt-hash");
    mockRunPinAttempt.mockImplementation(
      async (_operatorId: string, verifyPin: () => Promise<boolean>) =>
        (await verifyPin()) ? { status: "valid" } : { status: "invalid" },
    );
    mockDbUpdateWhere.mockResolvedValue(undefined);
    mockSetAppSession.mockResolvedValue(undefined);
    mockClearAppSession.mockResolvedValue(undefined);
    mockRecordUserLastSeenForLogin.mockResolvedValue({
      code: "OK",
      receipt: {},
      replayed: false,
    });
  });

  it("erstellt bei gültigem bcrypt-PIN eine vollständige AppSession", async () => {
    mockDbSelect.mockResolvedValue([makeUser()]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin(handleFor("user-abc"), "1234");

    expect(result).toEqual({ ok: true, role: "werkstatt" });
    expect(mockSetAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Max Mustermann",
        role: "werkstatt",
        tenantId: KREILE_TENANT_SLUG,
        userId: "user-abc",
      }),
    );
    expect(mockRunPinAttempt).toHaveBeenCalledWith(
      "user-abc",
      expect.any(Function),
    );
    expect(mockRecordUserLastSeenForLogin).toHaveBeenCalledOnce();
    expect(mockBcryptHash).not.toHaveBeenCalled();
  });

  it("verwirft die neue Session, wenn der Login-Blick nicht bestätigt wird", async () => {
    mockDbSelect.mockResolvedValue([makeUser()]);
    mockRecordUserLastSeenForLogin.mockResolvedValue({
      code: "UNAVAILABLE",
      message: "Letzter Blick konnte nicht gespeichert werden.",
    });

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    await expect(loginWithPin(handleFor("user-abc"), "1234")).resolves.toEqual({
      ok: false,
      message: "Login konnte nicht sicher bestätigt werden.",
    });
    expect(mockSetAppSession).toHaveBeenCalledOnce();
    expect(mockClearAppSession).toHaveBeenCalledOnce();
  });

  it("verweigert einen fehlenden Anzeigenamen ohne eine Session zu setzen", async () => {
    mockDbSelect.mockResolvedValue([makeUser({ fullName: "   " })]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin(handleFor("user-abc"), "1234");

    expect(result).toEqual({
      ok: false,
      message: "Kein Anzeigename für diesen Benutzer konfiguriert. Bitte Administrator kontaktieren.",
    });
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("zählt einen falschen bcrypt-PIN als Fehlversuch", async () => {
    mockBcryptCompare.mockResolvedValue(false);
    mockDbSelect.mockResolvedValue([makeUser()]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin(handleFor("user-abc"), "0000");

    expect(result).toEqual({ ok: false, message: "Ungültige PIN oder inaktiver Benutzer." });
    expect(mockRunPinAttempt).toHaveBeenCalledWith(
      "user-abc",
      expect.any(Function),
    );
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("migriert einen gültigen Legacy-Klartext-PIN transparent zu bcrypt", async () => {
    mockDbSelect.mockResolvedValue([makeUser({ pinHash: "1234" })]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin(handleFor("user-abc"), "1234");

    expect(result).toEqual({ ok: true, role: "werkstatt" });
    expect(mockBcryptCompare).not.toHaveBeenCalled();
    expect(mockBcryptHash).toHaveBeenCalledWith("1234", 12);
    expect(mockDbUpdateSet).toHaveBeenCalledWith({
      pinHash: "$2b$10$migrated-bcrypt-hash",
      updatedAt: expect.any(Date),
    });
    expect(mockRunPinAttempt).toHaveBeenCalledWith(
      "user-abc",
      expect.any(Function),
    );
  });

  it("blockiert den Login nach fünf Fehlversuchen vor dem PIN-Vergleich", async () => {
    mockDbSelect.mockResolvedValue([makeUser()]);
    mockRunPinAttempt.mockResolvedValue({
      status: "blocked",
      retryAfterMinutes: 15,
    });

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin(handleFor("user-abc"), "1234");

    expect(result).toEqual({
      ok: false,
      message: "Zu viele Fehlversuche. Bitte in 15 Minute(n) erneut versuchen.",
    });
    expect(mockDbSelect).toHaveBeenCalledOnce();
    expect(mockBcryptCompare).not.toHaveBeenCalled();
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("setzt den Fehlversuchszähler nach erfolgreichem Login zurück", async () => {
    mockDbSelect.mockResolvedValue([makeUser({ id: "user-success" })]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin(handleFor("user-success"), "1234");

    expect(result).toEqual({ ok: true, role: "werkstatt" });
    expect(mockRunPinAttempt).toHaveBeenCalledTimes(1);
    expect(mockRunPinAttempt).toHaveBeenCalledWith(
      "user-success",
      expect.any(Function),
    );
  });

  it("verwirft rohe interne Benutzer-IDs vor Datenbank und bcrypt", async () => {
    const { loginWithPin } = await import("@/app/actions/auth.actions");

    await expect(loginWithPin("user-abc", "1234")).resolves.toEqual({
      ok: false,
      message: "Ungültige PIN oder inaktiver Benutzer.",
    });

    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockRunPinAttempt).not.toHaveBeenCalled();
    expect(mockBcryptCompare).not.toHaveBeenCalled();
  });
});
