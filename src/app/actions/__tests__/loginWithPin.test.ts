import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetAppSession = vi.fn();
const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn();
const mockCheckPinRateLimit = vi.fn();
const mockRecordFailedPinAttempt = vi.fn();
const mockResetPinRateLimit = vi.fn();
const mockDbSelect = vi.fn();
const mockDbUpdateWhere = vi.fn();
const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));

vi.mock("bcryptjs", () => ({
  default: {
    compare: mockBcryptCompare,
    hash: mockBcryptHash,
  },
}));

vi.mock("@/lib/server/pinRateLimit", () => ({
  checkPinRateLimit: mockCheckPinRateLimit,
  recordFailedPinAttempt: mockRecordFailedPinAttempt,
  resetPinRateLimit: mockResetPinRateLimit,
}));

vi.mock("@/lib/server/appSession", () => ({
  setAppSession: mockSetAppSession,
  SESSION_TTL_MS: 12 * 60 * 60 * 1000,
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
    id: "id",
    tenantId: "tenant_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
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
    tenantId: "galvanik-kreile",
    ...overrides,
  };
}

describe("loginWithPin() – PIN-Security (M4: SEC-PIN-002B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBcryptCompare.mockResolvedValue(true);
    mockBcryptHash.mockResolvedValue("$2b$10$migrated-bcrypt-hash");
    mockCheckPinRateLimit.mockResolvedValue({ allowed: true });
    mockDbUpdateWhere.mockResolvedValue(undefined);
    mockRecordFailedPinAttempt.mockResolvedValue(undefined);
    mockResetPinRateLimit.mockResolvedValue(undefined);
    mockSetAppSession.mockResolvedValue(undefined);
  });

  it("erstellt bei gültigem bcrypt-PIN eine vollständige AppSession", async () => {
    mockDbSelect.mockResolvedValue([makeUser()]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("user-abc", "1234");

    expect(result).toEqual({ ok: true, role: "werkstatt" });
    expect(mockSetAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Max Mustermann",
        role: "werkstatt",
        tenantId: "galvanik-kreile",
        userId: "user-abc",
      }),
    );
    expect(mockResetPinRateLimit).toHaveBeenCalledWith("user-abc");
    expect(mockBcryptHash).not.toHaveBeenCalled();
  });

  it("verweigert einen fehlenden Anzeigenamen ohne eine Session zu setzen", async () => {
    mockDbSelect.mockResolvedValue([makeUser({ fullName: "   " })]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("user-abc", "1234");

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
    const result = await loginWithPin("user-abc", "0000");

    expect(result).toEqual({ ok: false, message: "Ungültige PIN oder inaktiver Benutzer." });
    expect(mockRecordFailedPinAttempt).toHaveBeenCalledWith("user-abc");
    expect(mockResetPinRateLimit).not.toHaveBeenCalled();
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("migriert einen gültigen Legacy-Klartext-PIN transparent zu bcrypt", async () => {
    mockDbSelect.mockResolvedValue([makeUser({ pinHash: "1234" })]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("user-abc", "1234");

    expect(result).toEqual({ ok: true, role: "werkstatt" });
    expect(mockBcryptCompare).not.toHaveBeenCalled();
    expect(mockBcryptHash).toHaveBeenCalledWith("1234", 10);
    expect(mockDbUpdateSet).toHaveBeenCalledWith({
      pinHash: "$2b$10$migrated-bcrypt-hash",
    });
    expect(mockResetPinRateLimit).toHaveBeenCalledWith("user-abc");
  });

  it("blockiert den Login nach fünf Fehlversuchen vor dem PIN-Vergleich", async () => {
    mockCheckPinRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterMinutes: 15,
    });

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("user-abc", "1234");

    expect(result).toEqual({
      ok: false,
      message: "Zu viele Fehlversuche. Bitte in 15 Minute(n) erneut versuchen.",
    });
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockBcryptCompare).not.toHaveBeenCalled();
    expect(mockRecordFailedPinAttempt).not.toHaveBeenCalled();
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("setzt den Fehlversuchszähler nach erfolgreichem Login zurück", async () => {
    mockDbSelect.mockResolvedValue([makeUser({ id: "user-success" })]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("user-success", "1234");

    expect(result).toEqual({ ok: true, role: "werkstatt" });
    expect(mockResetPinRateLimit).toHaveBeenCalledTimes(1);
    expect(mockResetPinRateLimit).toHaveBeenCalledWith("user-success");
  });
});
