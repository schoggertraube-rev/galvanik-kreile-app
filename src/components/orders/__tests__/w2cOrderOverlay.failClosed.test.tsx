import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  const popOrder = vi.fn();
  const openCustomer = vi.fn();
  const state = { stack: [{ type: "order" as const, id: "foreign-order" }], orderStack: ["foreign-order"], popOrder, openCustomer };
  return {
    state,
    popOrder,
    openCustomer,
    getLiveOrderCardAction: vi.fn(),
    getExtraWorkMasterDataAction: vi.fn(),
    useOverlayStore: vi.fn((selector: (store: typeof state) => unknown) => selector(state)),
  };
});

vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: mocked.useOverlayStore }));
vi.mock("@/components/ui/AppOverlayPortal", () => ({ AppOverlayPortal: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/auth/PermissionsContext", () => ({ usePermissions: () => ({ role: "werkstatt" }) }));
vi.mock("@/app/actions/orders.actions", () => ({
  getLiveOrderCardAction: mocked.getLiveOrderCardAction,
  getExtraWorkMasterDataAction: mocked.getExtraWorkMasterDataAction,
}));
vi.mock("../ExtraWorkAdminPanel", () => ({ ExtraWorkAdminPanel: () => null }));
vi.mock("../OrderExtraWorkEditor", () => ({ OrderExtraWorkEditor: () => null }));
vi.mock("../OrderFreezeButton", () => ({ OrderFreezeButton: () => null }));
vi.mock("../OrderFreezeCorrectionButton", () => ({ OrderFreezeCorrectionButton: () => null }));
vi.mock("../OrderTaskAssignmentPanel", () => ({ OrderTaskAssignmentPanel: () => null }));
vi.mock("../OrderImmutableInvoiceButton", () => ({ OrderImmutableInvoiceButton: () => null }));

import { OrderOverlay } from "../OrderOverlay";

describe("F1.3 live order overlay containment", () => {
  beforeEach(() => {
    mocked.popOrder.mockReset();
    mocked.openCustomer.mockReset();
    mocked.getLiveOrderCardAction.mockReset();
    mocked.getExtraWorkMasterDataAction.mockReset();
    mocked.state.orderStack = ["foreign-order"];
    mocked.getExtraWorkMasterDataAction.mockResolvedValue({
      code: "OK",
      data: { currentRate: null, catalog: [] },
    });
  });

  it("renders a foreign order as a tenant-safe denial and remains closable", async () => {
    mocked.getLiveOrderCardAction.mockResolvedValue({ code: "NOT_FOUND", message: "Auftrag nicht verfügbar." });
    render(<OrderOverlay />);
    expect(await screen.findByText("Auftrag wurde nicht gefunden oder gehört nicht zu diesem Mandanten.")).toBeVisible();
    fireEvent.click(screen.getByTestId("order-overlay-backdrop"));
    fireEvent.click(screen.getAllByRole("button", { name: "Auftragskarte schließen" })[1]);
    expect(mocked.popOrder).toHaveBeenCalledTimes(2);
    expect(mocked.openCustomer).not.toHaveBeenCalled();
  });

  it("returns null for an empty order stack without calling a read port", () => {
    mocked.state.orderStack = [];
    const view = render(<OrderOverlay />);
    expect(view.container).toBeEmptyDOMElement();
    expect(mocked.getLiveOrderCardAction).not.toHaveBeenCalled();
  });
});
