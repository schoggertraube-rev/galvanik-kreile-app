import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCompare,
  mockSetAppSession,
  mockDbSelect,
  mockVerifySelector,
  mockReservePinLoginAttempt,
  mockResetPinLoginAttempts,
} = vi.hoisted(() => ({
  mockCompare: vi.fn(),
  mockSetAppSession: vi.fn(),
  mockDbSelect: vi.fn(),
  mockVerifySelector: vi.fn(),
  mockReservePinLoginAttempt: vi.fn(),
  mockResetPinLoginAttempts: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ compare: mockCompare }));

vi.mock("@/lib/server/appSession", () => ({
  setAppSession: mockSetAppSession,
  SESSION_TTL_MS: 12 * 60 * 60 * 1_000,
}));

vi.mock("@/lib/server/pinLoginSelector", () => ({
  verifyPinLoginSelector: mockVerifySelector,
}));

vi.mock("@/lib/server/pinLoginAttempts", () => ({
  PIN_LOGIN_PUBLIC_RETRY_SECONDS: 1,
  reservePinLoginAttempt: mockReservePinLoginAttempt,
  resetPinLoginAttempts: mockResetPinLoginAttempts,
}));

vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: mockDbSelect }) }) },
}));

vi.mock("@/db/schema", () => ({
  appUsers: {
    id: "id",
    tenantId: "tenant_id",
    pinHash: "pin_hash",
    active: "active",
    role: "role",
    fullName: "full_name",
  },
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));

describe("loginWithPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifySelector.mockResolvedValue({ ok: true, userId: "user-abc" });
    mockCompare.mockResolvedValue(true);
    mockReservePinLoginAttempt.mockResolvedValue({ allowed: true, remaining: 4 });
    mockResetPinLoginAttempts.mockResolvedValue(undefined);
    mockSetAppSession.mockResolvedValue(undefined);
  });

  it("accepts only a valid selector and bcrypt PIN", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-abc",
      tenantId: "galvanik-kreile",
      pinHash: "$2b$12$test-hash",
      active: true,
      role: "werkstatt",
      fullName: "Max Mustermann",
    }]);
    const { loginWithPin } = await import("@/app/actions/auth.actions");
    await expect(loginWithPin("signed-selector", "1234"))
      .resolves.toEqual({ ok: true, role: "werkstatt" });
    expect(mockSetAppSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-abc",
      tenantId: "galvanik-kreile",
      role: "werkstatt",
      displayName: "Max Mustermann",
    }));
    expect(mockReservePinLoginAttempt).toHaveBeenCalledWith({
      tenantId: "galvanik-kreile",
      userId: "user-abc",
      role: "werkstatt",
    });
    expect(mockResetPinLoginAttempts).toHaveBeenCalledWith({
      tenantId: "galvanik-kreile",
      userId: "user-abc",
      role: "werkstatt",
    });
    expect(mockResetPinLoginAttempts.mock.invocationCallOrder[0])
      .toBeLessThan(mockSetAppSession.mock.invocationCallOrder[0]);
  });

  it("fails closed for legacy plaintext PIN values", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-abc",
      tenantId: "galvanik-kreile",
      pinHash: "1234",
      active: true,
      role: "werkstatt",
      fullName: "Max Mustermann",
    }]);
    const { loginWithPin } = await import("@/app/actions/auth.actions");
    await expect(loginWithPin("signed-selector", "1234"))
      .resolves.toEqual({
        ok: false,
        message: "Ungültige PIN oder inaktiver Benutzer.",
        retryAfterSeconds: 1,
      });
    expect(mockReservePinLoginAttempt).not.toHaveBeenCalled();
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("rejects tampered selectors before querying the database", async () => {
    mockVerifySelector.mockResolvedValue({ ok: false });
    const { loginWithPin } = await import("@/app/actions/auth.actions");
    await expect(loginWithPin("tampered", "1234")).resolves.toMatchObject({ ok: false });
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockReservePinLoginAttempt).not.toHaveBeenCalled();
  });

  it("consumes an attempt and retains it after a wrong PIN", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-abc",
      tenantId: "galvanik-kreile",
      pinHash: "$2b$12$test-hash",
      active: true,
      role: "werkstatt",
      fullName: "Max Mustermann",
    }]);
    mockCompare.mockResolvedValue(false);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    await expect(loginWithPin("selector-one", "9999")).resolves.toMatchObject({
      ok: false,
      retryAfterSeconds: 1,
    });

    expect(mockReservePinLoginAttempt).toHaveBeenCalledTimes(1);
    expect(mockCompare).toHaveBeenCalledTimes(1);
    expect(mockResetPinLoginAttempts).not.toHaveBeenCalled();
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("denies an exhausted user budget before bcrypt even with a renewed selector", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-abc",
      tenantId: "galvanik-kreile",
      pinHash: "$2b$12$test-hash",
      active: true,
      role: "werkstatt",
      fullName: "Max Mustermann",
    }]);
    mockCompare.mockResolvedValue(false);
    mockReservePinLoginAttempt
      .mockResolvedValueOnce({ allowed: true, remaining: 0 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 600 });

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const first = await loginWithPin("selector-one", "9999");
    const renewed = await loginWithPin("selector-two", "9999");

    expect(first).toEqual(renewed);
    expect(mockReservePinLoginAttempt).toHaveBeenCalledTimes(2);
    expect(mockCompare).toHaveBeenCalledTimes(1);
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("fails closed before bcrypt when the durable ledger is unavailable", async () => {
    mockDbSelect.mockResolvedValue([{
      id: "user-abc",
      tenantId: "galvanik-kreile",
      pinHash: "$2b$12$test-hash",
      active: true,
      role: "admin",
      fullName: "Admin Kreile",
    }]);
    mockReservePinLoginAttempt.mockRejectedValue(new Error("database unavailable"));

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    await expect(loginWithPin("selector", "1234")).resolves.toEqual({
      ok: false,
      message: "Ungültige PIN oder inaktiver Benutzer.",
      retryAfterSeconds: 1,
    });

    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });
});
