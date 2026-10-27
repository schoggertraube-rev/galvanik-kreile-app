import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrdersAppAdapter } from "@/app/orders/OrdersAppAdapter";

const ports = vi.hoisted(() => ({
  getOrdersDb: vi.fn(),
  openOrder: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/app/actions/orders.actions", () => ({ getOrdersDb: ports.getOrdersDb }));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({ requestGlobalCreate: ports.create }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({ loading: false, hasPermission: () => true }),
}));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: (selector: (state: { openOrder: typeof ports.openOrder }) => unknown) => selector({ openOrder: ports.openOrder }),
}));

const order = {
  id: "order-1",
  version: 1,
  orderNumber: "A-2026-0001",
  customerId: "customer-1",
  customerName: "Sabrina Schmidt",
  title: "Sabrina Schmidt · stosstange",
  task: null,
  itemDescription: "stosstange",
  surfaceRequested: "chrom",
  station: "angenommen",
  status: "angenommen",
  statusText: "Angenommen",
  risk: "red",
  currentStationId: "angenommen",
  parts: [],
  intakeDate: "2026-10-20",
  dueDate: "2026-10-27",
  dueLabel: "Termin",
  dueValue: "27.10.2026",
  createdAt: "2026-10-20T08:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  ports.getOrdersDb.mockResolvedValue({ ok: true, data: [order] });
});

afterEach(cleanup);

describe("OrdersAppAdapter V1.1", () => {
  it("renders the real list through V1.1 controls and opens the existing order", async () => {
    render(<OrdersAppAdapter />);

    await waitFor(() => expect(screen.getByText("A-2026-0001")).toBeVisible());
    expect(screen.getByRole("heading", { level: 1, name: "Aufträge" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Auftragsansicht" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Aufträge filtern" })).toBeVisible();
    expect(screen.getByPlaceholderText("Auftrag, Kunde, Teil oder Oberfläche")).toBeVisible();
    expect(screen.queryByText("Sabrina Schmidt · Sabrina Schmidt")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /A-2026-0001/ }));
    expect(ports.openOrder).toHaveBeenCalledWith("order-1");
  });

  it("filters real rows and switches to the real week view", async () => {
    render(<OrdersAppAdapter />);
    await waitFor(() => expect(screen.getByText("A-2026-0001")).toBeVisible());

    fireEvent.change(screen.getByPlaceholderText("Auftrag, Kunde, Teil oder Oberfläche"), { target: { value: "nicht vorhanden" } });
    expect(screen.getByText("Kein Auftrag für „nicht vorhanden“." )).toBeVisible();

    const views = within(screen.getByRole("group", { name: "Auftragsansicht" }));
    fireEvent.click(views.getByRole("button", { name: "Woche" }));
    expect(screen.getByText(/^Mo\./)).toBeVisible();
  });
});
