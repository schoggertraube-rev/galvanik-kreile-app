import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrdersPage from "@/app/orders/page";
import type { OperationalOrder } from "@/lib/types/operationalOrder";

const ports = vi.hoisted(() => ({
  getOrdersDb: vi.fn(),
  openOrder: vi.fn(),
}));

vi.mock("@/app/actions/orders.actions", () => ({ getOrdersDb: ports.getOrdersDb }));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({ requestGlobalCreate: vi.fn() }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({ hasPermission: () => false, loading: false }),
}));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: (selector: (state: { openOrder: typeof ports.openOrder }) => unknown) =>
    selector({ openOrder: ports.openOrder }),
}));

const order = (id = "order-1", orderNumber = "A-100"): OperationalOrder => ({
  id,
  version: 1,
  orderNumber,
  customerId: "customer-1",
  customerName: "Kreile GmbH",
  title: "Welle",
  task: "Welle verzinken",
  itemDescription: "Welle",
  surfaceRequested: "Zink",
  station: "wareneingang",
  status: "ready",
  statusText: "IM PLAN",
  risk: "green",
  currentStationId: "wareneingang",
  parts: [],
  intakeDate: "2026-08-10T08:00:00.000Z",
  dueDate: "2030-08-10T08:00:00.000Z",
  dueLabel: "Fällig",
  dueValue: "später",
  createdAt: "2026-08-10T08:00:00.000Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

afterEach(() => cleanup());

async function findOrderRow(orderNumber = "A-100"): Promise<HTMLElement> {
  const button = await screen.findByRole("button", { name: `Auftrag ${orderNumber} öffnen` });
  const row = button.closest(".app-row");
  if (!(row instanceof HTMLElement)) throw new Error("Auftragszeile fehlt");
  return row;
}

describe("W4 orders read states", () => {
  it("shows loading without a false zero or empty claim", () => {
    ports.getOrdersDb.mockReturnValue(new Promise(() => undefined));
    render(<OrdersPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Aufträge werden geladen.");
    expect(screen.queryByText("Keine Aufträge.")).not.toBeInTheDocument();
  });

  it("shows unavailable without presenting failure as an empty list", async () => {
    ports.getOrdersDb.mockResolvedValue({
      ok: false,
      error: "DB_ERROR",
      message: "neutral",
    });
    render(<OrdersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("neutral");
    expect(screen.queryByText("Keine Aufträge.")).not.toBeInTheDocument();
  });

  it("shows true loaded-empty only after a successful empty read", async () => {
    ports.getOrdersDb.mockResolvedValue({ ok: true, data: [] });
    render(<OrdersPage />);

    expect(await screen.findByText("Keine Aufträge.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders loaded data and labels a filter miss without denying the underlying orders", async () => {
    ports.getOrdersDb.mockResolvedValue({ ok: true, data: [order()] });
    render(<OrdersPage />);

    const row = await findOrderRow();
    expect(row).toHaveTextContent("A-100 · Kreile GmbH");
    expect(row).toHaveTextContent("Welle · Zink");
    expect(row).not.toHaveTextContent("Welle verzinken");
    fireEvent.change(screen.getByRole("textbox", { name: "Aufträge filtern" }), { target: { value: "nicht-vorhanden" } });
    expect(await screen.findByText("Keine Aufträge gefunden.")).toBeInTheDocument();
    expect(screen.queryByText("Keine Aufträge.")).not.toBeInTheDocument();
  });

  it("opens the selected order with its ID", async () => {
    ports.getOrdersDb.mockResolvedValue({ ok: true, data: [order("order-42", "A-100")] });
    render(<OrdersPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Auftrag A-100 öffnen" }));

    expect(ports.openOrder).toHaveBeenCalledWith("order-42");
  });

  it("clears stale values when a sync reload returns non-ok", async () => {
    let finishReload!: (value: {
      ok: false;
      error: "DB_ERROR";
      message: string;
    }) => void;
    ports.getOrdersDb
      .mockResolvedValueOnce({ ok: true, data: [order()] })
      .mockReturnValueOnce(new Promise((resolve) => {
        finishReload = resolve;
      }));
    render(<OrdersPage />);
    await findOrderRow();

    fireEvent(window, new Event("kreile-sync-orders"));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Aufträge werden geladen.");
    });
    expect(screen.queryByRole("button", { name: "Auftrag A-100 öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByText("Keine Aufträge.")).not.toBeInTheDocument();

    finishReload({ ok: false, error: "DB_ERROR", message: "neutral" });
    expect(await screen.findByRole("alert")).toHaveTextContent("neutral");
    expect(screen.queryByRole("button", { name: "Auftrag A-100 öffnen" })).not.toBeInTheDocument();
  });

  it("clears stale values and shows unavailable when a sync reload rejects", async () => {
    ports.getOrdersDb
      .mockResolvedValueOnce({ ok: true, data: [order()] })
      .mockRejectedValueOnce(new Error("offline"));
    render(<OrdersPage />);
    await findOrderRow();

    fireEvent(window, new Event("kreile-sync-orders"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Aufträge konnten nicht sicher geladen werden.");
    expect(screen.queryByRole("button", { name: "Auftrag A-100 öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByText("Keine Aufträge.")).not.toBeInTheDocument();
  });
});
