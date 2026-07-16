import { describe, expect, it } from "vitest";
import { orderSchema, scanOrderRequestSchema } from "./orderSchema";

const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);

const validOrder = {
  clientRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  customerId: "customer_123",
  title: "  Kotflügel verzinken  ",
  source: "manual",
  dueDate: futureDate,
  parts: [{ name: " Kotflügel ", quantity: 2, material: " Stahl ", routeTemplateId: "direct_galvanik" }],
};

describe("orderSchema", () => {
  it("normalizes the bounded canonical order contract", () => {
    const result = orderSchema.parse(validOrder);

    expect(result.title).toBe("Kotflügel verzinken");
    expect(result.parts[0]).toEqual({
      name: "Kotflügel",
      quantity: 2,
      material: "Stahl",
      routeTemplateId: "direct_galvanik",
    });
    expect(result.dueDate).toBeInstanceOf(Date);
    expect(result.isQuote).toBe(false);
    expect(result.calendarSync).toBe(false);
  });

  it.each([
    { ...validOrder, id: "client-controlled" },
    { ...validOrder, station: "warenausgang" },
    { ...validOrder, attachmentUrl: "https://example.test/file" },
    { ...validOrder, source: "demo" },
    { ...validOrder, parts: [{ name: "Teil", quantity: "2" }] },
    { ...validOrder, parts: [{ name: "Teil", quantity: 1.5 }] },
    { ...validOrder, parts: [{ name: "Teil", quantity: 0 }] },
  ])("rejects non-canonical or lossy input %#", (input) => {
    expect(orderSchema.safeParse(input).success).toBe(false);
  });

  it("rejects invalid calendar and date claims", () => {
    expect(orderSchema.safeParse({ ...validOrder, dueDate: "2026-02-31" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...validOrder, dueDate: undefined, calendarSync: true }).success).toBe(false);
    expect(orderSchema.safeParse({ ...validOrder, dueDate: "2020-01-01" }).success).toBe(false);
  });
});

describe("scanOrderRequestSchema", () => {
  it("requires a real customer reference and an explicit title", () => {
    expect(scanOrderRequestSchema.safeParse({ title: "Teil", parts: validOrder.parts }).success).toBe(false);
    expect(scanOrderRequestSchema.safeParse({ customerName: "Kreile", title: "", parts: validOrder.parts }).success).toBe(false);
  });

  it("rejects the removed fake customer-creation switch", () => {
    expect(scanOrderRequestSchema.safeParse({
      customerName: "Kreile",
      title: "Teil",
      parts: validOrder.parts,
      forceCreateCustomer: true,
    }).success).toBe(false);
  });
});
