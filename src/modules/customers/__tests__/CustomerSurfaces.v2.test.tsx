import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomerCardView, type CustomerCardModel } from "../public";

const card: CustomerCardModel = {
  id: "customer-1", customerNumber: "K-1042", name: "Erika Muster", companyName: "Muster GmbH", type: "business",
  contactPerson: "Erika Muster", email: "erika@example.invalid", phone: "+49 000", address: "Testweg 1", zipCode: "70173",
  city: "Stuttgart", country: "Deutschland", classification: null, notes: "Rückruf vormittags", tags: [],
  createdAt: "2026-09-15T08:00:00.000Z", updatedAt: "2026-09-16T08:00:00.000Z", orderCount: 1, wareImHausCount: 1,
  orders: [{ id: "order-1", orderNumber: "A-2026-0042", title: "Geländer", station: "galvanik", status: "angenommen", dueAt: "2026-09-20", version: 1 }],
};

describe("Customer card V2", () => {
  it("renders V2 contact context and opens its real active order", () => {
    const openOrder = vi.fn();
    render(<CustomerCardView state={{ kind: "data", card }} onClose={vi.fn()} onOpenOrder={openOrder} />);
    expect(screen.getByTestId("customer-card-v2")).toHaveTextContent("Muster GmbH");
    expect(screen.getByText("Rückruf vormittags")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /A-2026-0042/ }));
    expect(openOrder).toHaveBeenCalledWith("order-1");
  });

  it("describes an empty customer card without implementation jargon", () => {
    render(
      <CustomerCardView
        state={{
          kind: "data",
          card: { ...card, orders: [], orderCount: 0, wareImHausCount: 0 },
        }}
        onClose={vi.fn()}
        onOpenOrder={vi.fn()}
      />,
    );
    expect(screen.getByText("Für diesen Kunden ist derzeit kein offener Auftrag vorhanden.")).toBeInTheDocument();
    expect(screen.getByText("Keine aktiven Aufträge vorhanden.")).toBeInTheDocument();
    expect(screen.getByTestId("customer-card-v2")).not.toHaveTextContent(/Readback|zurückgelesen|tenantgebunden/i);
  });

  it.each(["denied", "not-found", "error", "conflict"] as const)("keeps %s fail-closed", (kind) => {
    render(<CustomerCardView state={{ kind, message: "Sicherer Zustand" }} onClose={vi.fn()} onOpenOrder={vi.fn()} />);
    expect(screen.getByText("Sicherer Zustand")).toBeInTheDocument();
    expect(screen.queryByTestId("customer-card-v2")).not.toBeInTheDocument();
  });
});
