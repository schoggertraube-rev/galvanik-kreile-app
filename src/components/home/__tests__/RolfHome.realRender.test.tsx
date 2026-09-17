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
  orders: [{ id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag", detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "red", dueDate: "2026-09-18", dueLabel: "Fällig", dueValue: "18.09.2026" }],
  priority: [{ id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag", detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "red", dueDate: "2026-09-18", dueLabel: "Fällig", dueValue: "18.09.2026" }],
  dominant: { orderId: "order-1", reason: "Persistierter Risikostatus: kritisch" },
};

describe("Rolf V8 real public projection", () => {
  it("shows source, timestamp, dominant reason and opens the same order overlay", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "meister", canCreateOrder: true, projection }} />);
    expect(screen.getByText(/Quelle: Auftragsbestand/)).toBeInTheDocument();
    expect(screen.getByText("Persistierter Risikostatus: kritisch")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Jetzt öffnen/ }));
    expect(ports.openOrder).toHaveBeenCalledWith("order-1");
  });

  it("keeps readonly on the same data truth without mutation actions", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "readonly", canCreateOrder: false, projection }} />);
    expect(screen.getByText("A-2026-0001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Neuer Eingang/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Heute raus/ })).toBeDisabled();
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
    const empty = { ...projection, orders: [], priority: [], dominant: null } satisfies OrdersHomeProjection;
    const { rerender } = render(<RolfHomeClient model={{ kind: "empty", role: "meister", canCreateOrder: true, projection: empty }} />);
    expect(screen.getByText(/mandantengebundene Auftragsprojektion/)).toBeInTheDocument();
    rerender(<RolfHomeClient model={{ kind: "denied", message: "Nicht freigegeben." }} />);
    expect(screen.getByRole("status")).toHaveTextContent("keine Auftragsdaten geladen");
    rerender(<RolfHomeClient model={{ kind: "error", message: "Lesefehler." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("keine älteren Auftragsdaten");
  });
});
