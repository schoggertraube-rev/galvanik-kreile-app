import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrdersHomeProjection } from "@/modules/orders/public";

const ports = vi.hoisted(() => ({
  openOrder: vi.fn(),
  requestCreate: vi.fn(),
  permissions: { loading: false, canCreateOrder: true },
}));
vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: (selector: (state: { openOrder: typeof ports.openOrder }) => unknown) => selector({ openOrder: ports.openOrder }) }));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({ requestGlobalCreate: ports.requestCreate }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({
    loading: ports.permissions.loading,
    hasPermission: (permission: string) => permission === "perm_data_orders" && ports.permissions.canCreateOrder,
  }),
}));

import { RolfHomeClient } from "../RolfHomeClient";

beforeEach(() => {
  vi.clearAllMocks();
  ports.permissions.loading = false;
  ports.permissions.canCreateOrder = true;
});

const projection: OrdersHomeProjection = {
  source: "Auftragsbestand", loadedAt: "2026-09-16T08:15:00.000Z",
  orders: [{ id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag", detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "red", dueDate: "2026-09-18", dueLabel: "Fällig", dueValue: "18.09.2026", createdAt: "2026-09-16T07:00:00.000Z" }],
  priority: [{ id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag", detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "red", dueDate: "2026-09-18", dueLabel: "Fällig", dueValue: "18.09.2026", createdAt: "2026-09-16T07:00:00.000Z" }],
  recent: [{ id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag", detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "red", dueDate: "2026-09-18", dueLabel: "Fällig", dueValue: "18.09.2026", createdAt: "2026-09-16T07:00:00.000Z" }],
  recentSince: "2026-09-15T08:15:00.000Z",
  recentCoverage: "complete",
  dominant: { orderId: "order-1", reason: "Dieser Auftrag ist kritisch." },
};

describe("Rolf V8 real public projection", () => {
  it("shows the complete daily structure from the real projection and opens the same order overlay", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "meister", canCreateOrder: true, projection }} />);
    expect(screen.getByText(/Quelle: Auftragsbestand/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Das braucht dich" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Heute raus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Neu seit gestern" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Zahlen" })).toBeInTheDocument();
    expect(screen.getByText(/Dieser Auftrag ist kritisch/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /A-2026-0001/ })[0]);
    expect(ports.openOrder).toHaveBeenCalledWith("order-1");
  });

  it("keeps readonly on the same data truth without mutation actions", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "readonly", canCreateOrder: false, projection }} />);
    expect(screen.getAllByText("A-2026-0001").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Neuer Eingang/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fertige Aufträge öffnen/ })).toBeDisabled();
  });

  it("keeps the direct intake action hidden until the matching client capability is loaded", () => {
    ports.permissions.loading = true;
    const { rerender } = render(<RolfHomeClient model={{ kind: "data", role: "meister", canCreateOrder: true, projection }} />);
    expect(screen.queryByRole("button", { name: /Neuer Eingang/ })).not.toBeInTheDocument();
    ports.permissions.loading = false;
    ports.permissions.canCreateOrder = false;
    rerender(<RolfHomeClient model={{ kind: "data", role: "meister", canCreateOrder: true, projection }} />);
    expect(screen.queryByRole("button", { name: /Neuer Eingang/ })).not.toBeInTheDocument();
    ports.permissions.canCreateOrder = true;
  });

  it("renders honest empty, denied and error states", () => {
    const empty = { ...projection, orders: [], priority: [], recent: [], dominant: null } satisfies OrdersHomeProjection;
    const { rerender } = render(<RolfHomeClient model={{ kind: "empty", role: "meister", canCreateOrder: true, projection: empty }} />);
    expect(screen.getByRole("heading", { name: "Das braucht dich" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Heute raus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Neu seit gestern" })).toBeInTheDocument();
    expect(screen.getByText("Aktuell wartet kein offener Auftrag.")).toBeInTheDocument();
    expect(screen.getByText(/keine Abholung oder Auslieferung behauptet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ware raus/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Fertige Aufträge öffnen/ })).toBeDisabled();
    rerender(<RolfHomeClient model={{ kind: "denied", message: "Nicht freigegeben." }} />);
    expect(screen.getByRole("status")).toHaveTextContent("keine Auftragsdaten geladen");
    rerender(<RolfHomeClient model={{ kind: "error", message: "Lesefehler." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("keine älteren Auftragsdaten");
  });

  it("marks incomplete recent coverage without inventing missing entries", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "meister", canCreateOrder: true, projection: { ...projection, recent: [], recentCoverage: "partial" } }} />);
    expect(screen.getByText(/ohne Eingangszeit/)).toBeInTheDocument();
    expect(screen.getByText(/kein neuer Auftrag hinzugekommen/)).toBeInTheDocument();
  });
});
