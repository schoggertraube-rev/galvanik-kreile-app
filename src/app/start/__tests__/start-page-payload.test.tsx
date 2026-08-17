import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockWhere = vi.fn();
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockAnd = vi.fn((...conditions: unknown[]) => ({ kind: "and", conditions }));
const mockEq = vi.fn((column: unknown, value: unknown) => ({
  kind: "eq",
  column,
  value,
}));
const mockNe = vi.fn((column: unknown, value: unknown) => ({
  kind: "ne",
  column,
  value,
}));
const createPinLoginHandle = vi.fn((userId: string) => `handle-${userId}`);
const loginWithPin = vi.fn();
const login = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: mockSelect,
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: {
    id: "id",
    fullName: "full_name",
    role: "role",
    tenantId: "tenant_id",
    active: "active",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: mockAnd,
  eq: mockEq,
  ne: mockNe,
}));

vi.mock("@/lib/server/appSession", () => ({
  APP_TENANT_ID: "galvanik-kreile",
}));

vi.mock("@/lib/server/pinLoginHandle", () => ({
  createPinLoginHandle,
}));

vi.mock("@/components/start/StartScreenClient", async () => {
  return vi.importActual<typeof import("@/components/start/StartScreenClient")>(
    "@/components/start/StartScreenClient",
  );
});

vi.mock("@/hooks/usePageView", () => ({ usePageView: vi.fn() }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => (
    <span aria-label={alt} data-testid="next-image" role="img" />
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/actions/start.actions", () => ({
  notifyAdminPinReset: vi.fn(),
}));
vi.mock("@/app/actions/auth.actions", () => ({ loginWithPin }));
vi.mock("@/app/actions/auth", () => ({ login }));

const targetActiveUser = {
  id: "target-active",
  fullName: "Werkstatt Ziel",
  role: "werkstatt",
  tenantId: "galvanik-kreile",
  active: true,
  pinHash: "target-pin-hash",
};

const foreignActiveUser = {
  id: "foreign-active",
  fullName: "Fremd Tenant",
  role: "werkstatt",
  tenantId: "other-tenant",
  active: true,
  pinHash: "foreign-pin-hash",
};

const targetInactiveUser = {
  id: "target-inactive",
  fullName: "Inaktiv User",
  role: "werkstatt",
  tenantId: "galvanik-kreile",
  active: false,
  pinHash: "inactive-pin-hash",
};

const targetDeveloperUser = {
  id: "target-developer",
  fullName: "Dev User",
  role: "developer",
  tenantId: "galvanik-kreile",
  active: true,
  pinHash: "developer-pin-hash",
};

afterEach(() => {
  cleanup();
});

describe("StartPage payload sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockReset();
    loginWithPin.mockResolvedValue({ ok: false });
  });

  it("uses the complete tenant, active, and non-developer SQL predicate and defensively emits only eligible handles", async () => {
    mockWhere.mockResolvedValue([
      targetActiveUser,
      foreignActiveUser,
      targetInactiveUser,
      targetDeveloperUser,
    ]);

    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();

    expect(mockAnd).toHaveBeenCalledWith(
      { kind: "eq", column: "tenant_id", value: "galvanik-kreile" },
      { kind: "eq", column: "active", value: true },
      { kind: "ne", column: "role", value: "developer" },
    );
    expect(mockWhere).toHaveBeenCalledWith({
      kind: "and",
      conditions: [
        { kind: "eq", column: "tenant_id", value: "galvanik-kreile" },
        { kind: "eq", column: "active", value: true },
        { kind: "ne", column: "role", value: "developer" },
      ],
    });
    expect(createPinLoginHandle).toHaveBeenCalledTimes(1);
    expect(createPinLoginHandle).toHaveBeenCalledWith("target-active");
    expect(element.props.users).toEqual([
      {
        loginHandle: "handle-target-active",
        initials: "WZ",
        tileKind: "workshop",
      },
    ]);
    expect(element.props.loginUnavailable).toBe(false);

    const publicUser = element.props.users[0];
    expect(Object.keys(publicUser).sort()).toEqual(["initials", "loginHandle", "tileKind"]);
    expect(publicUser).not.toHaveProperty("tenantId");
    expect(publicUser).not.toHaveProperty("active");
    expect(publicUser).not.toHaveProperty("id");
    expect(publicUser).not.toHaveProperty("fullName");
    expect(publicUser).not.toHaveProperty("role");
    expect(publicUser).not.toHaveProperty("pinHash");

    render(element);
    expect(screen.getByText("WZ", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("FT", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("IU", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("DU", { exact: true })).not.toBeInTheDocument();
    expect(loginWithPin).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("WZ", { exact: true }).closest("button")!);
    expect(screen.getByText("PIN eingeben", { exact: true })).toBeInTheDocument();
    expect(loginWithPin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Administrator / E-Mail Login" }));
    expect(screen.getByText("Mit E-Mail anmelden", { exact: true })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("E-Mail Adresse")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("fails closed on a database error without a fallback tile while preserving administrator email login", async () => {
    mockWhere.mockRejectedValue(new Error("database unavailable"));

    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();

    expect(element.props.users).toEqual([]);
    expect(element.props.loginUnavailable).toBe(true);
    render(element);

    expect(screen.getByText("PIN-Anmeldung ist momentan nicht verfügbar. Bitte Administrator kontaktieren.")).toBeInTheDocument();
    expect(screen.queryByText("WZ", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Fallback Admin", { exact: true })).not.toBeInTheDocument();
    expect(loginWithPin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Administrator / E-Mail Login" }));
    expect(screen.getByText("Mit E-Mail anmelden", { exact: true })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("E-Mail Adresse")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });
});
