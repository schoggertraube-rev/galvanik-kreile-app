import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRole, PermissionKey } from "@/lib/auth/authorizationContract";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { OperationalOrder } from "@/lib/types/operationalOrder";

const ports = vi.hoisted(() => ({
  getOperationalOrders: vi.fn(),
  openErfassung: vi.fn(),
  openOrder: vi.fn(),
}));

vi.mock("@/lib/server/operationalOrders", () => ({
  getOperationalOrders: ports.getOperationalOrders,
}));
vi.mock("@/components/erfassung/ErfassungProvider", () => ({
  useErfassung: () => ({ openErfassung: ports.openErfassung }),
}));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: (selector: (state: { openOrder: typeof ports.openOrder }) => unknown) =>
    selector({ openOrder: ports.openOrder }),
}));

function authorization(
  role: AppRole,
  permissions: readonly PermissionKey[] = ["perm_view_leitstand", "perm_data_orders"],
): AuthorizationSnapshot {
  return {
    userId: `user-${role}`,
    tenantId: "tenant-rolf-v8",
    displayName: role === "readonly" ? "Lesender Betrieb" : `Rolf ${role}`,
    role,
    permissions,
    active: true,
  };
}

function order(
  id: string,
  orderNumber: string,
  station: string,
  risk: string,
  dueValue: string,
): OperationalOrder {
  return {
    id,
    version: 3,
    orderNumber,
    customerId: `customer-${id}`,
    customerName: `Kunde ${id}`,
    title: `Auftrag ${orderNumber}`,
    task: "Oberfläche bearbeiten",
    itemDescription: `Bauteil ${id}`,
    surfaceRequested: "Verzinken",
    station,
    status: station,
    statusText: station === "fertig" ? "Fertig gemeldet" : "In Bearbeitung",
    risk,
    currentStationId: station,
    parts: [],
    intakeDate: "2026-09-09",
    dueDate: "2026-09-11",
    dueLabel: "Termin",
    dueValue,
    createdAt: "2026-09-09T08:00:00.000Z",
  };
}

const realOrders = [
  order("critical", "A-CRITICAL", "galvanik", "red", "11.09.2026"),
  order("goods-out", "A-GOODS-OUT", "fertig", "yellow", "12.09.2026"),
  order("planned", "A-PLANNED", "wareneingang", "green", "18.09.2026"),
];

beforeEach(() => {
  vi.clearAllMocks();
  ports.getOperationalOrders.mockResolvedValue(realOrders);
});

afterEach(() => cleanup());

describe("Rolf V8 role home", () => {
  it.each(["buero", "meister"] as const)(
    "renders persisted priorities and real quick-action ports for %s",
    async (role) => {
      const { RolfHome } = await import("../RolfHome");
      render(await RolfHome({ authorization: authorization(role) }));

      expect(screen.getByTestId("rolf-v8-home")).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Schnellaktionen" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Das braucht dich" })).toBeInTheDocument();
      expect(screen.getByText("Kritisch")).toBeInTheDocument();
      expect(screen.queryByText("Dringend")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /A-CRITICAL/ }));
      expect(ports.openOrder).toHaveBeenCalledWith("critical");

      const quickActions = screen.getByRole("navigation", { name: "Schnellaktionen" });
      fireEvent.click(within(quickActions).getByRole("button", { name: /Neuer Eingang/ }));
      expect(ports.openErfassung).toHaveBeenCalledWith({
        mode: "order",
        intent: "create_order",
        source: "shortcut",
        returnTo: "/",
      });

      fireEvent.click(within(quickActions).getByRole("button", { name: /Ware raus/ }));
      const dialog = screen.getByRole("dialog", { name: "Ware raus" });
      expect(within(dialog).getByRole("button", { name: /A-GOODS-OUT/ })).toBeInTheDocument();
      expect(within(dialog).queryByText("A-CRITICAL", { exact: true })).not.toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: /A-GOODS-OUT/ }));
      expect(ports.openOrder).toHaveBeenLastCalledWith("goods-out");
    },
  );

  it("keeps the Rolf structure readable for readonly without exposing mutation shortcuts", async () => {
    const { RolfHome } = await import("../RolfHome");
    render(await RolfHome({ authorization: authorization("readonly", ["perm_view_leitstand"]) }));

    expect(screen.getByTestId("rolf-v8-home")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Das braucht dich" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Schnellaktionen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Neuer Eingang/ })).not.toBeInTheDocument();
    expect(ports.openErfassung).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /A-CRITICAL/ }));
    expect(ports.openOrder).toHaveBeenCalledWith("critical");
  });

  it("renders an honest empty state after a successful empty tenant read", async () => {
    ports.getOperationalOrders.mockResolvedValueOnce([]);
    const { RolfHome } = await import("../RolfHome");
    render(await RolfHome({ authorization: authorization("buero") }));

    expect(screen.getByRole("heading", { name: "Heute liegt kein offener Auftrag vor." })).toBeInTheDocument();
    expect(screen.getByText("Auftragsbestand und Werkstattstatus wurden geprüft.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Das braucht dich" })).not.toBeInTheDocument();
  });

  it("fails closed without leaking partial orders when the read port errors", async () => {
    ports.getOperationalOrders.mockRejectedValueOnce(new Error("database detail must stay server-side"));
    const { RolfHome } = await import("../RolfHome");
    render(await RolfHome({ authorization: authorization("meister") }));

    expect(screen.getByRole("alert")).toHaveTextContent("Tagesansicht nicht verfügbar");
    expect(screen.queryByText("database detail must stay server-side")).not.toBeInTheDocument();
    expect(screen.queryByText("A-CRITICAL")).not.toBeInTheDocument();
  });

  it("denies an excluded root role before the operational read port", async () => {
    const { RolfHome } = await import("../RolfHome");
    render(await RolfHome({ authorization: authorization("admin") }));

    expect(screen.getByRole("heading", { name: "Startseite nicht freigegeben" })).toBeInTheDocument();
    expect(ports.getOperationalOrders).not.toHaveBeenCalled();
  });
});
