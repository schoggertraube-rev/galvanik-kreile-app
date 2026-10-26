import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderCardView, type OrderCardActionPorts, type OrderCardModel } from "../public";

const actions: OrderCardActionPorts = {
  dueDate: { visible: true, enabled: true, reason: null },
  handoff: { visible: false, enabled: false, reason: null }, evidence: { visible: false, enabled: false, reason: null },
  freeze: { visible: false, enabled: false, reason: null }, invoice: { visible: false, enabled: false, reason: null },
  payment: { visible: false, enabled: false, reason: null }, goodsOut: { visible: false, enabled: false, reason: null },
  feedback: { kind: "idle", message: "" }, onChangeDueDate: vi.fn(), onHandoff: vi.fn(), onFreeze: vi.fn(), onIssueInvoice: vi.fn(),
  onConfirmPayment: vi.fn(), onRecordGoodsOut: vi.fn(), onReload: vi.fn(),
};

const card: OrderCardModel = {
  id: "order-1", version: 1, orderNumber: "A-2026-0042", customerId: "customer-1", customerName: "Muster GmbH",
  title: "Geländer Süd", note: "Bitte separat verpacken", station: "angenommen", status: "angenommen",
  dueAt: "2026-09-20", intakeAt: "2026-09-16T08:00:00.000Z", assignedTo: null,
  dueDateChanges: [{ eventId: "event-1", changedTo: "2026-09-20", reason: "Kundenwunsch", changedAt: "2026-09-17T09:00:00.000Z", changedBy: "Rolf Kreile", aggregateVersion: 2 }],
  items: [{ id: "item-1", position: 1, name: "Haltewinkel", quantity: 2, material: "Stahl", surface: "Blau verzinken", extraWork: [] }],
  evidence: [], frozenAt: null, totalAmountCents: null,
  payment: { kind: "available", value: { mode: "vorkasse", invoiceState: "not_issued", status: null, openAmountCents: null, goodsOutAllowed: false, goodsOut: null } },
};

describe("Orders V8 one-surface truth", () => {
  it("renders the same complete V8 card and customer cross-link", () => {
    const openCustomer = vi.fn();
    render(<OrderCardView actions={actions} onClose={vi.fn()} onOpenCustomer={openCustomer} state={{ kind: "data", card }} />);
    expect(screen.getByTestId("order-card-v8")).toHaveTextContent("A-2026-0042");
    expect(screen.getByText("Teile und Leistungen")).toBeInTheDocument();
    expect(screen.getByText("Auftrag und Zahlung")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Muster GmbH/ }));
    expect(openCustomer).toHaveBeenCalledWith("customer-1");
  });

  it("keeps implementation details out of the visible empty card copy", () => {
    render(
      <OrderCardView
        actions={actions}
        onClose={vi.fn()}
        onOpenCustomer={vi.fn()}
        state={{ kind: "data", card: { ...card, items: [], evidence: [] } }}
      />,
    );
    expect(screen.getByText("Für diesen Auftrag sind noch keine Positionen erfasst.")).toBeInTheDocument();
    expect(screen.getByText("Noch keine Dokumente oder Fotos vorhanden.")).toBeInTheDocument();
    expect(screen.getByTestId("order-card-v8")).not.toHaveTextContent(/Readback|kanonisch|tenantgebunden/i);
  });

  it("requires a reason and exposes the persisted due-date history", () => {
    const onChangeDueDate = vi.fn();
    render(
      <OrderCardView
        actions={{ ...actions, onChangeDueDate }}
        onClose={vi.fn()}
        onOpenCustomer={vi.fn()}
        state={{ kind: "data", card }}
      />,
    );
    expect(screen.getByText("Kundenwunsch")).toBeInTheDocument();
    expect(screen.getByText("Rolf Kreile")).toBeInTheDocument();
    const reason = screen.getByLabelText("Grund der Änderung");
    expect(reason).toBeRequired();
    expect(reason).toHaveAttribute("minLength", "3");
    fireEvent.change(screen.getByLabelText("Neuer Liefertermin"), { target: { value: "2026-09-24" } });
    fireEvent.change(reason, { target: { value: "Material verspätet" } });
    fireEvent.submit(screen.getByRole("button", { name: "Termin mit Grund speichern" }).closest("form")!);
    expect(onChangeDueDate).toHaveBeenCalledWith("2026-09-24", "Material verspätet");
  });

  it("requires an explicit payment method before confirming money received", async () => {
    const onConfirmPayment = vi.fn();
    render(<OrderCardView actions={{ ...actions, payment: { visible: true, enabled: true, reason: null }, onConfirmPayment }} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind: "data", card }} />);
    fireEvent.click(screen.getByRole("button", { name: "Zahlung bestätigen" }));
    expect(screen.getByRole("dialog", { name: "Zahlart wählen und bestätigen" })).toBeInTheDocument();
    expect(onConfirmPayment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Barzahlung bestätigen" }));
    await waitFor(() => expect(onConfirmPayment).toHaveBeenCalledWith("bar"));
  });

  it.each(["denied", "error", "conflict"] as const)("keeps %s fail-closed", (kind) => {
    render(<OrderCardView actions={actions} onClose={vi.fn()} onOpenCustomer={vi.fn()} state={{ kind, message: "Sicherer Zustand" }} />);
    expect(screen.getByText("Sicherer Zustand")).toBeInTheDocument();
    expect(screen.queryByTestId("order-card-v8")).not.toBeInTheDocument();
  });
});
