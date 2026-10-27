import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  readActiveStartUsers: vi.fn(),
  reportProductActorOperationalFailure: vi.fn(),
  loginWithPin: vi.fn(),
}));

vi.mock("@/lib/server/productActorReadiness", () => ({
  reportProductActorOperationalFailure: ports.reportProductActorOperationalFailure,
}));
vi.mock("@/lib/server/startUserRead", () => ({
  readActiveStartUsers: ports.readActiveStartUsers,
}));
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
vi.mock("@/app/actions/auth.actions", () => ({
  loginWithPin: ports.loginWithPin,
}));
vi.mock("@/app/actions/auth", () => ({ login: vi.fn() }));

const activeUsers = [
  { loginHandle: "synthetic-rolf-handle", fullName: "Rolf", shortCode: "R", designation: "Meister", role: "meister" as const },
  { loginHandle: "synthetic-phillip-handle", fullName: "Phillip", shortCode: "P", designation: "Werkstatt", role: "werkstatt" as const },
  { loginHandle: "synthetic-gregor-handle", fullName: "Gregor", shortCode: "G", designation: "Wartung", role: "developer" as const },
];

afterEach(() => cleanup());

describe("StartPage product actor boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.readActiveStartUsers.mockResolvedValue({ code: "OK", users: activeUsers });
    ports.reportProductActorOperationalFailure.mockReturnValue(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    ports.loginWithPin.mockResolvedValue({ ok: false, message: "synthetic" });
  });

  it("emits only browser-safe handles for every active app user", async () => {
    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();

    expect(element.props.users).toEqual(activeUsers);
    expect(element.props.loginUnavailable).toBe(false);
    expect(element.props.users[0]).not.toHaveProperty("id");
    expect(element.props.users[0]).not.toHaveProperty("tenantId");
    expect(element.props.users[0]).not.toHaveProperty("email");

    render(element);
    expect(screen.getByText("Rolf", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Phillip", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Gregor", { exact: true })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("pin-user-card-synthetic-rolf-handle"));
    expect(screen.getByLabelText("0 von 4 Stellen eingegeben")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Löschen" })).toBeInTheDocument();
    expect(ports.loginWithPin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("pin-user-card-synthetic-gregor-handle"));
    expect(screen.getByRole("button", { name: "Mit E-Mail anmelden" })).toBeInTheDocument();
  });

  it.each([
    ["desktop", 1914, 917],
    ["mobile", 390, 844],
  ])(
    "keeps the compact V5 login and every product identity at the %s viewport",
    async (_viewport, width, height) => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
      window.dispatchEvent(new Event("resize"));

      const { default: StartPage } = await import("@/app/start/page");
      render(await StartPage());

      expect(screen.getByRole("heading", { name: /Guten (Morgen|Tag|Abend)/, level: 1 })).toBeVisible();
      expect(screen.getByTestId("pin-user-card-synthetic-rolf-handle")).toBeVisible();
      expect(screen.getByTestId("pin-user-card-synthetic-phillip-handle")).toBeVisible();
      expect(screen.getByTestId("pin-user-card-synthetic-gregor-handle")).toBeVisible();
      expect(document.body).not.toHaveTextContent(/Willkommen zurück|Sicher anmelden|Wähle deinen Namen/i);
      expect(document.body).not.toHaveTextContent(/tenantgebunden|rollenbasiert|Produktprofil|Systemzugang ist erhöht/i);
    },
  );

  it("accepts NumLock-off numpad codes, deletes with Backspace and submits exactly once after digit four", async () => {
    ports.loginWithPin.mockReturnValue(new Promise(() => {}));
    const { default: StartPage } = await import("@/app/start/page");
    render(await StartPage());
    fireEvent.click(screen.getByTestId("pin-user-card-synthetic-rolf-handle"));

    fireEvent.keyDown(window, { key: "End", code: "Numpad4" });
    expect(screen.getByLabelText("1 von 4 Stellen eingegeben")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Backspace", code: "Backspace" });
    expect(screen.getByLabelText("0 von 4 Stellen eingegeben")).toBeInTheDocument();

    for (const digit of ["4", "1", "8", "6"]) {
      fireEvent.keyDown(window, { key: "Unidentified", code: `Numpad${digit}` });
    }
    await waitFor(() => expect(ports.loginWithPin).toHaveBeenCalledTimes(1));
    expect(ports.loginWithPin).toHaveBeenCalledWith("synthetic-rolf-handle", "4186");
    fireEvent.keyDown(window, { key: "Unidentified", code: "Numpad9" });
    expect(ports.loginWithPin).toHaveBeenCalledTimes(1);
  });

  it("disables every login path and exposes only a correlation reference on readiness failure", async () => {
    ports.readActiveStartUsers.mockResolvedValue({ code: "UNAVAILABLE" });

    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();
    expect(element.props.users).toEqual([]);
    expect(element.props.loginUnavailable).toBe(true);

    render(element);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Anmeldung ist momentan nicht verfügbar",
    );
    expect(screen.getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(true);
  });

  it("fails closed and records a safe operational reference on an unexpected read error", async () => {
    ports.readActiveStartUsers.mockRejectedValue(new Error("synthetic failure"));
    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();

    expect(element.props).toMatchObject({
      users: [],
      loginUnavailable: true,
      supportReference: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(ports.reportProductActorOperationalFailure).toHaveBeenCalledWith(
      "PIN_LOGIN_SURFACE_UNAVAILABLE",
    );
  });

  it("keeps successful routing behind the shared server contract", () => {
    const root = process.cwd();
    const emailAuth = readFileSync(path.join(root, "src/app/actions/auth.ts"), "utf8");
    const pinAuth = readFileSync(path.join(root, "src/components/start/StartScreenClient.tsx"), "utf8");
    const rootPage = readFileSync(path.join(root, "src/app/page.tsx"), "utf8");

    expect(emailAuth).toContain("resolveLoginIdentityByEmail");
    expect(emailAuth).toContain('redirect("/settings")');
    expect(pinAuth).toContain('window.location.assign("/")');
    expect(rootPage).toContain("resolveAuthorization");
    expect(rootPage).toContain('redirect("/settings")');
  });
});
