import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    expect(screen.getByRole("heading", { name: "Der Tag" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Das braucht dich" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Heute raus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Neu seit gestern 18:30" })).toBeInTheDocument();
    expect(screen.queryByText(/Geplant|kommt bald/i)).not.toBeInTheDocument();
    expect(screen.getByText("In Galvanik · Fällig: 18.09.2026")).toBeInTheDocument();
    expect(screen.queryByText(/Dieser Auftrag ist kritisch|Quelle:|Stand /)).not.toBeInTheDocument();
    const priorityAction = screen.getAllByRole("button", { name: "Auftrag A-2026-0001 öffnen" })[0];
    expect(priorityAction.closest("article")).not.toBeNull();
    fireEvent.click(priorityAction);
    expect(ports.openOrder).toHaveBeenCalledWith("order-1");
  });

  it("keeps readonly on the same data truth without mutation actions", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "readonly", canCreateOrder: false, projection }} />);
    expect(screen.getAllByText("A-2026-0001").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Neuer Eingang/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Warenausgang öffnen/ })).toBeDisabled();
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

  afterEach(() => vi.restoreAllMocks());

  it.each(["2026-09-16T08:15:00.000Z", "2026-01-15T23:40:00.000Z"])(
    "keeps technical source timestamps out of the compact home for %s",
    (loadedAt) => {
      render(<RolfHomeClient model={{ kind: "data", role: "meister", canCreateOrder: true, projection: { ...projection, loadedAt } }} />);
      expect(screen.queryByText(/Quelle:|Stand \d|Auftragsbestand ·/)).not.toBeInTheDocument();
    },
  );

  it("renders honest empty, denied and error states", () => {
    const empty = { ...projection, orders: [], priority: [], recent: [], dominant: null } satisfies OrdersHomeProjection;
    const { rerender } = render(<RolfHomeClient model={{ kind: "empty", role: "meister", canCreateOrder: true, projection: empty }} />);
    expect(screen.getByRole("heading", { name: "Das braucht dich" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Heute raus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Neu seit gestern 18:30" })).toBeInTheDocument();
    expect(screen.getAllByText("Heute keine offenen Aufträge.").length).toBeGreaterThan(0);
    expect(screen.getByText("Heute keine fertigen Aufträge.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ware raus/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Warenausgang öffnen/ })).toBeDisabled();
    rerender(<RolfHomeClient model={{ kind: "denied", message: "Nicht freigegeben." }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Tagesbestand nicht öffnen");
    rerender(<RolfHomeClient model={{ kind: "error", message: "Lesefehler." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("gerade nicht verfügbar");
  });

  it("marks incomplete recent coverage without inventing missing entries", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "meister", canCreateOrder: true, projection: { ...projection, recent: [], recentCoverage: "partial" } }} />);
    expect(screen.getByText("Seit gestern keine neuen Aufträge.")).toBeInTheDocument();
    expect(screen.queryByText(/ohne Eingangszeit|belegten Zeitraum|behauptet/i)).not.toBeInTheDocument();
  });
});
