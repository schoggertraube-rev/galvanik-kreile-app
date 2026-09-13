import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchHit } from "@/modules/suche/public";
import { GlobalSearch } from "../GlobalSearch";

const boundary = vi.hoisted(() => ({
  openCustomer: vi.fn(),
  openOrder: vi.fn(),
  search: vi.fn(),
}));

vi.mock("@/app/actions/search.actions", () => ({ searchTenantAction: boundary.search }));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: (selector: (state: { openCustomer: typeof boundary.openCustomer; openOrder: typeof boundary.openOrder }) => unknown) =>
    selector({ openCustomer: boundary.openCustomer, openOrder: boundary.openOrder }),
}));

const ORDER: SearchHit = {
  type: "ORDER",
  id: "order-42",
  title: "Geländer Süd",
  subtitle: "A-2026-0042 · Termin 18.09.2026",
  status: "galvanik",
  matchField: "part",
  source: "Auftragsbestand",
  matchLabel: "Teil",
  matchValue: "Geländer Süd",
  context: "A-2026-0042 · Muster GmbH",
  actionLabel: "Auftragskarte öffnen",
};

const CUSTOMER: SearchHit = {
  type: "CUSTOMER",
  id: "customer-42",
  title: "Muster GmbH",
  subtitle: "K-1042 · Stuttgart",
  status: "business",
  matchField: "name",
  source: "Kundenstamm",
  matchLabel: "Kundenname",
  matchValue: "Muster GmbH",
  context: "Muster GmbH · K-1042 · Stuttgart",
  actionLabel: "Kundenkarte öffnen",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  boundary.search.mockResolvedValue({ code: "OK", query: "Muster", hits: [ORDER, CUSTOMER] });
});

afterEach(() => vi.useRealTimers());

describe("W2C GlobalSearch real module adapter", () => {
  it("binds the server search and opens the existing order overlay", async () => {
    const onOpenChange = vi.fn();
    render(<GlobalSearch onOpenChange={onOpenChange} open />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Muster" } });
    await act(() => vi.runAllTimersAsync());
    fireEvent.click(screen.getByRole("option", { name: /Geländer Süd/ }));
    expect(boundary.search).toHaveBeenCalledWith("Muster");
    expect(boundary.openOrder).toHaveBeenCalledWith("order-42");
    expect(boundary.openCustomer).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens the existing customer overlay and closes the search", async () => {
    const onOpenChange = vi.fn();
    render(<GlobalSearch onOpenChange={onOpenChange} open />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Muster" } });
    await act(() => vi.runAllTimersAsync());
    const customerOption = screen.getAllByRole("option").find((option) => option.dataset.hitType === "CUSTOMER");
    if (!customerOption) throw new Error("CUSTOMER_OPTION_MISSING");
    fireEvent.click(customerOption);
    expect(boundary.openCustomer).toHaveBeenCalledWith("customer-42");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("contains only the new module/action/overlay composition and no legacy search path", async () => {
    const source = await readFile("src/components/layout/GlobalSearch.tsx", "utf8");
    expect(source).toContain("@/modules/suche/public");
    expect(source).toContain("@/app/actions/search.actions");
    expect(source).toContain("@/lib/overlayStore");
    expect(source).not.toContain("@/lib/search/");
    expect(source).not.toContain("global-search-actions");
    expect(source).not.toContain("useGlobalSearch");
    expect(source).not.toContain("GlobalSearchAIResult");
    expect(source).not.toContain("useRouter");
    expect(source).not.toMatch(/\/orders|\/customers/);
  });
});
