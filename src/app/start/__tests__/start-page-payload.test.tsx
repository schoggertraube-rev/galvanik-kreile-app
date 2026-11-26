import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StartPage from "@/app/start/page";

const ports = vi.hoisted(() => ({
  readActiveStartUsers: vi.fn(),
  reportProductActorOperationalFailure: vi.fn(),
  loginWithPin: vi.fn(),
  searchParams: "",
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
  useSearchParams: () => new URLSearchParams(ports.searchParams),
}));
vi.mock("@/app/actions/start.actions", () => ({
  notifyAdminPinReset: vi.fn(),
}));
vi.mock("@/app/actions/auth.actions", () => ({
  loginWithPin: ports.loginWithPin,
}));
vi.mock("@/app/actions/auth", () => ({ login: vi.fn() }));
// This component probe isolates PIN keyboard handling. Native deletion failures,
// retries and original preservation are covered by offline_logout_cleanup.browser.
vi.mock("@/lib/offline/privateReadCache", () => ({
  clearPrivateReadStateBeforeLogin: vi.fn().mockResolvedValue(undefined),
}));

const activeUsers = [
  { loginHandle: "synthetic-rolf-handle", fullName: "Rolf", shortCode: "R", designation: "Meister", role: "meister" as const, emailLoginAvailable: false },
  { loginHandle: "synthetic-phillip-handle", fullName: "Phillip", shortCode: "P", designation: "Werkstatt", role: "werkstatt" as const, emailLoginAvailable: false },
  { loginHandle: "synthetic-gregor-handle", fullName: "Gregor", shortCode: "G", designation: "Wartung", role: "developer" as const, emailLoginAvailable: true },
];

afterEach(() => {
  cleanup();
  window.localStorage.removeItem('kreile:last-login-handle');
  vi.unstubAllGlobals();
});

