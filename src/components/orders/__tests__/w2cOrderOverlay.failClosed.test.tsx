import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  const popOrder = vi.fn();
  const openCustomer = vi.fn();
  const closeAll = vi.fn();
  const state = { stack: [{ type: "order" as const, id: "foreign-order" }], orderStack: ["foreign-order"], popOrder, openCustomer, closeAll };
  return { state, popOrder, openCustomer, closeAll, useOverlayStore: vi.fn((selector: (store: typeof state) => unknown) => selector(state)), AppOverlayPortal: vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>) };
});

vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: mocked.useOverlayStore }));
vi.mock("@/components/ui/AppOverlayPortal", () => ({ AppOverlayPortal: mocked.AppOverlayPortal }));

import { OrderOverlay } from "../OrderOverlay";

const message = "NOT_AVAILABLE: Auftrags-Overlay benötigt einen tenant- und ownership-geprüften W3-Read-Vertrag.";

describe("W2C-B2M5O order overlay fail-closed containment", () => {
  it("renders a foreign stacked order only as a closable denial", () => {
    render(<OrderOverlay />);
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.getByLabelText("Auftragsdetail nicht verfügbar").parentElement).toHaveStyle({ zIndex: "1010" });
    fireEvent.click(screen.getByTestId("order-overlay-backdrop"));
    fireEvent.click(screen.getAllByRole("button", { name: "Auftrags-Overlay schließen" })[1]);
    expect(mocked.popOrder).toHaveBeenCalledTimes(2);
    expect(mocked.openCustomer).not.toHaveBeenCalled();
    expect(mocked.closeAll).not.toHaveBeenCalled();
  });

  it("returns null for an empty legacy order stack", () => {
    mocked.state.orderStack = [];
    const view = render(<OrderOverlay />);
    expect(view.container).toBeEmptyDOMElement();
  });

  it("contains no former detail data, hook, drawer, or query port", async () => {
    const source = await readFile(resolve(process.cwd(), "src/components/orders/OrderOverlay.tsx"), "utf8");
    const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(executableSource).toMatch(/orderStack/);
    expect(executableSource).toMatch(/popOrder/);
    expect(executableSource).toMatch(/<AppOverlayPortal>/);
    expect(executableSource).not.toMatch(/useOrderLive|getOrderWithDetails|PaymentDrawer|StatusMailDrawer|ItemDrawer|openCustomer|closeAll|orderData|loading|not found|Lade Auftragsdaten/i);
  });
});
