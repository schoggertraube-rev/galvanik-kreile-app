import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  const close = vi.fn();
  const openOrder = vi.fn();
  return {
    close,
    openOrder,
    getCustomerSummaryAction: vi.fn(),
    useCustomerOverlay: vi.fn(() => ({ customerId: "foreign-customer", isOpen: true, close })),
    useOverlayStore: vi.fn((selector: (state: { stack: Array<{ type: "customer"; id: string }>; openOrder: typeof openOrder }) => unknown) => selector({
      stack: [{ type: "customer", id: "foreign-customer" }],
      openOrder,
    })),
  };
});

vi.mock("../useCustomerOverlay", () => ({ useCustomerOverlay: mocked.useCustomerOverlay }));
vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: mocked.useOverlayStore }));
vi.mock("@/components/ui/AppOverlayPortal", () => ({ AppOverlayPortal: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/app/actions/customers.actions", () => ({ getCustomerSummaryAction: mocked.getCustomerSummaryAction }));

import { CustomerOverlay } from "../CustomerOverlay";

describe("F1.3 live customer overlay containment", () => {
  beforeEach(() => {
    mocked.close.mockReset();
    mocked.openOrder.mockReset();
  });

  it("renders a foreign customer as a tenant-safe denial and remains closable", async () => {
    mocked.getCustomerSummaryAction.mockResolvedValue({ code: "NOT_FOUND", message: "Kunde nicht verfügbar." });
    render(<CustomerOverlay />);
    expect(await screen.findByText("Kunde wurde nicht gefunden oder gehört nicht zu diesem Mandanten.")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Kundenkarte schließen" })[1]);
    fireEvent.click(screen.getByTestId("customer-overlay-backdrop"));
    expect(mocked.close).toHaveBeenCalledTimes(2);
    expect(mocked.openOrder).not.toHaveBeenCalled();
  });

  it("shows a denied state without exposing customer data", async () => {
    mocked.getCustomerSummaryAction.mockResolvedValue({ code: "FORBIDDEN", message: "Kundenkarte ist nicht erlaubt." });
    render(<CustomerOverlay />);
    expect(await screen.findByText("Zugriff nicht erlaubt")).toBeVisible();
    expect(screen.getByText("Kundenkarte ist nicht erlaubt.")).toBeVisible();
  });
});
