import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrdersHomeProjection } from "@/modules/orders/public";

const ports = vi.hoisted(() => ({
  openOrder: vi.fn(),
  openInvoice: vi.fn(),
  requestCreate: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  permissions: { loading: false, canCreateOrder: true, canWorkOrders: true },
}));
vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: (selector: (state: { openOrder: typeof ports.openOrder; openInvoice: typeof ports.openInvoice }) => unknown) => selector({ openOrder: ports.openOrder, openInvoice: ports.openInvoice }) }));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({ requestGlobalCreate: ports.requestCreate }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: ports.push, refresh: ports.refresh }) }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({
    loading: ports.permissions.loading,
    hasArea: (area: string) => (area === "eingang" && ports.permissions.canCreateOrder) || (area === "auftraege" && ports.permissions.canWorkOrders),
  }),
}));

import { dayLineParts, RolfHomeClient } from "../RolfHomeClient";

const actionPorts = {
  savePreferences: vi.fn().mockResolvedValue({ code: "OK" }),
  saveReminder: vi.fn().mockResolvedValue({ code: "OK" }),
  discardDraft: vi.fn().mockResolvedValue({ code: "OK" }),
  assignOrder: vi.fn().mockResolvedValue({ code: "OK" }),
};

beforeEach(() => {
  vi.clearAllMocks();
  ports.permissions.loading = false;
  ports.permissions.canCreateOrder = true;
  ports.permissions.canWorkOrders = true;
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

const dashboard = {
  items: [{ key: "order:order-1", field: "today" as const, kind: "order" as const, title: "A-2026-0001 · Muster GmbH", meta: "Bauteil · heute", urgency: "conflict" as const, orderId: "order-1", orderVersion: 1, dueDate: "2026-09-18" }],
  visibleFields: ["today", "assign", "money", "bundle"] as const,
  layout: [
    { field: "action" as const, column: "left" as const, order: 0 },
    { field: "assign" as const, column: "left" as const, order: 1 },
    { field: "today" as const, column: "right" as const, order: 2 },
    { field: "money" as const, column: "right" as const, order: 3 },
  ],
  defaultLayout: [
    { field: "action" as const, column: "left" as const, order: 0 },
    { field: "assign" as const, column: "left" as const, order: 1 },
    { field: "today" as const, column: "right" as const, order: 2 },
    { field: "money" as const, column: "right" as const, order: 3 },
  ],
  allowedFields: ["today", "assign", "money", "bundle"] as const,
  phillipUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  outlookMessage: null,
};

describe("Rolf 'Der Tag' in V1.1 mit echter Projektion", () => {
  it("zeigt den V1.1-Aufbau und öffnet Ware raus für den heute fälligen Auftrag", () => {
    render(<RolfHomeClient ports={actionPorts} model={{ kind: "data", role: "meister", canCreateOrder: true, canWorkOrders: true, canDelegate: true, dashboard: { ...dashboard, visibleFields: [...dashboard.visibleFields] }, projection }} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId("rolf-v11-home")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Der Tag" })).toHaveClass("kr-seite-titel");
    expect(screen.getByRole("region", { name: "Lage" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Lage" })).getByText("Konflikt")).toBeInTheDocument();
    expect(screen.getByText("Heute fällig")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Später" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weitere" })).toBeInTheDocument();
    const open = screen.getByRole("button", { name: "Ware raus" });
    expect(open.closest(".kr-hb-eintrag")).toHaveClass("kr-hb-eintrag--konflikt", "kr-fokus");
    fireEvent.click(open);
    expect(ports.openOrder).toHaveBeenCalledWith("order-1");
  });

  it("zeigt nur die aktuell zulässigen Später-Zeiten", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T08:00:00.000Z"));
    const futureDashboard = { ...dashboard, items: [{ ...dashboard.items[0], dueDate: "2026-10-30" }], visibleFields: [...dashboard.visibleFields] };
    render(<RolfHomeClient ports={actionPorts} model={{ kind: "data", role: "meister", canCreateOrder: true, canWorkOrders: true, canDelegate: true, dashboard: futureDashboard, projection }} />);
    fireEvent.click(screen.getByRole("button", { name: "Später" }));
    expect(screen.getByRole("heading", { name: "Später erinnern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "heute Nachmittag" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "morgen früh" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "nach dem Termin" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("hides reminder choices that would cross today's due date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T08:00:00.000Z"));
    const dueDashboard = { ...dashboard, items: [{ ...dashboard.items[0], dueDate: "2026-10-28" }], visibleFields: [...dashboard.visibleFields] };
    render(<RolfHomeClient ports={actionPorts} model={{ kind: "data", role: "meister", canCreateOrder: true, canWorkOrders: true, canDelegate: true, dashboard: dueDashboard, projection }} />);
    fireEvent.click(screen.getByRole("button", { name: "Später" }));
    expect(screen.getByRole("button", { name: "heute Nachmittag" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "morgen früh" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "nach dem Termin" })).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("keeps a snoozed entry visible, dimmed, and at the end", () => {
    const active = { ...dashboard.items[0], key: "order:active", title: "A-2026-0002 · Aktiv" };
    const snoozed = { ...dashboard.items[0], key: "order:snoozed", snoozedUntil: "2026-10-29T06:00:00.000Z" };
    const { container } = render(<RolfHomeClient ports={actionPorts} model={{ kind: "data", role: "meister", canCreateOrder: true, canWorkOrders: true, canDelegate: true, dashboard: { ...dashboard, items: [snoozed, active], visibleFields: [...dashboard.visibleFields] }, projection }} />);
    const rows = [...container.querySelectorAll(".kr-hb-eintrag")];
    expect(rows[0]).toHaveTextContent("A-2026-0002");
    expect(rows[1]).toHaveClass("kr-hb-eintrag--gedimmt");
    expect(rows[1]).toHaveTextContent("Aufgeschoben bis");
    expect(rows[1]).toHaveTextContent("zählt weiter mit");
  });

  it("öffnet beim Zuordnen genau die ausgewählte eingehende Mail", () => {
    const mail = { key: "mail:graph-message-42", field: "assign" as const, kind: "mail" as const, title: "TEST Anfrage", meta: "TEST Absender", urgency: "decision" as const, graphMessageId: "graph-message-42" };
    render(<RolfHomeClient ports={actionPorts} model={{ kind: "data", role: "meister", canCreateOrder: true, canWorkOrders: true, canDelegate: true, dashboard: { ...dashboard, items: [mail], visibleFields: [...dashboard.visibleFields] }, projection }} />);

    fireEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

    expect(ports.requestCreate).toHaveBeenCalledWith({
      intent: "DIRECT_INTAKE",
      prefill: { sourceMode: "mail", graphMessageId: "graph-message-42" },
    });
  });

  it("benennt mehrere Konflikte im Plural", () => {
    const secondConflict = { ...dashboard.items[0], key: "order:order-2", orderId: "order-2", title: "A-2026-0002 · Muster GmbH" };
    render(<RolfHomeClient ports={actionPorts} model={{ kind: "data", role: "meister", canCreateOrder: true, canWorkOrders: true, canDelegate: true, dashboard: { ...dashboard, items: [...dashboard.items, secondConflict], visibleFields: [...dashboard.visibleFields] }, projection }} />);
    expect(within(screen.getByRole("region", { name: "Lage" })).getByText("Konflikte")).toBeInTheDocument();
  });

  it("uses the concrete money action for overdue invoices and open prepayment", () => {
    const money = [
      { key: "invoice:invoice-1", field: "money" as const, kind: "invoice" as const, title: "R-2026-0001 · Muster GmbH", meta: "100,00 € · fällig 27.10.2026", urgency: "conflict" as const, invoiceId: "invoice-1", primaryActionLabel: "Erinnern" as const },
      { key: "prepayment:order-1", field: "money" as const, kind: "order" as const, title: "A-2026-0001 · Vorkasse offen", meta: "Muster GmbH · 100,00 € · Versand gesperrt", urgency: "warning" as const, orderId: "order-1", primaryActionLabel: "Zahlung bestätigen" as const },
    ];
    render(<RolfHomeClient ports={actionPorts} model={{ kind: "data", role: "meister", canCreateOrder: true, canWorkOrders: true, canDelegate: true, dashboard: { ...dashboard, items: money, visibleFields: [...dashboard.visibleFields] }, projection }} />);

    fireEvent.click(screen.getByRole("button", { name: "Erinnern" }));
    fireEvent.click(screen.getByRole("button", { name: "Zahlung bestätigen" }));

    expect(ports.openInvoice).toHaveBeenCalledWith("invoice-1");
    expect(ports.openOrder).toHaveBeenCalledWith("order-1");
  });

  it("opens the existing bundle path with the selected surface", () => {
    const bundle = { key: "bundle:Zink & Nickel", field: "bundle" as const, kind: "bundle" as const, title: "2 Aufträge bündeln", meta: "Zink & Nickel", urgency: "decision" as const, bundleSurface: "Zink & Nickel", primaryActionLabel: "Bündel öffnen" as const };
    render(<RolfHomeClient ports={actionPorts} model={{ kind: "data", role: "meister", canCreateOrder: true, canWorkOrders: true, canDelegate: true, dashboard: { ...dashboard, items: [bundle], visibleFields: [...dashboard.visibleFields], layout: [{ field: "action", column: "left", order: 0 }, { field: "bundle", column: "left", order: 1 }] }, projection }} />);

    fireEvent.click(screen.getByRole("button", { name: "Bündel öffnen" }));

    expect(ports.push).toHaveBeenCalledWith("/warendurchlauf?bundle=1&surface=Zink%20%26%20Nickel");
  });

  it("keeps the complete field layout code hidden behind the planned stage-2 connection", async () => {
    render(<RolfHomeClient ports={actionPorts} model={{ kind: "data", role: "meister", canCreateOrder: true, canWorkOrders: true, canDelegate: true, dashboard: { ...dashboard, visibleFields: [...dashboard.visibleFields], layout: [...dashboard.layout], defaultLayout: [...dashboard.defaultLayout], allowedFields: [...dashboard.allowedFields] }, projection }} />);

    expect(screen.getByRole("button", { name: "Anpassen · geplant" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bündeln · geplant" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Felder zuordnen" })).not.toBeInTheDocument();
    expect(actionPorts.savePreferences).not.toHaveBeenCalled();
  });

  it("führt readonly ohne Warenausgang-Aktion", () => {
    render(<RolfHomeClient ports={actionPorts} model={{ kind: "data", role: "readonly", canCreateOrder: false, canWorkOrders: false, canDelegate: false, dashboard: { ...dashboard, visibleFields: [...dashboard.visibleFields] }, projection }} />);
    expect(screen.queryByRole("button", { name: /Ware raus öffnen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Weitere" })).not.toBeInTheDocument();
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
    const emptyDashboard = { ...dashboard, items: [], visibleFields: [...dashboard.visibleFields] };
    const { rerender } = render(<RolfHomeClient ports={actionPorts} model={{ kind: "empty", role: "meister", canCreateOrder: true, canWorkOrders: true, canDelegate: true, dashboard: emptyDashboard, projection: empty }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Noch keine Handlungen für dich.");
    expect(screen.getByRole("button", { name: "Neuer Eingang" })).toBeInTheDocument();
    rerender(<RolfHomeClient ports={actionPorts} model={{ kind: "denied", message: "Nicht freigegeben." }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Tagesbestand nicht öffnen");
    rerender(<RolfHomeClient ports={actionPorts} model={{ kind: "error", message: "Lesefehler." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("gerade nicht verfügbar");
    rerender(<RolfHomeClient ports={actionPorts} model={{ kind: "no_areas" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Noch keine Bereiche freigegeben");
  });
});
