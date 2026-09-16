import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ search: vi.fn(), openOrder: vi.fn(), openCustomer: vi.fn() }));

vi.mock("@/app/actions/search.actions", () => ({ searchTenantAction: ports.search }));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: (selector: (state: { openOrder: typeof ports.openOrder; openCustomer: typeof ports.openCustomer }) => unknown) => selector({ openOrder: ports.openOrder, openCustomer: ports.openCustomer }),
}));

import { GlobalSearch } from "../GlobalSearch";

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => vi.useRealTimers());

describe("W2C GlobalSearch real Lane-0 contract", () => {
  it("renders only while open and contains no unavailable shell", () => {
    const { rerender } = render(<GlobalSearch onOpenChange={vi.fn()} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<GlobalSearch onOpenChange={vi.fn()} open />);
    expect(screen.getByRole("dialog", { name: "Kunden und Aufträge" })).toHaveAttribute("aria-modal", "true");
    expect(screen.queryByText("NOT_AVAILABLE")).not.toBeInTheDocument();
    expect(screen.queryByText(/nicht verfügbar/i)).not.toBeInTheDocument();
  });

  it("opens the same V8/V2 overlay truth for order and customer hits", async () => {
    ports.search.mockResolvedValueOnce({
      code: "OK", query: "A-42", checkedSources: ["Auftragsbestand", "Kundenstamm"], checkedAt: "2026-09-16T08:15:00.000Z",
      hits: [{ type: "ORDER", id: "order-1", title: "Auftrag", subtitle: "A-42", status: "angenommen", matchField: "orderNumber", source: "Auftragsbestand", matchLabel: "Auftragsnummer", matchValue: "A-42", context: "A-42 · Kunde", actionLabel: "Auftragskarte öffnen" }],
    });
    const { rerender } = render(<GlobalSearch onOpenChange={vi.fn()} open />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "A-42" } });
    await act(() => vi.runAllTimersAsync());
    fireEvent.click(screen.getByRole("option", { name: /Auftrag/ }));
    expect(ports.openOrder).toHaveBeenCalledWith("order-1");

    ports.search.mockResolvedValueOnce({
      code: "OK", query: "Kunde", checkedSources: ["Auftragsbestand", "Kundenstamm"], checkedAt: "2026-09-16T08:16:00.000Z",
      hits: [{ type: "CUSTOMER", id: "customer-1", title: "Muster GmbH", subtitle: "K-1", status: "business", matchField: "companyName", source: "Kundenstamm", matchLabel: "Firma", matchValue: "Muster GmbH", context: "Muster GmbH · K-1", actionLabel: "Kundenkarte öffnen" }],
    });
    rerender(<GlobalSearch onOpenChange={vi.fn()} open />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Kunde" } });
    await act(() => vi.runAllTimersAsync());
    fireEvent.click(screen.getByRole("option", { name: /Muster GmbH/ }));
    expect(ports.openCustomer).toHaveBeenCalledWith("customer-1");
  });

  it("keeps denial and port failure fail-closed without partial results", async () => {
    ports.search.mockResolvedValueOnce({ code: "FORBIDDEN", message: "Diese Suche ist für die aktuelle Sitzung nicht freigegeben." });
    const { rerender } = render(<GlobalSearch onOpenChange={vi.fn()} open />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "intern" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByTestId("search-dialog")).toHaveAttribute("data-state", "denial");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    ports.search.mockResolvedValueOnce({ code: "UNAVAILABLE", message: "Die internen Bestände konnten nicht sicher durchsucht werden." });
    rerender(<GlobalSearch onOpenChange={vi.fn()} open />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Fehler" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByTestId("search-dialog")).toHaveAttribute("data-state", "error");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
