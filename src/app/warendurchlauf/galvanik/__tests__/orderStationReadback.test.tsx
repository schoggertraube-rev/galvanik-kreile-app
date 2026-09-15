import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  getGalvanikOrdersAction: vi.fn(),
  openOrder: vi.fn(),
}));

vi.mock("@/app/warendurchlauf/actions", () => ({
  getGalvanikOrdersAction: ports.getGalvanikOrdersAction,
}));
vi.mock("@/modules/orders/public", () => ({
  OrderQueueRow: ({
    order,
    onOpen,
  }: {
    order: { id: string; orderNumber: string };
    onOpen: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onOpen(order.id)}>
      {order.orderNumber}
    </button>
  ),
  ORDER_LIFECYCLE_STATUS: {
    ANGENOMMEN: "angenommen",
    GALVANIK: "galvanik",
    FERTIG: "fertig",
  },
}));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: () => ports.openOrder,
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("lucide-react", () => {
  const Icon = () => null;
  return {
    ArrowRight: Icon,
    Layers: Icon,
    CheckCircle2: Icon,
    AlertTriangle: Icon,
    Loader2: Icon,
    ChevronRight: Icon,
  };
});

import GalvanikPage from "../page";

const galvanikOrder = {
  id: "order-1",
  version: 2,
  orderNumber: "A-1",
  customerId: "customer-1",
  customerName: "Kunde",
  title: "Auftrag",
  task: null,
  itemDescription: "Teil",
  surfaceRequested: "Zink",
  station: "galvanik",
  currentStationId: "galvanik",
  status: "galvanik",
  statusText: "IM PLAN",
  risk: "green",
  parts: [],
  intakeDate: "",
  dueDate: "",
  dueLabel: "Termin",
  dueValue: "Nicht erfasst",
  createdAt: undefined,
};

afterEach(() => {
  cleanup();
  ports.getGalvanikOrdersAction.mockReset();
  ports.openOrder.mockReset();
});

describe("W3 Galvanik readback on the V8 card seam", () => {
  it("keeps loading free of empty success claims", async () => {
    ports.getGalvanikOrdersAction.mockReturnValueOnce(new Promise(() => {}));
    render(<GalvanikPage />);
    expect(screen.getByText("Lade Galvanik Aufträge...")).toBeInTheDocument();
    expect(
      screen.queryByText("Noch keine Daten erfasst."),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(ports.getGalvanikOrdersAction).toHaveBeenCalledTimes(1),
    );
  });

  it("distinguishes denial from unavailable data", async () => {
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({
      ok: false,
      error: "FORBIDDEN",
      message: "Stationsliste ist nicht erlaubt.",
    });
    const view = render(<GalvanikPage />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Stationsliste ist nicht erlaubt.",
      ),
    );
    expect(
      screen.queryByText("Noch keine Daten erfasst."),
    ).not.toBeInTheDocument();
    view.unmount();

    ports.getGalvanikOrdersAction.mockResolvedValueOnce({
      ok: false,
      error: "QUERY_ERROR",
      message: "Nicht sicher geladen.",
    });
    render(<GalvanikPage />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Nicht sicher geladen.",
      ),
    );
    expect(
      screen.getByText("Daten konnten nicht geladen werden"),
    ).toBeInTheDocument();
  });

  it("renders true empty only after a successful read", async () => {
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({ ok: true, data: [] });
    render(<GalvanikPage />);
    expect(
      await screen.findByText("Noch keine Daten erfasst."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Aufträge anzeigen" }),
    ).toHaveAttribute("href", "/orders");
  });

  it("opens the one V8 order-card stack from the real queue row", async () => {
    ports.getGalvanikOrdersAction.mockResolvedValueOnce({
      ok: true,
      data: [galvanikOrder],
    });
    render(<GalvanikPage />);
    const orderButtons = await screen.findAllByRole("button", { name: "A-1" });
    fireEvent.click(orderButtons[0]!);
    expect(ports.openOrder).toHaveBeenCalledWith("order-1");
    expect(
      screen.queryByRole("button", { name: /start/i }),
    ).not.toBeInTheDocument();
  });
});
