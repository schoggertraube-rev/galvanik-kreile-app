import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ dirty: true, close: vi.fn() }));

vi.mock("@/components/erfassung/ErfassungProvider", () => ({
  useErfassung: () => ({
    options: { mode: "order" },
    isDirty: state.dirty,
    closeErfassung: state.close,
  }),
}));
vi.mock("@/components/erfassung/ManualFlow/ManualWizard", () => ({ ManualWizard: () => <div>Order flow</div> }));
vi.mock("@/components/erfassung/ScanFlow/ScanResult", () => ({ ScanResult: () => null }));
vi.mock("@/components/erfassung/ScanFlow/ScanUpload", () => ({ ScanUpload: () => null }));
vi.mock("@/components/erfassung/InquiryFlow/InquiryToQuote", () => ({ InquiryToQuote: () => null }));
vi.mock("@/components/erfassung/ManualFlow/CustomerWizard", () => ({ CustomerWizard: () => null }));
vi.mock("@/components/erfassung/StartGate", () => ({ StartGate: () => null }));
vi.mock("lucide-react", () => ({ X: () => null }));

import { ErfassungModal } from "@/components/erfassung/ErfassungModal";

afterEach(() => { cleanup(); state.close.mockReset(); state.dirty = true; });

describe("ErfassungModal critical-operation guard", () => {
  it("cannot close via X or backdrop while mutation/readback is active", () => {
    const view = render(<ErfassungModal />);
    const close = screen.getByRole("button", { name: "Speichern oder Prüfen läuft" });
    expect(close).toBeDisabled();
    fireEvent.click(close);
    fireEvent.click(view.container.firstElementChild as Element);
    expect(state.close).not.toHaveBeenCalled();
  });

  it("allows close once the critical operation is finished", () => {
    state.dirty = false;
    render(<ErfassungModal />);
    fireEvent.click(screen.getByRole("button", { name: "Erfassung schließen" }));
    expect(state.close).toHaveBeenCalledTimes(1);
  });
});
