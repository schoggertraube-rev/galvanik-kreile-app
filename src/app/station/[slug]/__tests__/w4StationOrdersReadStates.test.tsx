import { Suspense } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StationPage from "../page";
import type { OperationalOrder } from "@/lib/types/operationalOrder";

const ports = vi.hoisted(() => ({
  getOrdersDb: vi.fn(),
  routerPush: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => {
  const router = { push: ports.routerPush };
  return {
    useRouter: () => router,
    notFound: ports.notFound,
  };
});
vi.mock("@/app/actions/orders.actions", () => ({ getOrdersDb: ports.getOrdersDb }));
vi.mock("@/hooks/usePageView", () => ({ usePageView: vi.fn() }));
vi.mock("@/components/galvanik/GalvanikQueue", () => ({
  GalvanikQueue: ({ orders }: { orders: OperationalOrder[] }) => (
    <section>Galvanik: {orders.map((order) => order.orderNumber).join(", ")}</section>
  ),
}));
vi.mock("@/components/warenausgang/WarenausgangQueue", () => ({
  WarenausgangQueue: ({ allOrders }: { allOrders: OperationalOrder[] }) => (
    <section>Warenausgang: {allOrders.map((order) => order.orderNumber).join(", ")}</section>
  ),
}));

const order: OperationalOrder = {
  id: "order-galvanik",
  version: 2,
  orderNumber: "A-GALVANIK",
  customerId: "customer-1",
  customerName: "Kreile GmbH",
  title: "Welle",
  task: "Welle",
  itemDescription: "Welle",
  surfaceRequested: "Zink",
  station: "galvanik",
  status: "ready",
  statusText: "IM PLAN",
  risk: "green",
  currentStationId: "galvanik",
  parts: [],
  intakeDate: "2026-08-01T08:00:00.000Z",
  dueDate: "2030-08-01T08:00:00.000Z",
  dueLabel: "Fällig",
  dueValue: "später",
  createdAt: "2026-08-01T08:00:00.000Z",
};

async function renderStation(slug: string) {
  const params = Promise.resolve({ slug });
  await params;
  await act(async () => {
    render(
      <Suspense fallback={<div>Route wird geladen</div>}>
        <StationPage params={params} />
      </Suspense>,
    );
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("W4 station read states", () => {
  it("keeps loading distinct from loaded-empty", async () => {
    ports.getOrdersDb.mockReturnValue(new Promise(() => undefined));
    await renderStation("schleiferei");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Stationsaufträge werden geladen",
    );
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    expect(screen.queryByText(/0 Aufträge an dieser Station/)).not.toBeInTheDocument();
  });

  it("shows unavailable without a false station count or empty claim", async () => {
    ports.getOrdersDb.mockResolvedValue({ ok: false, error: "DB_ERROR", message: "neutral" });
    await renderStation("schleiferei");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Stationsaufträge derzeit nicht verfügbar",
    );
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    expect(screen.queryByText(/Aufträge an dieser Station/)).not.toBeInTheDocument();
  });

  it("shows loaded-empty only after a successful empty read", async () => {
    ports.getOrdersDb.mockResolvedValue({ ok: true, data: [] });
    await renderStation("schleiferei");

    expect(await screen.findByText("Noch keine Aufträge erfasst")).toBeInTheDocument();
    expect(screen.getByText("0 Aufträge an dieser Station")).toBeInTheDocument();
  });

  it("renders a loaded order through the real generic station card path", async () => {
    ports.getOrdersDb.mockResolvedValue({
      ok: true,
      data: [{ ...order, station: "schleiferei", currentStationId: "schleiferei" }],
    });
    await renderStation("schleiferei");

    expect(await screen.findByText("A-GALVANIK")).toBeInTheDocument();
    expect(screen.getByText(/Kreile GmbH/)).toBeInTheDocument();
    expect(screen.getByText("Welle")).toBeInTheDocument();
    expect(screen.getByText("1 Aufträge an dieser Station")).toBeInTheDocument();
  });

  it("labels an empty station subset without claiming the loaded orders do not exist", async () => {
    ports.getOrdersDb.mockResolvedValue({ ok: true, data: [order] });
    await renderStation("schleiferei");

    expect(await screen.findByText("Keine Aufträge an dieser Station")).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
  });

  it("maps the display slug beschichtung to the internal galvanik station only", async () => {
    ports.getOrdersDb.mockResolvedValue({ ok: true, data: [order] });
    await renderStation("beschichtung");

    expect(await screen.findByText("Galvanik: A-GALVANIK")).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
  });
});
