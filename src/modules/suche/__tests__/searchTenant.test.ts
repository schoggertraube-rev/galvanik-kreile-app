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

const CHECKED_AT = "2026-09-16T08:15:00.000Z";
const ORDER: SearchOrderDocument = {
  id: "order-1", orderNumber: "A-2026-0042", customerName: "Muster GmbH",
  title: "Geländer Süd", task: "Nacharbeit dokumentieren", station: "galvanik", status: "angenommen",
  dueDate: "2026-09-18T00:00:00.000Z",
  parts: [{ name: "Haltewinkel 4711", material: "Stahl", surfaceRequested: "Blau verzinken" }],
};
const CUSTOMER: SearchCustomerDocument = {
  id: "customer-1", customerNumber: "K-1042", name: "Erika Muster", companyName: "Muster GmbH",
  customerType: "business", city: "Stuttgart",
};

function ports(overrides: Partial<SearchPorts> = {}): SearchPorts {
  return {
    readOrders: vi.fn().mockResolvedValue([ORDER]),
    searchCustomers: vi.fn().mockResolvedValue({ records: [], exhaustive: true }),
    readTimestamp: () => CHECKED_AT,
    ...overrides,
  };
}

describe("Path-1 Lane-0 search contract", () => {
  it.each(["", " ", "x", " x "]) ("does not access ports below the minimum for %j", async (query) => {
    const boundary = ports();
    await expect(searchTenant(query, boundary)).resolves.toEqual({
      code: "OK",
      query: query.trim(),
      hits: [],
      checkedSources: [],
      checkedAt: null,
      coverage: { returnedHits: 0, matchingHitsAtLeast: 0, truncated: false },
    });
    expect(boundary.readOrders).not.toHaveBeenCalled();
    expect(boundary.searchCustomers).not.toHaveBeenCalled();
  });

  it("trims input and rejects invalid input before every port", async () => {
    expect(normalizeSearchQuery("  Muster ")).toEqual({ code: "READY", query: "Muster" });
    const boundary = ports();
    await expect(searchTenant(42, boundary)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(searchTenant("x".repeat(SEARCH_MAX_QUERY_LENGTH + 1), boundary)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(boundary.readOrders).not.toHaveBeenCalled();
  });

  it.each([
    ["A-2026", "orderNumber", "A-2026-0042"], ["Geländer", "title", ORDER.title],
    ["Muster", "customerName", "Muster GmbH"], ["Nacharbeit", "task", "Nacharbeit dokumentieren"],
    ["4711", "part", "Haltewinkel 4711"], ["Stahl", "material", "Stahl"],
    ["Blau verzinken", "surface", "Blau verzinken"], ["18.09.2026", "dueDate", "18.09.2026"],
  ])("maps real order field %s to one evidenced hit", async (query, matchField, matchValue) => {
    const result = await searchTenant(query, ports());
    expect(result).toMatchObject({
      code: "OK", query, checkedSources: ["Auftragsbestand", "Kundenstamm"], checkedAt: CHECKED_AT,
      hits: [{ type: "ORDER", id: ORDER.id, source: "Auftragsbestand", matchField, matchValue, actionLabel: "Auftragskarte öffnen" }],
    });
  });

  it.each([
    ["Erika", "name", "Erika Muster"], ["GmbH", "companyName", "Muster GmbH"],
    ["K-1042", "customerNumber", "K-1042"], ["Stuttgart", "city", "Stuttgart"],
  ])("maps customer field %s without invented facts", async (query, matchField, matchValue) => {
    const result = await searchTenant(query, ports({
      readOrders: vi.fn().mockResolvedValue([]),
      searchCustomers: vi.fn().mockResolvedValue({ records: [CUSTOMER], exhaustive: true }),
    }));
    expect(result).toMatchObject({ code: "OK", hits: [{ type: "CUSTOMER", id: CUSTOMER.id, source: "Kundenstamm", matchField, matchValue, actionLabel: "Kundenkarte öffnen" }] });
  });

  it("proves the same cross-field customer record phrase as the SQL concat and keeps valid order hits", async () => {
    const crossFieldCustomer = { ...CUSTOMER, companyName: "Weber GmbH", city: "Esslingen" };
    const matchingOrder = { ...ORDER, task: "Muster Weber abstimmen" };
    const result = await searchTenant("Muster Weber", ports({
      readOrders: vi.fn().mockResolvedValue([matchingOrder]),
      searchCustomers: vi.fn().mockResolvedValue({ records: [crossFieldCustomer], exhaustive: true }),
    }));
    expect(result).toMatchObject({
      code: "OK",
      hits: [
        expect.objectContaining({ type: "ORDER", id: ORDER.id, matchField: "task", href: `/orders/${ORDER.id}` }),
        expect.objectContaining({
          type: "CUSTOMER",
          id: CUSTOMER.id,
          matchField: "customerRecord",
          matchLabel: "Kundendatensatz",
          matchValue: "Erika Muster Weber GmbH K-1042 Esslingen",
          href: `/customers/${CUSTOMER.id}`,
        }),
      ],
      coverage: { returnedHits: 2, matchingHitsAtLeast: 2, truncated: false },
    });
  });

  it("deduplicates, sorts and caps deterministically", async () => {
    const orders = Array.from({ length: 16 }, (_, index) => ({ ...ORDER, id: `order-${index}`, title: `Treffer ${16 - index}` }));
    const customers = Array.from({ length: 16 }, (_, index) => ({ ...CUSTOMER, id: `customer-${index}`, name: `Treffer ${16 - index}`, companyName: null }));
    const result = await searchTenant("Treffer", ports({
      readOrders: vi.fn().mockResolvedValue([...orders, orders[0]]),
      searchCustomers: vi.fn().mockResolvedValue({ records: [...customers, customers[0]], exhaustive: false }),
    }));
    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw new Error("unexpected result");
    expect(result.hits).toHaveLength(SEARCH_MAX_HITS);
    expect(new Set(result.hits.map((hit) => `${hit.type}-${hit.id}`)).size).toBe(SEARCH_MAX_HITS);
    expect(result.coverage).toEqual({ returnedHits: 20, matchingHitsAtLeast: 32, truncated: true });
  });

  it.each(["orders", "customers", "clock"] as const)("fails the whole result closed when %s fails", async (failed) => {
    const boundary = ports({
      readOrders: failed === "orders" ? vi.fn().mockRejectedValue(new Error("private SQL")) : vi.fn().mockResolvedValue([]),
      searchCustomers: failed === "customers"
        ? vi.fn().mockRejectedValue(new Error("tenant detail"))
        : vi.fn().mockResolvedValue({ records: [], exhaustive: true }),
      readTimestamp: () => failed === "clock" ? "invalid" : CHECKED_AT,
    });
    const result = await searchTenant("Muster", boundary);
    expect(result).toEqual({ code: "UNAVAILABLE", message: "Die internen Bestände konnten nicht sicher durchsucht werden." });
    expect(JSON.stringify(result)).not.toMatch(/private SQL|tenant detail/);
  });

  it("fails closed on malformed or unproven port data", async () => {
    await expect(searchTenant("Muster", ports({ readOrders: vi.fn().mockResolvedValue([{ ...ORDER, dueDate: "18/09/2026" }]) }))).resolves.toMatchObject({ code: "UNAVAILABLE" });
    await expect(searchTenant("nirgendwo", ports({
      readOrders: vi.fn().mockResolvedValue([]),
      searchCustomers: vi.fn().mockResolvedValue({ records: [CUSTOMER], exhaustive: true }),
    }))).resolves.toMatchObject({ code: "UNAVAILABLE" });
    await expect(searchTenant("Muster", ports({
      searchCustomers: vi.fn().mockResolvedValue({ records: [CUSTOMER] }),
    }))).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });
});
