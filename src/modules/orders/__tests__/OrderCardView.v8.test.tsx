import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderCardView } from "../public";
import type { OrderCardModel, OrderCardState } from "../public";

const card: OrderCardModel = {
  id: "order-1", version: 4, orderNumber: "A-2026-0042", customerId: "customer-1", customerName: "Mustermann GmbH",
  title: "Chrom-Restauration", note: "Kanten vorsichtig bearbeiten.", station: "fertig", status: "fertig",
  dueAt: "2030-07-15T00:00:00.000Z", intakeAt: "2026-05-18T14:30:00.000Z", assignedTo: "M. Krause",
  items: [{ id: "item-1", position: 1, name: "Stoßstange", quantity: 1, material: "Stahl", surface: "Chrom hochglanz", extraWork: [{ lineId: "line-1", name: "Nachpolitur", minutes: 20, amountCents: 2500, frozen: true }] }],
  evidence: [{ key: "e-1", source: "ORDER_INTAKE_ATTACHMENT", state: "VERIFIED", recordedAt: "2026-05-18T14:31:00.000Z", itemIds: ["item-1"] }],
  frozenAt: "2026-05-20T10:00:00.000Z", totalAmountCents: 2500,
  payment: { mode: "vorkasse", invoiceState: "issued", status: "offen", openAmountCents: 2500, goodsOutAllowed: false, goodsOut: null },
};

describe("Auftragskarte V8", () => {
  it("trägt Identität, Risiko, Lifecycle, Zahlung, nächsten Schritt, Teile, Notizen, Belege, Verlauf und Aktionsdock", () => {
    const openCustomer = vi.fn();
    render(<OrderCardView state={{ kind: "data", card }} onOpenCustomer={openCustomer} onClose={vi.fn()} />);
    expect(screen.getByTestId("order-card-v8")).toBeVisible();
    expect(screen.getByText("A-2026-0042")).toBeVisible();
    expect(screen.getByLabelText("Auftragsverlauf")).toHaveTextContent("angenommen");
    expect(screen.getByLabelText("Auftragsverlauf")).toHaveTextContent("Zahlung · getrennte Schwelle");
    expect(screen.getByText(/Vollzahlung bestätigen/)).toBeVisible();
    expect(screen.getByText(/Stahl → Chrom hochglanz/)).toBeVisible();
    expect(screen.getByText("Kanten vorsichtig bearbeiten.")).toBeVisible();
    expect(screen.getByText("Eingangsfoto")).toBeVisible();
    expect(screen.getByText("Auftragsstand eingefroren")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Mustermann GmbH/ }));
    expect(openCustomer).toHaveBeenCalledWith("customer-1");
  });

  it.each(["loading", "denied", "error", "conflict", "not-found"] as const)("stellt %s ohne Data-Fläche fail-closed dar", (kind) => {
    const state = kind === "loading" ? { kind } : { kind, message: "Generische Meldung" };
    render(<OrderCardView state={state as OrderCardState} onOpenCustomer={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId("order-card-v8")).not.toBeInTheDocument();
  });
});
