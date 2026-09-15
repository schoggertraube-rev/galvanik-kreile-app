import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SessionWarningBanner } from "../SessionWarningBanner";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/app/actions/auth", () => ({
  logout: (...args: unknown[]) => mocks.logout(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logout.mockResolvedValue({ ok: true, remoteSignOut: "success" });
});

describe("SessionWarningBanner (LIVE-AUTH-001)", () => {
  it("rendert nicht, wenn show=false", () => {
    const { container } = render(<SessionWarningBanner show={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("meldet unabhängig von einer Alt-Erfassungs-Montage sicher ab", async () => {
    render(<SessionWarningBanner show />);

    fireEvent.click(screen.getByTestId("session-warning-relogin"));

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
