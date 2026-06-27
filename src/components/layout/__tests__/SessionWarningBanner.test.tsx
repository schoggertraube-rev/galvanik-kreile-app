import { beforeEach, describe, expect, fireEvent, it, render, screen, waitFor } from "vitest";
import { SessionWarningBanner } from "../SessionWarningBanner";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  logout: vi.fn(),
  closeErfassung: vi.fn(),
  providerState: { isOpen: false },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/app/actions/auth", () => ({
  logout: (...args: unknown[]) => mocks.logout(...args),
}));

vi.mock("@/components/erfassung/ErfassungProvider", () => ({
  useErfassung: () => ({
    isOpen: mocks.providerState.isOpen,
    closeErfassung: mocks.closeErfassung,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.providerState.isOpen = false;
  mocks.logout.mockResolvedValue({ ok: true, remoteSignOut: "success" });
});

describe("SessionWarningBanner (LIVE-AUTH-001)", () => {
  it("rendert nicht, wenn show=false", () => {
    const { container } = render(<SessionWarningBanner show={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("schließt ein aktives Erfassungs-Overlay vor dem Logout", async () => {
    mocks.providerState.isOpen = true;
    render(<SessionWarningBanner show />);

    fireEvent.click(screen.getByTestId("session-warning-relogin"));

    expect(mocks.closeErfassung).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
  });

  it("ruft den kanonischen Logout auf und ersetzt die Route durch /start", async () => {
    render(<SessionWarningBanner show />);

    fireEvent.click(screen.getByTestId("session-warning-relogin"));

    await waitFor(() => {
      expect(mocks.logout).toHaveBeenCalledTimes(1);
      expect(mocks.replace).toHaveBeenCalledWith("/start");
    });
  });

  it("navigiert auch dann nach /start, wenn logout fehlschlägt", async () => {
    mocks.logout.mockRejectedValueOnce(new Error("session already missing"));
    render(<SessionWarningBanner show />);

    fireEvent.click(screen.getByTestId("session-warning-relogin"));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/start"));
  });

  it("startet bei Mehrfachklick nur einen Logout", async () => {
    let resolveLogout!: () => void;
    mocks.logout.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogout = () => resolve({ ok: true, remoteSignOut: "success" });
        }),
    );

    render(<SessionWarningBanner show />);
    const button = screen.getByTestId("session-warning-relogin");

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mocks.logout).toHaveBeenCalledTimes(1);
    resolveLogout();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/start"));
  });
});
