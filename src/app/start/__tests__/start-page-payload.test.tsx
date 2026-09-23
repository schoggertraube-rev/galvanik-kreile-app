import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  readProductActorReadiness: vi.fn(),
  reportProductActorOperationalFailure: vi.fn(),
  createPinLoginHandle: vi.fn((actorId: string) =>
    actorId.endsWith("1") ? "synthetic-rolf-handle" : "synthetic-phillip-handle",
  ),
  loginWithPin: vi.fn(),
  login: vi.fn(),
}));

vi.mock("@/lib/server/productActorReadiness", () => ({
  readProductActorReadiness: ports.readProductActorReadiness,
  reportProductActorOperationalFailure: ports.reportProductActorOperationalFailure,
}));
vi.mock("@/lib/server/pinLoginHandle", () => ({
  createPinLoginHandle: ports.createPinLoginHandle,
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
vi.mock("@/app/actions/auth", () => ({ login: ports.login }));

const ACTOR_IDS = {
  rolf: "11111111-1111-4111-8111-111111111111",
  phillip: "22222222-2222-4222-8222-222222222222",
  gregor: "33333333-3333-4333-8333-333333333333",
} as const;

const ready = {
  ok: true as const,
  evidenceScope: "RUNTIME_REQUEST" as const,
  actors: {
    rolf: {
      key: "rolf" as const,
      actorId: ACTOR_IDS.rolf,
      tenantId: "synthetic-tenant",
      role: "meister" as const,
      identity: { name: "Rolf" as const, responsibility: "Meister" as const, initials: "R" as const },
      login: "pin" as const,
    },
    phillip: {
      key: "phillip" as const,
      actorId: ACTOR_IDS.phillip,
      tenantId: "synthetic-tenant",
      role: "werkstatt" as const,
      identity: { name: "Phillip" as const, responsibility: "Werkstatt" as const, initials: "P" as const },
      login: "pin" as const,
    },
    gregor: {
      key: "gregor" as const,
      actorId: ACTOR_IDS.gregor,
      tenantId: "synthetic-tenant",
      role: "admin" as const,
      identity: { name: "Gregor" as const, responsibility: "Systemadministrator" as const, initials: "G" as const },
      login: "email" as const,
    },
  },
};

afterEach(() => cleanup());

describe("StartPage product actor boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.readProductActorReadiness.mockResolvedValue(ready);
    ports.reportProductActorOperationalFailure.mockReturnValue(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    ports.loginWithPin.mockResolvedValue({ ok: false, message: "synthetic" });
  });

  it("emits only browser-safe handles for exact Rolf and Phillip profiles", async () => {
    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();

    expect(element.props.users).toEqual([
      { loginHandle: "synthetic-rolf-handle", identity: "rolf" },
      { loginHandle: "synthetic-phillip-handle", identity: "phillip" },
    ]);
    expect(element.props.loginUnavailable).toBe(false);
    expect(JSON.stringify(element.props.users)).not.toContain(ACTOR_IDS.rolf);
    expect(JSON.stringify(element.props.users)).not.toContain(ACTOR_IDS.phillip);
    expect(element.props.users[0]).not.toHaveProperty("id");
    expect(element.props.users[0]).not.toHaveProperty("role");
    expect(element.props.users[0]).not.toHaveProperty("tenantId");

    render(element);
    expect(screen.getByText("Rolf", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Phillip", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Gregor", { exact: true })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("pin-user-card-synthetic-rolf-handle"));
    expect(screen.getByRole("heading", { name: "Persönlichen Code eingeben", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Löschen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neu" })).toBeInTheDocument();
    expect(ports.loginWithPin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Gregor/ }));
    expect(screen.getByText("Mit E-Mail anmelden", { exact: true })).toBeInTheDocument();
    expect(ports.login).not.toHaveBeenCalled();
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

      expect(screen.getByRole("heading", { name: "Persönlichen Code eingeben", level: 1 })).toBeVisible();
      expect(screen.getByRole("button", { name: /Rolf.*Meister/ })).toBeVisible();
      expect(screen.getByRole("button", { name: /Phillip.*Werkstatt/ })).toBeVisible();
      expect(screen.getByRole("button", { name: /Gregor.*Systemadministrator/ })).toBeVisible();
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
    ports.readProductActorReadiness.mockResolvedValue({
      ok: false,
      evidenceScope: "RUNTIME_REQUEST",
      code: "CONFIG_PARTIAL",
      supportReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();
    expect(element.props.users).toEqual([]);
    expect(element.props.loginUnavailable).toBe(true);

    render(element);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Anmeldung ist momentan nicht verfügbar",
    );
    expect(screen.getByText(/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gregor/ })).toBeDisabled();
    expect(screen.getByTestId("pin-profile-rolf-unavailable")).toBeDisabled();
    expect(screen.getByTestId("pin-profile-phillip-unavailable")).toBeDisabled();
    expect(document.body.textContent).not.toContain("CONFIG_PARTIAL");
  });

  it("fails closed and records a safe operational reference on an unexpected read error", async () => {
    ports.readProductActorReadiness.mockRejectedValue(new Error("synthetic failure"));
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

    expect(emailAuth).toContain("readProductActorReadiness");
    expect(emailAuth).toContain('redirect("/settings")');
    expect(pinAuth).toContain('window.location.assign("/")');
    expect(rootPage).toContain("resolveProductActorAuthorization");
    expect(rootPage).toContain('redirect("/settings")');
  });
});
