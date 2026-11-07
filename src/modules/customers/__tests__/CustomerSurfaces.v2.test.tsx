import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomerCardView, type CustomerCardModel } from "../public";

const card: CustomerCardModel = {
  id: "customer-1", customerNumber: "K-1042", name: "Erika Muster", companyName: "Muster GmbH", type: "business",
  contactPerson: "Erika Muster", email: "erika@example.invalid", phone: "+49 000", address: "Testweg",houseNumber:"1",firstName:"Erika",lastName:"Muster", zipCode: "70173",
  city: "Stuttgart", country: "DE", invoiceTermsEnabled: false, classification: null, notes: "Rückruf vormittags", tags: [],
  createdAt: "2026-09-15T08:00:00.000Z", updatedAt: "2026-09-16T08:00:00.000Z", orderCount: 1, wareImHausCount: 1,
  invoiceRevenueCents: 17850, invoiceOpenCents: 8925,
  orders: [{ id: "order-1", orderNumber: "A-2026-0042", title: "Geländer", station: "galvanik", status: "angenommen", dueAt: "2026-09-20", version: 1 }],
};

describe("Customer card V2", () => {
  it("renders V2 contact context and opens its real active order", () => {
    const openOrder = vi.fn();
    render(<CustomerCardView state={{ kind: "data", card }} onClose={vi.fn()} onOpenOrder={openOrder} canManageMoney={true} />);
    expect(screen.getByRole("dialog", { name: "Kundenkarte K-1042" })).toHaveTextContent("Muster GmbH");
    expect(screen.getByText("Rückruf vormittags")).toBeInTheDocument();
    expect(screen.getByText("178,50 €")).toBeInTheDocument();
    expect(screen.getByText("89,25 €")).toBeInTheDocument();
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
    expect(screen.getByText("Keine aktiven Aufträge.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Kundenkarte K-1042" })).not.toHaveTextContent(/Readback|zurückgelesen|tenantgebunden/i);
  });

  it("shows the two customer actions once in the design-system action grid", () => {
    const newOrder = vi.fn();
    render(<CustomerCardView state={{kind:"data",card:{...card,orders:[],orderCount:0,wareImHausCount:0}}}
      onClose={vi.fn()} onOpenOrder={vi.fn()} onNewOrder={newOrder} onSaveCustomer={vi.fn()} />);
    const order = screen.getByRole("button", {name:"Neuer Auftrag"});
    const edit = screen.getByRole("button", {name:"Bearbeiten"});
    expect(order).toHaveAttribute("data-spec-id", "kunde.neuer-auftrag");
    expect(edit).toHaveAttribute("data-spec-id", "kunde.bearbeiten");
    expect(order.parentElement).toHaveClass("kr-qa-raster");
    expect(edit.parentElement).toBe(order.parentElement);
    expect(Array.from(order.parentElement!.querySelectorAll("button")).slice(0,2)).toEqual([order,edit]);
    fireEvent.click(order);
    expect(newOrder).toHaveBeenCalledTimes(1);
    fireEvent.click(edit);
    expect(screen.getByRole("combobox", {name:"Land"})).toBeInTheDocument();
  });

  it("starts without country or payment defaults and hides invoice terms without approval", () => {
    render(
      <CustomerCardView
        state={{ kind: "data", card: { ...card, country: null, paymentPreference: null, invoiceTermsEnabled: false } }}
        onClose={vi.fn()}
        onOpenOrder={vi.fn()}
        onSaveCustomer={vi.fn()} canManageMoney={true}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Bearbeiten" })[0]);
    expect(screen.getByRole("combobox", { name: "Land" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Zahlungsbedingung" })).toHaveValue("");
    expect(screen.queryByRole("option", { name: "Rechnung auf Ziel · 14 Tage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Rechnung 30 Tage" })).not.toBeInTheDocument();
  });

  it("E26 shows an unapproved legacy invoice preference as missing without selecting a replacement", () => {
    const save=vi.fn();
    render(<CustomerCardView state={{kind:"data",card:{...card,paymentPreference:"rechnung",invoiceTermsEnabled:false}}}
      onClose={vi.fn()} onOpenOrder={vi.fn()} onSaveCustomer={save} canManageMoney={true}/>);
    fireEvent.click(screen.getAllByRole("button",{name:"Bearbeiten"})[0]);
    expect(screen.getByRole("combobox",{name:"Zahlungsbedingung"})).toHaveValue("");
    expect(screen.queryByRole("option",{name:/Rechnung auf Ziel/})).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("offers invoice terms only when the customer is approved for them", () => {
    render(
      <CustomerCardView
        state={{ kind: "data", card: { ...card, paymentPreference: "rechnung", invoiceTermsEnabled: true,invoiceTermDays:14 } }}
        onClose={vi.fn()}
        onOpenOrder={vi.fn()}
        onSaveCustomer={vi.fn()} canManageMoney={true}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Bearbeiten" })[0]);
    expect(screen.getByRole("combobox", { name: "Zahlungsbedingung" })).toHaveValue("rechnung");
    expect(screen.getByRole("option", { name: "Rechnung auf Ziel · 14 Tage" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Rechnung auf Ziel · 30 Tage" })).not.toBeInTheDocument();
  });

  it("edits free-text agreements through the one existing customer save path", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const { container } = render(
      <CustomerCardView
        state={{ kind: "data", card: {
          ...card,
          paymentPreference: "bar",
          agreements: [{
            id: "agreement-1", customerId: card.id, orderId: null, position: 1,
            label: "Verpackung", value: "Bitte stoßfest verpacken", type: null, targetDays: null,
            money: false, notice: true, validUntil: null, reason: null, version: 1,
            revokedAt: null, revokedBy: null, revokeReason: null, createdAt: "2026-09-16T08:00:00.000Z", createdBy: "Rolf",
          }],
        } }}
        onClose={vi.fn()} onOpenOrder={vi.fn()} onSaveCustomer={save} canManageMoney={true}
      />,
    );
    expect(screen.getByText("Verpackung: Bitte stoßfest verpacken")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Bearbeiten" })[0]);
    expect(screen.getAllByRole("heading", { name: "Absprachen & Eigenheiten" })).toHaveLength(2);
    expect(container.querySelector('[data-spec-id="kundebearbeiten.absprache.wert"]')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("Bitte stoßfest verpacken"), { target: { value: "Bitte gepolstert verpacken" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    const forceSave = screen.queryByRole("button", { name: "Trotzdem speichern" });
    if (forceSave) fireEvent.click(forceSave);
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      agreements: [expect.objectContaining({ id: "agreement-1", wert: "Bitte gepolstert verpacken", geld: false, hinweis: true })],
    })));
  });

  it("keeps hidden money agreements counted without exposing them", () => {
    render(
      <CustomerCardView
        state={{ kind: "data", card: { ...card, agreements: [], agreementSlotsAvailable: 0 } }}
        onClose={vi.fn()} onOpenOrder={vi.fn()} onSaveCustomer={vi.fn()} canManageMoney={false}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Bearbeiten" })[0]);
    expect(screen.queryByText("Geld (Preis, Zahlung)")).not.toBeInTheDocument();
    expect(screen.getByText("Höchstens 20 Absprachen möglich.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Absprache hinzufügen" })).toBeDisabled();
  });

  it.each(["denied", "not-found", "error", "conflict"] as const)("keeps %s fail-closed", (kind) => {
    render(<CustomerCardView state={{ kind, message: "Sicherer Zustand" }} onClose={vi.fn()} onOpenOrder={vi.fn()} />);
    expect(screen.getByText("Sicherer Zustand")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Kundenkarte K-1042" })).not.toBeInTheDocument();
  });
});
