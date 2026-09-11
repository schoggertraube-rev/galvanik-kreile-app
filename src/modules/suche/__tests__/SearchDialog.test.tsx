import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchDialog, type SearchHit, type SearchTenantResult } from "../public";

const ORDER_HIT: SearchHit = {
  type: "ORDER",
  id: "order-1",
  title: "Geländer Süd",
  subtitle: "A-2026-0042 · Termin 18.09.2026",
  status: "galvanik",
  matchField: "orderNumber",
  source: "Auftragsbestand",
  matchLabel: "Auftragsnummer",
  matchValue: "A-2026-0042",
  context: "A-2026-0042 · Muster GmbH · Termin 18.09.2026",
  actionLabel: "Auftragskarte öffnen",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("SearchDialog", () => {
  it("opens with focus and does not call search below two characters", async () => {
    const search = vi.fn();
    render(<SearchDialog debounceMs={1} onOpenChange={vi.fn()} onSelect={vi.fn()} open search={search} />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "x" } });
    await act(() => vi.runAllTimersAsync());
    expect(search).not.toHaveBeenCalled();
    expect(screen.getByTestId("search-dialog")).toHaveAttribute("data-state", "idle");
  });

  it.each([
    [{ code: "OK", query: "xx", hits: [] }, "empty"],
    [{ code: "UNAUTHENTICATED", message: "Anmeldung fehlt" }, "denial"],
    [{ code: "UNAVAILABLE", message: "Nicht verfügbar" }, "error"],
    [{ code: "CONFLICT", message: "Neu laden" }, "conflict"],
  ] as const)("renders the honest %s result as %s", async (result, state) => {
    const search = vi.fn().mockResolvedValue(result);
    render(<SearchDialog debounceMs={1} onOpenChange={vi.fn()} onSelect={vi.fn()} open search={search} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "xx" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByTestId("search-dialog")).toHaveAttribute("data-state", state);
  });

  it("explains an empty result with checked sources and safe alternatives", async () => {
    const search = vi.fn().mockResolvedValue({ code: "OK", query: "Unbekannt", hits: [] });
    render(<SearchDialog debounceMs={1} onOpenChange={vi.fn()} onSelect={vi.fn()} open search={search} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Unbekannt" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByText(/Ergebnis für „Unbekannt“/)).toBeInTheDocument();
    expect(screen.getByText(/Auftragsbestand und Kundenstamm wurden geprüft/)).toBeInTheDocument();
    expect(screen.getByText(/Kundenname, Auftragsnummer, Teil oder Material, Oberfläche oder Datum/)).toBeInTheDocument();
    expect(screen.queryByText("Keine Treffer gefunden.")).not.toBeInTheDocument();
  });

  it("shows source, actual match evidence, context and opening action", async () => {
    const search = vi.fn().mockResolvedValue({ code: "OK", query: "A-2026", hits: [ORDER_HIT] });
    render(<SearchDialog debounceMs={1} onOpenChange={vi.fn()} onSelect={vi.fn()} open search={search} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "A-2026" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByText(/Auftragsbestand/)).toBeInTheDocument();
    expect(screen.getByText(/Treffer über Auftragsnummer/)).toHaveTextContent("A-2026-0042");
    expect(screen.getByText(/Zusammenhang:/)).toHaveTextContent("Muster GmbH");
    expect(screen.getByText("Auftragskarte öffnen")).toBeInTheDocument();
  });

  it("supports arrows, Enter and touch/click selection", async () => {
    const second = { ...ORDER_HIT, id: "order-2", title: "Zweiter Auftrag" };
    const search = vi.fn().mockResolvedValue({ code: "OK", query: "Auftrag", hits: [ORDER_HIT, second] });
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const { rerender } = render(<SearchDialog debounceMs={1} onOpenChange={onOpenChange} onSelect={onSelect} open search={search} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Auftrag" } });
    await act(() => vi.runAllTimersAsync());
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(second);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(<SearchDialog debounceMs={1} onOpenChange={onOpenChange} onSelect={onSelect} open search={search} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Auftrag" } });
    await act(() => vi.runAllTimersAsync());
    fireEvent.click(screen.getByRole("option", { name: /Geländer Süd/ }));
    expect(onSelect).toHaveBeenLastCalledWith(ORDER_HIT);
  });

  it("discards a stale response that resolves after the current request", async () => {
    const stale = deferred<SearchTenantResult>();
    const current = deferred<SearchTenantResult>();
    const search = vi.fn()
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => current.promise);
    render(<SearchDialog debounceMs={1} onOpenChange={vi.fn()} onSelect={vi.fn()} open search={search} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "alt" } });
    await act(() => vi.runAllTimersAsync());
    fireEvent.change(input, { target: { value: "neu" } });
    await act(() => vi.runAllTimersAsync());
    await act(async () => current.resolve({ code: "OK", query: "neu", hits: [ORDER_HIT] }));
    expect(screen.getByText("Geländer Süd")).toBeInTheDocument();
    await act(async () => stale.resolve({ code: "OK", query: "alt", hits: [] }));
    expect(screen.getByText("Geländer Süd")).toBeInTheDocument();
    expect(screen.getByTestId("search-dialog")).toHaveAttribute("data-state", "data");
  });

  it("toggles with Ctrl/Cmd+K and closes with Escape or the backdrop", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<SearchDialog onOpenChange={onOpenChange} onSelect={vi.fn()} open={false} search={vi.fn()} />);
    fireEvent.keyDown(document, { ctrlKey: true, key: "k" });
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    rerender(<SearchDialog onOpenChange={onOpenChange} onSelect={vi.fn()} open search={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    fireEvent.mouseDown(screen.getByTestId("search-backdrop"));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
