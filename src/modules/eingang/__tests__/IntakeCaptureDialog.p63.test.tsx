import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalCreatePorts } from "../GlobalCreateFlow";
import { IntakeCaptureDialog } from "../ui/IntakeCaptureDialog";

vi.mock("../pendingOriginals", () => ({
  readPendingOriginals: vi.fn(async () => []),
  retainPendingOriginal: vi.fn(async () => undefined),
  acknowledgePendingOriginal: vi.fn(async () => undefined),
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("P63: the camera action is reachable in the fixed footer", () => {
  it.each(["tablet", "handy"])("starts the %s camera immediately and keeps Foto in the dialog footer", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const stop = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const ports = { getCaptureScope: vi.fn(async () => ({ code: "OK", scope: "synthetic-p63-only" })) } as unknown as GlobalCreatePorts;
    render(<IntakeCaptureDialog ports={ports} onClose={vi.fn()} onOrder={vi.fn()} onCustomer={vi.fn()} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    const shutter = screen.getByRole("button", { name: /^Foto$/u });
    expect(shutter).toBeDisabled();
    const video = screen.getByLabelText("Rückkamera");
    Object.defineProperties(video, { readyState: { value: 2 }, videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
    fireEvent.loadedData(video);
    expect(shutter).toBeEnabled();
    expect(shutter.closest(".kr-dialog-fuss")).not.toBeNull();
    cleanup();
    expect(stop).toHaveBeenCalledOnce();
  });
});
