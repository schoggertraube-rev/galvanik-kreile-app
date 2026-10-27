import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrdersHomeProjection } from "@/modules/orders/public";

const ports = vi.hoisted(() => ({
  openOrder: vi.fn(),
  requestCreate: vi.fn(),
  push: vi.fn(),
  permissions: { loading: false, canCreateOrder: true },
}));
vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: (selector: (state: { openOrder: typeof ports.openOrder }) => unknown) => selector({ openOrder: ports.openOrder }) }));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({ requestGlobalCreate: ports.requestCreate }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: ports.push }) }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({
    loading: ports.permissions.loading,
    hasPermission: (permission: string) => permission === "perm_data_orders" && ports.permissions.canCreateOrder,
  }),
}));

import { dayLineParts, RolfHomeClient } from "../RolfHomeClient";

beforeEach(() => {
  vi.clearAllMocks();
  ports.permissions.loading = false;
  ports.permissions.canCreateOrder = true;
});

const projection: OrdersHomeProjection = {
  source: "Auftragsbestand",
  loadedAt: "2026-09-16T08:15:00.000Z",
  orders: [{ id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag", detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "red", dueDate: "2026-09-18", dueLabel: "Fällig", dueValue: "18.09.2026", createdAt: "2026-09-16T07:00:00.000Z" }],
  priority: [{ id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag", detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "red", dueDate: "2026-09-18", dueLabel: "Fällig", dueValue: "18.09.2026", createdAt: "2026-09-16T07:00:00.000Z" }],
  recent: [{ id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag", detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "red", dueDate: "2026-09-18", dueLabel: "Fällig", dueValue: "18.09.2026", createdAt: "2026-09-16T07:00:00.000Z" }],
  recentSince: "2026-09-15T08:15:00.000Z",
  recentCoverage: "complete",
  dominant: { orderId: "order-1", reason: "Dieser Auftrag ist kritisch." },
};

describe("Rolf 'Der Tag' in V1.1 mit echter Projektion", () => {
  it("zeigt den V1.1-Aufbau mit echten Daten und öffnet den Auftrag", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "meister", canCreateOrder: true, projection }} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId("rolf-v11-home")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Der Tag" })).toHaveClass("kr-seite-titel");
    expect(screen.getByRole("region", { name: "Lage" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Handlungsbedarf" })).toBeInTheDocument();
    expect(screen.getByText("Heute & Woche")).toBeInTheDocument();
    expect(screen.getByText("Diese Woche")).toBeInTheDocument();
    expect(screen.getByText("Neu seit gestern")).toBeInTheDocument();
    const open = screen.getByRole("button", { name: "Auftrag öffnen" });
    expect(open.closest(".kr-hb-eintrag")).toHaveClass("kr-hb-eintrag--konflikt", "kr-fokus");
    fireEvent.click(open);
    expect(ports.openOrder).toHaveBeenCalledWith("order-1");
  });

  it("zeigt keine Aktionen ohne echte Anbindung", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "meister", canCreateOrder: true, projection }} />);
    for (const name of [/Kümmern/, /an Phillip/, /Später/, /Erinnerung/, /Freigeben/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/erledigt, sobald/)).not.toBeInTheDocument();
  });

  it("führt readonly ohne Warenausgang-Aktion", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "readonly", canCreateOrder: false, projection }} />);
    expect(screen.queryByRole("button", { name: /Ware raus öffnen/ })).not.toBeInTheDocument();
  });

  it.each([
    { risks: ["red", "red", "yellow"], expected: { salutation: "Guten Morgen, Rolf.", urgent: 2, other: 1 } },
    { risks: ["yellow", "orange"], expected: { salutation: "Guten Morgen, Rolf.", urgent: 0, other: 2 } },
    { risks: ["red"], expected: { salutation: "Guten Morgen, Rolf.", urgent: 1, other: 0 } },
    { risks: [], expected: { salutation: "Guten Morgen, Rolf.", urgent: 0, other: 0 } },
  ] as const)("leitet die Tageslage weiterhin ehrlich ab (%#)", ({ risks, expected }) => {
    const orders = risks.map((risk, index) => ({ ...projection.orders[0], id: `order-${index + 1}`, orderNumber: `A-2026-00${index + 1}`, risk }));
    expect(dayLineParts(orders, "Rolf Meister", new Date("2026-09-24T07:00:00.000Z"))).toEqual(expected);
  });

  it("zeigt ehrliche Leer-, Verweigert- und Fehlerzustände", () => {
    const empty = { ...projection, orders: [], priority: [], recent: [], dominant: null } satisfies OrdersHomeProjection;
    const { rerender } = render(<RolfHomeClient model={{ kind: "empty", role: "meister", canCreateOrder: true, projection: empty }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Noch keine Aufträge erfasst.");
    expect(screen.getByRole("button", { name: "Neuer Eingang" })).toBeInTheDocument();
    rerender(<RolfHomeClient model={{ kind: "denied", message: "Nicht freigegeben." }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Tagesbestand nicht öffnen");
    rerender(<RolfHomeClient model={{ kind: "error", message: "Lesefehler." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("gerade nicht verfügbar");
  });
});
