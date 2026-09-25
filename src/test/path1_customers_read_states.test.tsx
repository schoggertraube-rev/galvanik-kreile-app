import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer } from "@/lib/types/customer";
import { CustomersAppAdapter } from "@/app/customers/CustomersAppAdapter";

const ports = vi.hoisted(() => ({
  getCustomersDb: vi.fn(),
  openCustomer: vi.fn(),
}));

vi.mock("@/app/actions/customers.actions", () => ({ getCustomersDb: ports.getCustomersDb }));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({ requestGlobalCreate: vi.fn() }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({ hasPermission: () => false, loading: false }),
}));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: (selector: (state: { openCustomer: typeof ports.openCustomer }) => unknown) =>
    selector({ openCustomer: ports.openCustomer }),
}));

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: "2c3f0d18-7903-4b27-8175-348f7e91b7cb",
  customerNumber: "K-2026-0018",
  name: "Kreile Fahrzeugtechnik",
  type: "business",
  city: "Esslingen",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe("CustomersAppAdapter", () => {
  it("shows loading until the customer read has settled", () => {
    ports.getCustomersDb.mockReturnValue(new Promise(() => undefined));
    render(<CustomersAppAdapter />);

    expect(screen.getByRole("status")).toHaveTextContent("Kunden werden geladen.");
    expect(screen.queryByText("Keine Kunden.")).not.toBeInTheDocument();
  });

  it("shows an empty list only after a successful empty read", async () => {
    ports.getCustomersDb.mockResolvedValue({ ok: true, data: [] });
    render(<CustomersAppAdapter />);

    expect(await screen.findByText("Keine Kunden.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("keeps a failed read distinct from an empty list", async () => {
    ports.getCustomersDb.mockResolvedValue({ ok: false, error: "DB_ERROR", message: "neutral" });
    render(<CustomersAppAdapter />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Kundenstamm konnte nicht sicher geladen werden.");
    expect(screen.queryByText("Keine Kunden.")).not.toBeInTheDocument();
  });

  it("renders the real customer label without internal identifiers or raw types", async () => {
    ports.getCustomersDb.mockResolvedValue({
      ok: true,
      data: [customer(), customer({ id: "a1b2c3d4-5678-4abc-9def-0123456789ab", customerNumber: "a1b2c3d4", name: "Privatkundenwerkstatt", type: "private" })],
    });
    render(<CustomersAppAdapter />);

    const row = (await screen.findByText("Kreile Fahrzeugtechnik")).closest(".app-row");
    if (!(row instanceof HTMLElement)) throw new Error("Kundenzeile fehlt");
    expect(row).toHaveTextContent("K-2026-0018 · Gewerbekunde · Esslingen");
    expect(screen.queryByText("business")).not.toBeInTheDocument();
    expect(screen.queryByText("a1b2c3d4")).not.toBeInTheDocument();
  });

  it("opens the selected customer card with its real ID", async () => {
    const selected = customer();
    ports.getCustomersDb.mockResolvedValue({ ok: true, data: [selected] });
    render(<CustomersAppAdapter />);

    fireEvent.click(await screen.findByRole("button", { name: "Karte öffnen →" }));

    expect(ports.openCustomer).toHaveBeenCalledWith(selected.id);
  });
});
