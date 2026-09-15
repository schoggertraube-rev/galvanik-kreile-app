import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
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
  APP_TENANT_ID: KREILE_TENANT_SLUG,
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

const rolfUser = {
  id: "rolf-user",
  fullName: "Rolf",
  role: "meister",
  tenantId: KREILE_TENANT_SLUG,
  active: true,
  pinHash: "target-pin-hash",
};

const phillipUser = {
  id: "phillip-user",
  fullName: "Werkstatt Ziel",
  role: "werkstatt",
  tenantId: KREILE_TENANT_SLUG,
  active: true,
  pinHash: "phillip-pin-hash",
};

const gregorUser = {
  id: "gregor-user",
  fullName: "Gregor",
  role: "admin",
  tenantId: KREILE_TENANT_SLUG,
  active: true,
  pinHash: "gregor-pin-hash",
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
  tenantId: KREILE_TENANT_SLUG,
  active: false,
  pinHash: "inactive-pin-hash",
};

const targetDeveloperUser = {
  id: "target-developer",
  fullName: "Dev User",
  role: "developer",
  tenantId: KREILE_TENANT_SLUG,
  active: true,
  pinHash: "developer-pin-hash",
};

const unrelatedMeister = {
  id: "sabrina-user",
  fullName: "Sabrina Schmidt",
  role: "meister",
  tenantId: KREILE_TENANT_SLUG,
  active: true,
  pinHash: "sabrina-pin-hash",
};

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("StartPage payload sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockReset();
    loginWithPin.mockResolvedValue({ ok: false });
    vi.stubEnv("KREILE_ROLF_APP_USER_ID", "rolf-user");
    vi.stubEnv("KREILE_PHILLIP_APP_USER_ID", "phillip-user");
    vi.stubEnv("KREILE_GREGOR_APP_USER_ID", "gregor-user");
  });

  it("emits only unique Rolf and Phillip profiles without technical identities", async () => {
    mockWhere.mockResolvedValue([
      rolfUser,
      phillipUser,
      gregorUser,
      foreignActiveUser,
      targetInactiveUser,
      targetDeveloperUser,
    ]);

    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();

    expect(mockAnd).toHaveBeenCalledWith(
      { kind: "eq", column: "tenant_id", value: KREILE_TENANT_SLUG },
      { kind: "eq", column: "active", value: true },
      { kind: "ne", column: "role", value: "developer" },
    );
    expect(mockWhere).toHaveBeenCalledWith({
      kind: "and",
      conditions: [
        { kind: "eq", column: "tenant_id", value: KREILE_TENANT_SLUG },
        { kind: "eq", column: "active", value: true },
        { kind: "ne", column: "role", value: "developer" },
      ],
    });
    expect(createPinLoginHandle).toHaveBeenCalledTimes(2);
    expect(createPinLoginHandle).toHaveBeenCalledWith("rolf-user");
    expect(createPinLoginHandle).toHaveBeenCalledWith("phillip-user");
    expect(createPinLoginHandle).not.toHaveBeenCalledWith("gregor-user");
    expect(element.props.users).toEqual([
      {
        loginHandle: "handle-rolf-user",
        identity: "rolf",
      },
      {
        loginHandle: "handle-phillip-user",
        identity: "phillip",
      },
    ]);
    expect(element.props.loginUnavailable).toBe(false);

    const publicUser = element.props.users[0];
    expect(Object.keys(publicUser).sort()).toEqual(["identity", "loginHandle"]);
    expect(publicUser).not.toHaveProperty("tenantId");
    expect(publicUser).not.toHaveProperty("active");
    expect(publicUser).not.toHaveProperty("id");
    expect(publicUser).not.toHaveProperty("fullName");
    expect(publicUser).not.toHaveProperty("role");
    expect(publicUser).not.toHaveProperty("pinHash");

    render(element);
    expect(screen.getByText("Rolf", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Phillip", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Gregor", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Sabrina Schmidt", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Büro", { exact: true })).not.toBeInTheDocument();
    expect(loginWithPin).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("pin-user-card-handle-rolf-user"));
    expect(screen.getByText("PIN eingeben", { exact: true })).toBeInTheDocument();
    expect(loginWithPin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Gregor/ }));
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

    expect(screen.getByText("PIN-Anmeldung ist momentan nicht sicher verfügbar. Bitte den Systemadministrator kontaktieren.")).toBeInTheDocument();
    expect(screen.queryByText("Rolf", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Fallback Admin", { exact: true })).not.toBeInTheDocument();
    expect(loginWithPin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Gregor/ }));
    expect(screen.getByText("Mit E-Mail anmelden", { exact: true })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("E-Mail Adresse")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("routes successful authentication through the canonical role-aware entry points", () => {
    const root = process.cwd();
    const emailAuth = readFileSync(path.join(root, "src/app/actions/auth.ts"), "utf8");
    const pinAuth = readFileSync(path.join(root, "src/components/start/StartScreenClient.tsx"), "utf8");
    const rootPage = readFileSync(path.join(root, "src/app/page.tsx"), "utf8");

    expect(emailAuth).toContain("redirect('/settings')");
    expect(pinAuth).toContain('window.location.assign("/")');
    expect(rootPage).toContain('redirect("/start")');
    expect(rootPage).toContain('redirect("/settings")');
    expect(rootPage).toContain('role === "werkstatt"');
    expect(rootPage).toContain('getProductIdentity(userId)');
    expect(rootPage).toContain('productIdentity.name === "Rolf" && role === "meister"');
    expect(rootPage).toContain('redirect("/start")');
  });

  it("does not mask another Meister as Rolf when the configured AppUser is absent", async () => {
    mockWhere.mockResolvedValue([
      unrelatedMeister,
      phillipUser,
    ]);
    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();
    expect(element.props.users).toEqual([{ loginHandle: "handle-phillip-user", identity: "phillip" }]);
    render(element);
    expect(screen.getByTestId("pin-profile-rolf-unavailable")).toBeDisabled();
    expect(screen.queryByText("Sabrina Schmidt", { exact: true })).not.toBeInTheDocument();
  });

  it("fails closed when the configured Rolf and Phillip IDs are ambiguous", async () => {
    vi.stubEnv("KREILE_PHILLIP_APP_USER_ID", "rolf-user");
    mockWhere.mockResolvedValue([rolfUser, phillipUser]);

    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();

    expect(element.props.users).toEqual([]);
    render(element);
    expect(screen.getByTestId("pin-profile-rolf-unavailable")).toBeDisabled();
    expect(screen.getByTestId("pin-profile-phillip-unavailable")).toBeDisabled();
  });
});
