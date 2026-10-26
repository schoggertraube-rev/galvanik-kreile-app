import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createQuotePdfDocument } from "../QuoteDocument";

describe("KV PDF", () => {
  it("renders a real PDF from the persisted KV readback", async () => {
    const pdf = await renderToBuffer(createQuotePdfDocument({
      company: {
        companyName: "Galvanik Kreile", street: "Testweg 1", zip: "12345", city: "Teststadt", country: "Deutschland",
        taxId: "DE123456789", iban: "DE0012345678", bic: "TESTDEFF", bankName: "Testbank", paymentTermDays: 14, logoUrl: "/logo.png",
      },
      customer: {
        id: "customer-1", customerNumber: "K-2026-0042", name: "SYNTHETISCH Musterkunde", companyName: "SYNTHETISCH Musterkunde GmbH",
        type: "business", contactPerson: "Testperson", email: "kunde@example.invalid", phone: "+49 221 123456", street: "Kundenweg 2",
        address: null, zipCode: "54321", city: "Kundenstadt", country: "Deutschland", paymentPreference: "rechnung_14", vatId: null,
        classification: null, internalNotes: null, tags: [], createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z",
        orderCount: 0, wareImHausCount: 0, wareImHaus: false, orders: [],
      },
      quote: {
        quoteId: "11111111-1111-4111-8111-111111111111", quoteNumber: "KV-2026-0042", customerId: "customer-1", customerNumber: "K-2026-0042",
        customerDisplayName: "SYNTHETISCH Musterkunde GmbH", status: "draft", version: 1, currency: "EUR", dueDate: "2026-11-10",
        note: "SYNTHETISCHER HINWEIS", totalNetCents: 25_000, linkedOrderId: null, actorId: "22222222-2222-4222-8222-222222222222",
        actorDisplayName: "Testperson", createdAt: "2026-10-26T10:00:00.000Z", updatedAt: "2026-10-26T10:00:00.000Z", convertedAt: null,
        positions: [{
          id: "33333333-3333-4333-8333-333333333333", position: 1, name: "Synthetischer Flansch", quantity: 2,
          material: "Stahl", surfaceRequested: "Verzinken", unitPriceCents: 12_500, lineTotalCents: 25_000,
        }],
      },
    }));

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1_000);
  });
});
