import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetAppSession = vi.fn();
const mockDbSelect = vi.fn();
const mockVerifyPinLoginSelector = vi.fn();

vi.mock("@/lib/server/appSession", () => ({
  setAppSession: mockSetAppSession,
  SESSION_TTL_MS: 12 * 60 * 60 * 1000,
}));

vi.mock("@/lib/server/pinLoginSelector", () => ({
  verifyPinLoginSelector: mockVerifyPinLoginSelector,
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockDbSelect,
      }),
    }),
  },
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

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

describe("loginWithPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetAppSession.mockResolvedValue(undefined);
  });

  it("issues a canonical session only for a valid opaque selector and PIN", async () => {
    mockVerifyPinLoginSelector.mockReturnValue({ ok: true, userId: "user-abc" });
    mockDbSelect.mockResolvedValue([{
      id: "user-abc",
      tenantId: "galvanik-kreile",
      pinHash: "1234",
      active: true,
      role: "werkstatt",
      fullName: "Max Mustermann",
    }]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("opaque-selector", "1234");

    expect(result).toEqual({ ok: true, role: "werkstatt" });
    expect(mockVerifyPinLoginSelector).toHaveBeenCalledWith("opaque-selector");
    expect(mockSetAppSession).toHaveBeenCalledOnce();
    expect(mockSetAppSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-abc",
      displayName: "Max Mustermann",
      role: "werkstatt",
      tenantId: "galvanik-kreile",
    }));
  });

  it("rejects an invalid or expired selector before issuing a session", async () => {
    mockVerifyPinLoginSelector.mockReturnValue({ ok: false });

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("tampered-selector", "1234");

    expect(result.ok).toBe(false);
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("rejects an invalid PIN without leaking which condition failed", async () => {
    mockVerifyPinLoginSelector.mockReturnValue({ ok: true, userId: "user-ghi" });
    mockDbSelect.mockResolvedValue([{
      id: "user-ghi",
      tenantId: "galvanik-kreile",
      pinHash: "9999",
      active: true,
      role: "meister",
      fullName: "Paul Meister",
    }]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("opaque-selector", "0000");

    expect(result).toEqual({ ok: false, message: "Ungültige PIN oder inaktiver Benutzer." });
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });

  it("rejects a developer account from the anonymous PIN flow", async () => {
    mockVerifyPinLoginSelector.mockReturnValue({ ok: true, userId: "dev-user" });
    mockDbSelect.mockResolvedValue([{
      id: "dev-user",
      tenantId: "galvanik-kreile",
      pinHash: "1234",
      active: true,
      role: "developer",
      fullName: "Dev User",
    }]);

    const { loginWithPin } = await import("@/app/actions/auth.actions");
    const result = await loginWithPin("opaque-selector", "1234");

    expect(result.ok).toBe(false);
    expect(mockSetAppSession).not.toHaveBeenCalled();
  });
});
