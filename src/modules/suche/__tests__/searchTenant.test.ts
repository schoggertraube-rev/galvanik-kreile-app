import { describe, expect, it, vi } from "vitest";
import {
  SEARCH_MAX_HITS,
  SEARCH_MAX_QUERY_LENGTH,
  normalizeSearchQuery,
  searchTenant,
  type SearchCustomerDocument,
  type SearchOrderDocument,
  type SearchPorts,
} from "../public";

const ORDER: SearchOrderDocument = {
  id: "order-1",
  orderNumber: "A-2026-0042",
  customerName: "Muster GmbH",
  title: "Geländer Süd",
  task: "Nacharbeit dokumentieren",
  station: "galvanik",
  status: "galvanik",
  dueDate: "2026-09-18T00:00:00.000Z",
  parts: [{ name: "Haltewinkel 4711", material: "Stahl", surfaceRequested: "Blau verzinken" }],
};

const CUSTOMER: SearchCustomerDocument = {
  id: "customer-1",
  customerNumber: "K-1042",
  name: "Erika Muster",
  companyName: "Muster GmbH",
  customerType: "business",
  city: "Stuttgart",
};

function ports(overrides: Partial<SearchPorts> = {}): SearchPorts {
  return {
    readOrders: vi.fn().mockResolvedValue([ORDER]),
    searchCustomers: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("Path-1 search contract", () => {
  it.each(["", " ", "x", " x "])("does not access ports below the minimum for %j", async (query) => {
    const boundary = ports();
    await expect(searchTenant(query, boundary)).resolves.toEqual({ code: "OK", query: query.trim(), hits: [] });
    expect(boundary.readOrders).not.toHaveBeenCalled();
    expect(boundary.searchCustomers).not.toHaveBeenCalled();
  });

  it("trims valid input and rejects non-string or overlong input without ports", async () => {
    expect(normalizeSearchQuery("  Muster ")).toEqual({ code: "READY", query: "Muster" });
    const boundary = ports();
    await expect(searchTenant(42, boundary)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(searchTenant("x".repeat(SEARCH_MAX_QUERY_LENGTH + 1), boundary)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(boundary.readOrders).not.toHaveBeenCalled();
  });

  it.each([
    ["A-2026", "orderNumber", "Auftragsnummer", "A-2026-0042"],
    ["Geländer", "title", "Auftrag", ORDER.title],
    ["Muster", "customerName", "Kunde", "Muster GmbH"],
    ["Nacharbeit", "task", "Aufgabe", "Nacharbeit dokumentieren"],
    ["4711", "part", "Teil", "Haltewinkel 4711"],
    ["Stahl", "material", "Material", "Stahl"],
    ["Blau verzinken", "surface", "Oberfläche", "Blau verzinken"],
    ["2026-09-18", "dueDate", "Termin", "2026-09-18"],
    ["18.09.2026", "dueDate", "Termin", "18.09.2026"],
    ["18.09.26", "dueDate", "Termin", "18.09.26"],
  ])("maps the real order field %s to one evidenced ORDER hit", async (query, matchField, matchLabel, matchValue) => {
    const result = await searchTenant(query, ports());
    expect(result).toEqual({
      code: "OK",
      query,
      hits: [{
        type: "ORDER",
        id: ORDER.id,
        title: ORDER.title,
        subtitle: "A-2026-0042 · Muster GmbH · Termin 18.09.2026 · galvanik",
        status: "galvanik",
        matchField,
        source: "Auftragsbestand",
        matchLabel,
        matchValue,
        context: "A-2026-0042 · Muster GmbH · Termin 18.09.2026",
        actionLabel: "Auftragskarte öffnen",
      }],
    });
  });

  it.each([
    ["Erika", "name", "Kundenname", "Erika Muster"],
    ["GmbH", "companyName", "Firma", "Muster GmbH"],
    ["K-1042", "customerNumber", "Kundennummer", "K-1042"],
    ["Stuttgart", "city", "Ort", "Stuttgart"],
  ])("maps the customer port match %s with evidence and without invented fields", async (query, matchField, matchLabel, matchValue) => {
    const result = await searchTenant(query, ports({
      readOrders: vi.fn().mockResolvedValue([]),
      searchCustomers: vi.fn().mockResolvedValue([CUSTOMER]),
    }));
    expect(result).toEqual({
      code: "OK",
      query,
      hits: [{
        type: "CUSTOMER",
        id: CUSTOMER.id,
        title: "Muster GmbH",
        subtitle: "K-1042 · Stuttgart",
        status: "business",
        matchField,
        source: "Kundenstamm",
        matchLabel,
        matchValue,
        context: "Muster GmbH · K-1042 · Stuttgart",
        actionLabel: "Kundenkarte öffnen",
      }],
    });
  });

  it("deduplicates, sorts deterministically and enforces the fixed total cap", async () => {
    const orders = Array.from({ length: 16 }, (_, index) => ({
      ...ORDER,
      id: `order-${String(index).padStart(2, "0")}`,
      title: `Treffer ${String(16 - index).padStart(2, "0")}`,
    }));
    const customers = Array.from({ length: 16 }, (_, index) => ({
      ...CUSTOMER,
      id: `customer-${String(index).padStart(2, "0")}`,
      name: `Treffer ${String(16 - index).padStart(2, "0")}`,
      companyName: null,
    }));
    const result = await searchTenant("Treffer", ports({
      readOrders: vi.fn().mockResolvedValue([...orders, orders[0]]),
      searchCustomers: vi.fn().mockResolvedValue([...customers, customers[0]]),
    }));
    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw new Error("unexpected result");
    expect(result.hits).toHaveLength(SEARCH_MAX_HITS);
    expect(new Set(result.hits.map((hit) => `${hit.type}-${hit.id}`)).size).toBe(SEARCH_MAX_HITS);
    expect(result.hits.slice(0, 10).every((hit) => hit.type === "ORDER")).toBe(true);
    expect(result.hits.slice(10).every((hit) => hit.type === "CUSTOMER")).toBe(true);
  });

  it.each(["orders", "customers"] as const)("fails the whole result closed when the %s port fails", async (failed) => {
    const internal = new Error("private SQL and tenant details");
    const boundary = ports({
      readOrders: failed === "orders" ? vi.fn().mockRejectedValue(internal) : vi.fn().mockResolvedValue([]),
      searchCustomers: failed === "customers" ? vi.fn().mockRejectedValue(internal) : vi.fn().mockResolvedValue([]),
    });
    const result = await searchTenant("Muster", boundary);
    expect(result).toEqual({ code: "UNAVAILABLE", message: "Suche ist derzeit nicht verfügbar." });
    expect(JSON.stringify(result)).not.toContain("private SQL");
    expect(JSON.stringify(result)).not.toContain("tenant");
  });

  it("fails closed on malformed port data", async () => {
    const result = await searchTenant("Muster", ports({
      readOrders: vi.fn().mockResolvedValue([{ ...ORDER, dueDate: "18/09/2026" }]),
    }));
    expect(result).toEqual({ code: "UNAVAILABLE", message: "Suche ist derzeit nicht verfügbar." });
  });

  it("rejects a port result whose actual DTO fields do not prove the requested match", async () => {
    const result = await searchTenant("nirgendwo", ports({
      readOrders: vi.fn().mockResolvedValue([]),
      searchCustomers: vi.fn().mockResolvedValue([CUSTOMER]),
    }));
    expect(result).toEqual({ code: "UNAVAILABLE", message: "Suche ist derzeit nicht verfügbar." });
  });
});
