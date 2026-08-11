import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArchivePage from "../page";
import type { OperationalOrder } from "@/lib/types/operationalOrder";

const getOrdersDb = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/orders.actions", () => ({ getOrdersDb }));
vi.mock("@/hooks/usePageView", () => ({ usePageView: vi.fn() }));
vi.mock("@/components/ui/AppBackButton", () => ({ AppBackButton: () => <div /> }));
vi.mock("@/components/ui/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const archivedOrder: OperationalOrder = {
  id: "order-archive",
  version: 4,
  orderNumber: "A-ARCHIV",
  customerId: "customer-1",
  customerName: "Kreile GmbH",
  title: "Welle",
  task: "Welle",
  itemDescription: "Welle",
  surfaceRequested: "Zink",
  station: "warenausgang",
  status: "done",
  statusText: "ABGESCHLOSSEN",
  risk: "green",
  currentStationId: "warenausgang",
  parts: [],
  intakeDate: "2026-08-01T08:00:00.000Z",
  dueDate: "2026-08-10T08:00:00.000Z",
  dueLabel: "Fällig",
  dueValue: "erledigt",
  createdAt: "2026-08-01T08:00:00.000Z",
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("W4 archive read states", () => {
  it("keeps loading distinct from loaded-empty", () => {
    getOrdersDb.mockReturnValue(new Promise(() => undefined));
    render(<ArchivePage />);

    expect(screen.getByRole("status")).toHaveTextContent("Archiv wird geladen");
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
  });

  it("shows unavailable without a false empty archive", async () => {
    getOrdersDb.mockResolvedValue({ ok: false, error: "DB_ERROR", message: "neutral" });
    render(<ArchivePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Archiv derzeit nicht verfügbar",
    );
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
  });

  it("shows loaded-empty only after a successful empty read", async () => {
    getOrdersDb.mockResolvedValue({ ok: true, data: [] });
    render(<ArchivePage />);

    expect(await screen.findByText("Noch keine Aufträge erfasst")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("labels an empty archive subset without claiming the loaded orders do not exist", async () => {
    getOrdersDb.mockResolvedValue({
      ok: true,
      data: [{ ...archivedOrder, status: "in_progress", statusText: "IM PLAN" }],
    });
    render(<ArchivePage />);

    expect(await screen.findByText("Noch keine archivierten Aufträge")).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Aufträge erfasst")).not.toBeInTheDocument();
    expect(screen.queryByText("A-ARCHIV")).not.toBeInTheDocument();
  });

  it("renders each canonical persisted archive status after a successful read", async () => {
    const archivedStatuses = [
      "done",
      "completed",
      "shipped",
      "abgeschlossen",
      "fertig",
    ];
    getOrdersDb.mockResolvedValue({
      ok: true,
      data: archivedStatuses.map((status, index) => ({
        ...archivedOrder,
        id: `order-archive-${index}`,
        orderNumber: `A-ARCHIV-${status}`,
        status,
        statusText: "IM PLAN",
      })),
    });
    render(<ArchivePage />);

    for (const status of archivedStatuses) {
      expect(await screen.findByText(`A-ARCHIV-${status}`)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Abgeschlossen")).toHaveLength(archivedStatuses.length);
  });
});
