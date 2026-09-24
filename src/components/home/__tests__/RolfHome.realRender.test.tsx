import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    name: "Rolf Meister",
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

const dayLine = (container: HTMLElement) => container.querySelector(".day-line")?.textContent?.replace(/\s+/g, " ").trim();

describe("Rolf 'Der Tag' aus der Owner-Mock-Bauvorlage mit echter Projektion", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("zeigt den Mock-Aufbau mit echten Daten und oeffnet den Auftrag", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "meister", canCreateOrder: true, projection }} />);
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Der Tag" })).toHaveClass("day-title");
    expect(screen.getByText("Das braucht dich")).toBeInTheDocument();
    expect(screen.getByText("Heute raus")).toBeInTheDocument();
    expect(screen.getByText("Neu seit gestern 18:30")).toBeInTheDocument();
    const open = screen.getAllByRole("button", { name: "Auftrag A-2026-0001 öffnen" })[0];
    expect(open).toHaveClass("pi-t");
    expect(open.closest(".pi")).toHaveClass("crit");
    fireEvent.click(open);
    expect(ports.openOrder).toHaveBeenCalledWith("order-1");
  });

  it("zeigt keine Aktionen ohne echte Anbindung (Owner G7)", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "meister", canCreateOrder: true, projection }} />);
    for (const name of [/Kümmern/, /an Phillip/, /Später/, /Erinnerung/, /Freigeben/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/erledigt, sobald/)).not.toBeInTheDocument();
  });

  it("fuehrt readonly ohne Warenausgang-Aktion", () => {
    render(<RolfHomeClient model={{ kind: "data", role: "readonly", canCreateOrder: false, projection }} />);
    expect(screen.queryByRole("button", { name: /Warenausgang öffnen/ })).not.toBeInTheDocument();
  });

  it.each([
    { risks: ["red", "red", "yellow"], expected: "Guten Morgen, Rolf. 2 dringend · 1 weiterer braucht dich." },
    { risks: ["yellow", "orange"], expected: "Guten Morgen, Rolf. 2 brauchen dich." },
    { risks: ["red"], expected: "Guten Morgen, Rolf. 1 dringend." },
    { risks: [], expected: "Guten Morgen, Rolf. Heute ist nichts offen." },
  ] as const)("leitet die ehrliche Tageszeile ab (%#)", ({ risks, expected }) => {
    const orders = risks.map((risk, index) => ({ ...projection.orders[0], id: `order-${index + 1}`, orderNumber: `A-2026-00${index + 1}`, risk }));
    const { container } = render(
      <RolfHomeClient now={new Date("2026-09-24T07:00:00.000Z")} model={{ kind: orders.length === 0 ? "empty" : "data", role: "meister", canCreateOrder: true, projection: { ...projection, orders, priority: orders, recent: orders } }} />,
    );
    expect(dayLine(container)).toBe(expected);
  });

  it("zeigt ehrliche Leer-, Verweigert- und Fehlerzustaende", () => {
    const empty = { ...projection, orders: [], priority: [], recent: [], dominant: null } satisfies OrdersHomeProjection;
    const { rerender } = render(<RolfHomeClient model={{ kind: "empty", role: "meister", canCreateOrder: true, projection: empty }} />);
    expect(screen.getByText("Heute keine offenen Aufträge.")).toBeInTheDocument();
    expect(screen.getByText("Heute keine fertigen Aufträge.")).toBeInTheDocument();
    expect(screen.getByText("Seit gestern keine neuen Aufträge.")).toBeInTheDocument();
    rerender(<RolfHomeClient model={{ kind: "denied", message: "Nicht freigegeben." }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Tagesbestand nicht öffnen");
    rerender(<RolfHomeClient model={{ kind: "error", message: "Lesefehler." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("gerade nicht verfügbar");
  });
});
