import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchDialog, type SearchHit, type SearchTenantResult } from "../public";

const ORDER_HIT: SearchHit = {
  type: "ORDER", id: "order-1", title: "Geländer Süd", subtitle: "A-2026-0042 · Termin 18.09.2026",
  status: "angenommen", matchField: "orderNumber", source: "Auftragsbestand", matchLabel: "Auftragsnummer",
  matchValue: "A-2026-0042", context: "A-2026-0042 · Muster GmbH · Termin 18.09.2026",
  href: "/orders/order-1", actionLabel: "Auftragskarte öffnen",
};
const STAMP = "2026-09-16T08:15:00.000Z";
const ok = (hits: SearchHit[], query = "xx", truncated = false): SearchTenantResult => ({
  code: "OK",
  query,
  hits,
  checkedSources: ["Auftragsbestand", "Kundenstamm"],
  checkedAt: STAMP,
  coverage: { returnedHits: hits.length, matchingHitsAtLeast: hits.length, truncated },
});

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("SearchDialog", () => {
  it("focuses on open and waits for two characters", async () => {
    const search = vi.fn();
    render(<SearchDialog debounceMs={1} onOpenChange={vi.fn()} onSelect={vi.fn()} open search={search} />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "x" } });
    await act(() => vi.runAllTimersAsync());
    expect(search).not.toHaveBeenCalled();
    expect(screen.getByTestId("search-backdrop").parentElement).toBe(document.body);
  });

  it("states checked sources, timestamp and safe alternatives without forbidden not-found wording", async () => {
    const search = vi.fn().mockResolvedValue(ok([], "Unbekannt"));
    render(<SearchDialog debounceMs={1} onOpenChange={vi.fn()} onSelect={vi.fn()} open search={search} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Unbekannt" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByText(/keine belegte Übereinstimmung/)).toBeInTheDocument();
    expect(screen.getByText(/Interne Quellen: Auftragsbestand und Kundenstamm/)).toBeInTheDocument();
    expect(screen.getByText(/Kundenname, Auftragsnummer, Teil oder Material/)).toBeInTheDocument();
    expect(screen.queryByText(/nicht gefunden|Keine Treffer gefunden/i)).not.toBeInTheDocument();
  });

  it("shows evidence/context and opens one result by keyboard or touch", async () => {
    const second = { ...ORDER_HIT, id: "order-2", title: "Zweiter Auftrag" };
    const search = vi.fn().mockResolvedValue(ok([ORDER_HIT, second], "Auftrag"));
    const onSelect = vi.fn();
    render(<SearchDialog debounceMs={1} onOpenChange={vi.fn()} onSelect={onSelect} open search={search} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Auftrag" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.getAllByText(/Treffer über Auftragsnummer/)[0]).toHaveTextContent("A-2026-0042");
    expect(screen.getAllByText(/Zusammenhang:/)[0]).toHaveTextContent("Muster GmbH");
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("href", "/orders/order-1");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(second);
  });

  it("states incomplete coverage instead of presenting a capped result as complete", async () => {
    const search = vi.fn().mockResolvedValue(ok([ORDER_HIT], "Auftrag", true));
    render(<SearchDialog debounceMs={1} onOpenChange={vi.fn()} onSelect={vi.fn()} open search={search} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Auftrag" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByRole("status")).toHaveTextContent("Weitere Treffer sind möglich");
    expect(screen.getByRole("status")).toHaveTextContent("Suchbegriff verfeinern");
  });

  it("discards stale responses", async () => {
    const stale = deferred<SearchTenantResult>(); const current = deferred<SearchTenantResult>();
    const search = vi.fn().mockImplementationOnce(() => stale.promise).mockImplementationOnce(() => current.promise);
    render(<SearchDialog debounceMs={1} onOpenChange={vi.fn()} onSelect={vi.fn()} open search={search} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "alt" } }); await act(() => vi.runAllTimersAsync());
    fireEvent.change(input, { target: { value: "neu" } }); await act(() => vi.runAllTimersAsync());
    await act(async () => current.resolve(ok([ORDER_HIT], "neu")));
    await act(async () => stale.resolve(ok([], "alt")));
    expect(screen.getByText("Geländer Süd")).toBeInTheDocument();
  });

  it("supports Ctrl/Cmd+K, Escape and backdrop closing", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<SearchDialog onOpenChange={onOpenChange} onSelect={vi.fn()} open={false} search={vi.fn()} />);
    fireEvent.keyDown(document, { ctrlKey: true, key: "k" }); expect(onOpenChange).toHaveBeenLastCalledWith(true);
    rerender(<SearchDialog onOpenChange={onOpenChange} onSelect={vi.fn()} open search={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" }); expect(onOpenChange).toHaveBeenLastCalledWith(false);
    fireEvent.mouseDown(screen.getByTestId("search-backdrop")); expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