describe("StartPage product actor boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.readActiveStartUsers.mockResolvedValue({ code: "OK", users: activeUsers, skipped: 0 });
    ports.reportProductActorOperationalFailure.mockReturnValue(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    ports.loginWithPin.mockResolvedValue({ ok: false, message: "synthetic" });
    ports.searchParams = "";
  });

  it("emits only browser-safe handles for every active app user", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Mit E-Mail anmelden" }));
    expect(screen.getByLabelText("E-Mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Passwort")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mit Code anmelden" }));
    await waitFor(() => expect(screen.getByLabelText("0 von 4 Stellen eingegeben")).toHaveFocus());
  });

  it.each([
    ["desktop", 1914, 917],
    ["narrow fine-pointer", 390, 844],
  ])(
    "keeps the compact V5 login and every product identity at the %s viewport",
    async (_viewport, width, height) => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
      window.dispatchEvent(new Event("resize"));
      render(await StartPage());

      expect(screen.getByRole("heading", { name: /Guten (Morgen|Tag|Abend)/, level: 1 })).toBeVisible();
      expect(screen.getByTestId("pin-user-card-synthetic-rolf-handle")).toBeVisible();
      expect(screen.getByTestId("pin-user-card-synthetic-phillip-handle")).toBeVisible();
      expect(screen.getByTestId("pin-user-card-synthetic-gregor-handle")).toBeVisible();
      expect(document.body).not.toHaveTextContent(/Willkommen zurück|Sicher anmelden|Wähle deinen Namen/i);
      expect(document.body).not.toHaveTextContent(/tenantgebunden|rollenbasiert|Produktprofil|Systemzugang ist erhöht/i);
    },
  );

  it('selects a desktop identity using arrow keys and returns to the selection with Escape', async () => {
    render(await StartPage());
    const first = screen.getByTestId('pin-user-card-synthetic-rolf-handle');
    const second = screen.getByTestId('pin-user-card-synthetic-phillip-handle');
    first.focus();
    expect(first).toHaveAttribute('tabindex', '0');
    expect(second).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(second);
    const pin = screen.getByLabelText('0 von 4 Stellen eingegeben');
    expect(pin).toHaveFocus();
    fireEvent.keyDown(pin, { key: '8' });
    expect(screen.getByLabelText('1 von 4 Stellen eingegeben')).toBeVisible();
    fireEvent.keyDown(pin, { key: 'Escape' });
    expect(second).toHaveFocus();
    expect(screen.getByLabelText('0 von 4 Stellen eingegeben')).toBeVisible();
    expect(ports.loginWithPin).not.toHaveBeenCalled();
  });

  it('asks for a short code instead of displaying the people list on a phone', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const mobileUsers = activeUsers.map((user, index) => ({ ...user, shortCode: ['RO', 'PH', 'GR'][index] }));
    ports.readActiveStartUsers.mockResolvedValue({ code: 'OK', users: mobileUsers, skipped: 0 });
    render(await StartPage());
    const shortCode = screen.getByRole('textbox', { name: 'Dein Kürzel' });
    expect(screen.queryByRole('group', { name: 'Wähle dich aus' })).not.toBeInTheDocument();
    fireEvent.change(shortCode, { target: { value: 'xx' } });
    fireEvent.keyDown(shortCode, { key: 'Enter' });
    const pin = screen.getByLabelText('0 von 4 Stellen eingegeben');
    expect(pin).toHaveFocus();
    for (const digit of '1836') fireEvent.keyDown(pin, { key: digit });
    expect(screen.getByRole('alert')).toHaveTextContent('Kürzel oder Code passt nicht.');
    expect(shortCode).toHaveFocus();
    expect(ports.loginWithPin).not.toHaveBeenCalled();
    fireEvent.change(shortCode, { target: { value: 'ph' } });
    expect(shortCode).toHaveValue('PH');
    fireEvent.keyDown(shortCode, { key: 'Enter' });
    for (const digit of '1836') fireEvent.keyDown(pin, { key: digit });
    await waitFor(() => expect(ports.loginWithPin).toHaveBeenCalledExactlyOnceWith('synthetic-phillip-handle', '1836'));
  });

  it('shows only the remembered identity on a phone', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    window.localStorage.setItem('kreile:last-login-handle', 'synthetic-phillip-handle');
    render(await StartPage());
    const change = await screen.findByRole('button', { name: 'Nicht Phillip? Mit deinem Kürzel anmelden' });
    expect(screen.getByRole('heading', { name: /, Phillip$/ })).toBeVisible();
    expect(screen.queryByTestId('pin-user-card-synthetic-rolf-handle')).not.toBeInTheDocument();
    fireEvent.click(change);
    const shortCode = screen.getByRole('textbox', { name: 'Dein Kürzel' });
    await waitFor(() => expect(shortCode).toHaveFocus());
  });

  it('keeps one active group and focuses a person on another group by keyboard', async () => {
    const people = Array.from({ length: 20 }, (_, index) => ({
      ...activeUsers[0], fullName: `TEST Person ${index}`, loginHandle: `synthetic-roster-${index}`,
      shortCode: index === 19 ? 'ZZ' : `A${index}`,
    }));
    ports.readActiveStartUsers.mockResolvedValue({ code: 'OK', users: people, skipped: 0 });
    render(await StartPage());
    const group = screen.getByRole('group', { name: 'Wähle dich aus' });
    const first = screen.getByTestId('pin-user-card-synthetic-roster-0');
    first.focus();
    expect(group.querySelectorAll('button').length).toBeLessThan(people.length);
    expect(screen.queryByTestId('pin-user-card-synthetic-roster-19')).not.toBeInTheDocument();
    fireEvent.keyDown(first, { key: 'Z' });
    const last = screen.getByTestId('pin-user-card-synthetic-roster-19');
    await waitFor(() => expect(last).toHaveFocus());
    expect(group.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
    expect(screen.queryByTestId('pin-user-card-synthetic-roster-0')).not.toBeInTheDocument();
    fireEvent.keyDown(last, { key: 'Home' });
    await waitFor(() => expect(screen.getByTestId('pin-user-card-synthetic-roster-0')).toHaveFocus());
    fireEvent.wheel(group, { deltaY: 120 });
    expect(screen.queryByTestId('pin-user-card-synthetic-roster-0')).not.toBeInTheDocument();
    expect(group.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
    expect(ports.loginWithPin).not.toHaveBeenCalled();
  });

  it("accepts NumLock-off numpad codes, deletes with Backspace and submits exactly once after digit four", async () => {
    ports.loginWithPin.mockReturnValue(new Promise(() => {}));
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

  it("clears a URL error on the next digit and keeps email errors in the email form", async () => {
    ports.searchParams = "message=Code+falsch&mode=pin";
    const { unmount } = render(await StartPage());
    expect(screen.getByRole("alert")).toHaveTextContent("Code falsch");
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    expect(screen.queryByText("Code falsch")).not.toBeInTheDocument();
    unmount();

    ports.searchParams = "message=E-Mail+oder+Passwort+falsch&mode=email";
    render(await StartPage());
    expect(screen.getByLabelText("E-Mail")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("E-Mail oder Passwort falsch");
  });

  it("disables every login path and exposes only a correlation reference on readiness failure", async () => {
    ports.readActiveStartUsers.mockResolvedValue({ code: "UNAVAILABLE" });
    const element = await StartPage();
    expect(element.props.users).toEqual([]);
    expect(element.props.loginUnavailable).toBe(true);

    render(element);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Die Anmeldung ist gerade nicht erreichbar. Versuch es in einer Minute noch einmal.",
    );
    expect(screen.getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(true);
  });

  it("shows a maintenance notice when active login rows were skipped", async () => {
    ports.readActiveStartUsers.mockResolvedValue({ code: "OK", users: activeUsers, skipped: 2 });
    render(await StartPage());
    expect(screen.getByRole("status")).toHaveTextContent("2 Logins sind ausgeblendet, weil Angaben fehlen. Die Wartung ergänzt sie in den Einstellungen.");
  });

  it("fails closed and records a safe operational reference on an unexpected read error", async () => {
    ports.readActiveStartUsers.mockRejectedValue(new Error("synthetic failure"));
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
    expect(emailAuth).toContain('redirect("/")');
    expect(pinAuth).toContain('window.location.assign("/")');
    expect(rootPage).toContain("resolveAuthorization");
    expect(rootPage).toContain('hasAuthorizationArea(authorization, "wartung")');
    expect(rootPage).toContain("<HomeAppAdapter");
    expect(rootPage).not.toMatch(/authorization\.role\s*(?:===|!==)/);
  });
});
