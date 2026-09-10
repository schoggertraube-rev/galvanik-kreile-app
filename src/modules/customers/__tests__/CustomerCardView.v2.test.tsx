import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomerCardView } from "../public";
import type { CustomerCardModel, CustomerCardState } from "../public";

const card: CustomerCardModel = {
  id: "customer-1", customerNumber: "K-18", name: "Max Mustermann", companyName: null, type: "Privatkunde",
  contactPerson: "Max Mustermann", email: "max@example.test", phone: "+49 69 123", address: "Musterweg 1", zipCode: "60325", city: "Frankfurt", country: "DE",
  classification: "Stammkunde", notes: "Originalschrauben mit Patina erhalten.", tags: ["Oldtimer"],
  createdAt: "2024-03-01T00:00:00.000Z", updatedAt: "2026-05-20T00:00:00.000Z", orderCount: 2, wareImHausCount: 1,
  orders: [
    { id: "order-1", orderNumber: "A-42", title: "Chrom-Restauration", station: "galvanik", status: "galvanik", dueAt: "2030-07-15T00:00:00.000Z", version: 2 },
    { id: "order-2", orderNumber: "A-12", title: "Zierrat", station: "abgeholt", status: "abgeholt", dueAt: "2025-05-15T00:00:00.000Z", version: 5 },
  ],
};

describe("Kundenkarte V2", () => {
  it("trägt Kontaktkopf, Handlungsbedarf, aktive Aufträge, Notizen, Historie, Dokumentenwahrheit und Dock", () => {
    const openOrder = vi.fn();
    render(<CustomerCardView state={{ kind: "data", card }} onOpenOrder={openOrder} onClose={vi.fn()} />);
    expect(screen.getByTestId("customer-card-v2")).toBeVisible();
    expect(screen.getAllByText("Max Mustermann").length).toBeGreaterThan(0);
    expect(screen.getByText("Nächster Handlungsbedarf")).toBeVisible();
    expect(screen.getByText("Originalschrauben mit Patina erhalten.")).toBeVisible();
    expect(screen.getByText("Historie & Referenzen")).toBeVisible();
    expect(screen.getByText(/Kein eigener Kunden-Dokumentenvertrag/)).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: /A-42/ })[0]!);
    expect(openOrder).toHaveBeenCalledWith("order-1");
  });

  it.each(["loading", "denied", "error", "conflict", "not-found"] as const)("stellt %s fail-closed getrennt dar", (kind) => {
    const state = kind === "loading" ? { kind } : { kind, message: "Generische Meldung" };
    render(<CustomerCardView state={state as CustomerCardState} onOpenOrder={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId("customer-card-v2")).not.toBeInTheDocument();
  });
});
