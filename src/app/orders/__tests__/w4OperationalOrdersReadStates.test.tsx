import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrdersPage from "../page";
import type { OperationalOrder } from "@/lib/types/operationalOrder";

const ports = vi.hoisted(() => ({
  getOrdersDb: vi.fn(),
  routerPush: vi.fn(),
  openShortcut: vi.fn(),
  openOrder: vi.fn(),
}));

vi.mock("next/navigation", () => {
  const router = { push: ports.routerPush };
  const searchParams = new URLSearchParams();
  return {
    useSearchParams: () => searchParams,
    useRouter: () => router,
  };
});
vi.mock("@/app/actions/orders.actions", () => ({ getOrdersDb: ports.getOrdersDb }));
vi.mock("@/hooks/usePageView", () => ({ usePageView: vi.fn() }));
vi.mock("@/lib/tracking/tracking", () => ({ trackUiEvent: vi.fn() }));
vi.mock("@/components/ui/Breadcrumb", () => ({ Breadcrumb: () => <div /> }));
vi.mock("@/components/ui/BackButton", () => ({ BackButton: () => <div /> }));
vi.mock("@/components/ui/AppShortcutContext", () => ({
  useAppShortcut: () => ({ openShortcut: ports.openShortcut }),
}));
vi.mock("@/components/orders/OrderModalProvider", () => ({
  useOrderModal: () => ({ openOrder: ports.openOrder }),
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
});

afterEach(() => cleanup());

describe("W4 orders read states", () => {
  it("shows loading without a false zero or empty claim", () => {
    ports.getOrdersDb.mockReturnValue(new Promise(() => undefined));
    render(<OrdersPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Auftragsbuch wird geladen");
    expect(screen.queryByText(/Aufträge gefunden/)).not.toBeInTheDocument();
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
  });

  it("shows unavailable without presenting failure as an empty list", async () => {
    ports.getOrdersDb.mockResolvedValue({
      ok: false,
      error: "DB_ERROR",
      message: "neutral",
    });
    render(<OrdersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Auftragsbuch derzeit nicht verfügbar",
    );
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    expect(screen.queryByText(/0 Aufträge gefunden/)).not.toBeInTheDocument();
  });

  it("shows true loaded-empty only after a successful empty read", async () => {
    ports.getOrdersDb.mockResolvedValue({ ok: true, data: [] });
    render(<OrdersPage />);

    expect(await screen.findByText("Noch keine Aufträge erfasst")).toBeInTheDocument();
    expect(screen.getByText("0 Aufträge gefunden")).toBeInTheDocument();
  });

  it("renders loaded data and labels a filter miss without denying the underlying orders", async () => {
    ports.getOrdersDb.mockResolvedValue({ ok: true, data: [order()] });
    render(<OrdersPage />);

    expect(await screen.findByText("A-100")).toBeInTheDocument();
    expect(screen.getByText("Kreile GmbH")).toBeInTheDocument();
    expect(screen.getByText("Welle verzinken")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "nicht-vorhanden" } });
    expect(await screen.findByText("Keine passenden Aufträge")).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    expect(screen.getByText("0 Aufträge gefunden")).toBeInTheDocument();
  });

  it("clears stale values and metrics when a sync reload returns non-ok", async () => {
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
    expect(await screen.findByText("A-100")).toBeInTheDocument();
    expect(screen.getByText("1 Aufträge gefunden")).toBeInTheDocument();

    fireEvent(window, new Event("kreile-sync-orders"));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Auftragsbuch wird geladen");
    });
    expect(screen.queryByText("A-100")).not.toBeInTheDocument();
    expect(screen.queryByText("1 Aufträge gefunden")).not.toBeInTheDocument();
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();

    finishReload({ ok: false, error: "DB_ERROR", message: "neutral" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Auftragsbuch derzeit nicht verfügbar",
    );
    expect(screen.queryByText("A-100")).not.toBeInTheDocument();
    expect(screen.queryByText(/Aufträge gefunden/)).not.toBeInTheDocument();
  });

  it("clears stale values and shows unavailable when a sync reload rejects", async () => {
    ports.getOrdersDb
      .mockResolvedValueOnce({ ok: true, data: [order()] })
      .mockRejectedValueOnce(new Error("offline"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<OrdersPage />);
    expect(await screen.findByText("A-100")).toBeInTheDocument();

    fireEvent(window, new Event("kreile-sync-focus"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Auftragsbuch derzeit nicht verfügbar",
    );
    expect(screen.queryByText("A-100")).not.toBeInTheDocument();
    expect(screen.queryByText(/Aufträge gefunden/)).not.toBeInTheDocument();
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
